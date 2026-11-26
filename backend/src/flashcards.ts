import { Router, type RequestHandler } from 'express';
import type { PrismaClient, Card, Deck, CardReview, Prisma } from '@prisma/client';
import { z } from 'zod';
import { ok, ApiError } from './http.js';
import { reviewCard } from './vocabulary.js';
import { studyDate } from './study.js';

const number = z.coerce.number().int().min(1).max(2147483647);
const short = z.string().trim().min(1).max(180);
const optional = z.string().trim().max(500).nullable().optional();
const deckFields = z.object({title:short.min(2).max(100),description:optional,sourceLang:z.enum(['en','vi']).default('en'),
  targetLang:z.enum(['en','vi']).default('vi'),isPublic:z.boolean().default(false)});
const cardFields=z.object({word:short,translation:short.max(500).optional(),definition:optional,
  phonetic:optional,pos:optional,exampleSentence:optional,imageUrl:z.url({protocol:/^https$/}).nullable().optional(),audioUrl:z.url({protocol:/^https$/}).nullable().optional()});
function deckView(d:Deck) {
  const {publicId:id,ownerId:userId,title,description,sourceLang,targetLang,isPublic,createdAt}=d;
  return {id,userId,title,description,sourceLang,targetLang,isPublic,createdAt};
}
function cardView(c:Card, deckId:number) {
  return {id:c.publicId,deckId,word:c.front,translation:c.back,definition:c.definition ?? c.back,phonetic:c.phonetic,
    pos:c.pos,exampleSentence:c.exampleSentence,imageUrl:c.imageUrl,audioUrl:c.audioUrl};
}
function progressView(progress:CardReview, id:number) {
  return {id,cardId:id,userId:progress.userId,boxNumber:progress.box,nextReview:progress.nextReview,lastPracticed:progress.reviewedAt};
}
function newCard(input:z.infer<typeof cardFields>) {
  const {word,translation,definition,...rest}=input;
  const back=translation || definition;
  if(!back) throw new ApiError(400,'Hãy thêm nghĩa cho từ.');
  return {...rest,front:word,back,definition};
}

export function flashcardRoutes(db:PrismaClient, auth:RequestHandler) {
  const router=Router();
  const deckId=(raw:unknown)=>number.parse(raw);
  async function deck(raw:unknown, owner?:string) {
    const item=await db.deck.findFirst({where:{publicId:deckId(raw),...(owner ? {ownerId:owner}:{isPublic:true})}});
    if(!item) throw new ApiError(404,'Không tìm thấy bộ thẻ.');
    return item;
  }
  async function ownCard(raw:unknown,ownerId:string) {
    const item=await db.card.findFirst({where:{publicId:number.parse(raw),deck:{ownerId}},include:{deck:true}});
    if(!item) throw new ApiError(404,'Không tìm thấy thẻ.');
    return item;
  }
  router.get('/flashcard-decks/explore/:id',async(req,res)=>{
    const item=await deck(req.params.id);
    const cards=await db.card.findMany({where:{deckId:item.id},orderBy:{publicId:'asc'}});
    ok(res,{...deckView(item),flashcardsCount:cards.length,flashcards:cards.map(c=>cardView(c,item.publicId))});
  });
  router.use(['/flashcard-decks','/flashcards','/flashcard-progress'],auth);
  router.get('/flashcard-decks/explore',async(req,res)=>{
    const {q,page,limit}=z.object({q:z.string().max(100).default(''),page:number.max(100000).default(1),limit:number.max(100).default(24)}).parse(req.query);
    const where={isPublic:true,title:{contains:q,mode:'insensitive' as const}};
    const [rows,count]=await db.$transaction([db.deck.findMany({where,take:limit,skip:(page-1)*limit,orderBy:{publicId:'desc'},
      include:{_count:{select:{cards:true}},owner:{select:{id:true,name:true,avatarUrl:true}}}}),db.deck.count({where})]);
    res.json({success:true,count,page,limit,data:rows.map(row=>({...deckView(row),flashcardsCount:row._count.cards,author:{id:row.owner.id,fullName:row.owner.name,avatarUrl:row.owner.avatarUrl}}))});
  });
  router.get('/flashcard-decks',async(_req,res)=>{
    const rows=await db.deck.findMany({where:{ownerId:res.locals.user.id},orderBy:{publicId:'desc'}});
    res.json({success:true,count:rows.length,data:rows.map(deckView)});
  });
  router.post('/flashcard-decks',async(req,res)=>{
    const input=deckFields.parse(req.body);
    if(input.sourceLang!=='en' && input.targetLang!=='en') throw new ApiError(400,'Bộ thẻ cần có tiếng Anh.');
    ok(res,deckView(await db.deck.create({data:{...input,ownerId:res.locals.user.id}})),201);
  });
  router.get('/flashcard-decks/:id',async(req,res)=>ok(res,deckView(await deck(req.params.id,res.locals.user.id))));
  router.put(['/flashcard-decks/:id','/flashcard-decks/:id/public'],async(req,res)=>{
    const item=await deck(req.params.id,res.locals.user.id);
    const input: Partial<z.infer<typeof deckFields>> = req.path.endsWith('/public')
      ? z.object({isPublic:z.boolean()}).parse(req.body) : deckFields.partial().parse(req.body);
    if((input.sourceLang ?? item.sourceLang)!=='en' && (input.targetLang ?? item.targetLang)!=='en') throw new ApiError(400,'Bộ thẻ cần có tiếng Anh.');
    ok(res,deckView(await db.deck.update({where:{id:item.id,ownerId:res.locals.user.id},data:input})));
  });
  router.delete('/flashcard-decks/:id',async(req,res)=>{
    const item=await deck(req.params.id,res.locals.user.id);
    await db.deck.delete({where:{id:item.id,ownerId:res.locals.user.id}});
    ok(res,{deleted:true});
  });
  router.post('/flashcard-decks/:id/clone',async(req,res)=>{
    const source=await deck(req.params.id);
    const opts=z.object({title:short.max(100).optional(),description:optional,makePrivate:z.boolean().default(true)}).parse(req.body ?? {});
    const cards=await db.card.findMany({where:{deckId:source.id},select:{front:true,back:true,definition:true,phonetic:true,pos:true,exampleSentence:true,imageUrl:true,audioUrl:true}});
    const item=await db.deck.create({data:{title:opts.title ?? source.title,description:opts.description ?? source.description,
      sourceLang:source.sourceLang,targetLang:source.targetLang,ownerId:res.locals.user.id,isPublic:!opts.makePrivate,cards:{create:cards}}});
    ok(res,{newDeck:deckView(item),clonedCardCount:cards.length},201);
  });
  router.get(['/flashcards','/flashcards/deck/:id'],async(req,res)=>{
    const selected=req.params.id ? await deck(req.params.id,res.locals.user.id):undefined;
    const rows=await db.card.findMany({where:{deck:{ownerId:res.locals.user.id},deckId:selected?.id},include:{deck:true},orderBy:{publicId:'asc'}});
    res.json({success:true,count:rows.length,sourceLang:selected?.sourceLang,data:rows.map(c=>cardView(c,c.deck.publicId))});
  });
  router.post(['/flashcards','/flashcards/bulk'],async(req,res)=>{
    const item=await deck(req.body?.deckId,res.locals.user.id);
    const bulk=req.path.endsWith('/bulk');
    const batch=(bulk ? z.array(cardFields).min(1).max(40).parse(req.body.items):[cardFields.parse(req.body)]).map(newCard);
    const rows=await db.$transaction(async tx=>{
      const locked=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Deck" WHERE id=${item.id} AND "ownerId"=${res.locals.user.id} FOR UPDATE`;
      if(!locked.length) throw new ApiError(404,'Không tìm thấy bộ thẻ.');
      if(await tx.card.count({where:{deckId:item.id}})+batch.length>300) throw new ApiError(400,'Mỗi bộ thẻ chứa tối đa 300 thẻ.');
      return tx.card.createManyAndReturn({data:batch.map(c=>({...c,deckId:item.id}))});
    });
    ok(res,bulk ? {created:rows.length,items:rows.map(c=>cardView(c,item.publicId))}:cardView(rows[0],item.publicId),201);
  });
  router.put('/flashcards/:id',async(req,res)=>{
    const prior=await ownCard(req.params.id,res.locals.user.id);
    const input=cardFields.partial().parse(req.body);
    const {word,translation,...rest}=input;
    const row=await db.card.update({where:{id:prior.id},data:{...rest,front:word,back:translation}});
    ok(res,cardView(row,prior.deck.publicId));
  });
  router.delete('/flashcards/:id',async(req,res)=>{
    const prior=await ownCard(req.params.id,res.locals.user.id);
    await db.card.delete({where:{id:prior.id}});
    ok(res,{deleted:true});
  });
  router.get(['/flashcards/stats','/flashcards/deck/:id/stats'],async(req,res)=>{
    const ownerId=res.locals.user.id;
    const selected=req.params.id ? await deck(req.params.id,ownerId):undefined;
    const now=new Date(), day=studyDate(now);
    const where:Prisma.CardWhereInput={deckId:selected?.id,deck:{ownerId}};
    const [totalCards,learned,toReview,remembered]=await db.$transaction([
      db.card.count({where}),db.card.count({where:{...where,reviews:{some:{userId:ownerId}}}}),
      db.card.count({where:{...where,reviews:{some:{userId:ownerId,nextReview:{lte:now}}}}}),
      db.card.count({where:{...where,reviews:{some:{userId:ownerId,box:{gte:3}}}}}),
    ]);
    const newCards=totalCards-learned;
    ok(res,{totalCards,learned,newCards,toReview,dueToday:toReview+newCards,remembered,asOf:now,todayVn:day,...(selected && {deck:deckView(selected)})});
  });
  router.get('/flashcard-progress/deck/:id',async(req,res)=>{
    const userId=res.locals.user.id, item=await deck(req.params.id,userId);
    const rows=await db.card.findMany({where:{deckId:item.id,OR:[{reviews:{none:{userId}}},{reviews:{some:{userId,nextReview:{lte:new Date()}}}}]},
      include:{reviews:{where:{userId}}},orderBy:{publicId:'asc'}});
    ok(res,rows.map(c=>({id:c.publicId,deckId:item.publicId,front:c.front,back:c.back,imageUrl:c.imageUrl,example:c.exampleSentence,
      deck:{sourceLang:item.sourceLang,targetLang:item.targetLang},progress:c.reviews.map(r=>progressView(r,c.publicId))})));
  });
  router.post('/flashcard-progress/answer',async(req,res)=>{
    const input=z.object({cardId:number,quality:z.enum(['again','hard','good','easy'])}).parse(req.body);
    const c=await ownCard(input.cardId,res.locals.user.id);
    ok(res,progressView(await reviewCard(db,res.locals.user.id,c.id,input.quality),c.publicId));
  });
  return router;
}
