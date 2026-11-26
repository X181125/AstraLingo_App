import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { localDictionary } from './learning-services.js';
import { ApiError } from './http.js';

type Entry = { word: string; meaning: string; example: string };
let index: Map<string, Entry> | undefined;

function words() {
  if (index) return index;
  const rows: [string, string, string][] = JSON.parse(gunzipSync(
    readFileSync(resolve('resources/wordnet/english.json.gz'))).toString('utf8'));
  const entries = new Map(Object.entries(localDictionary).map(([word, entry]) => [word, {word, ...entry}]));
  for (const [word, meaning, example] of rows) {
    if (!entries.has(word)) entries.set(word, {word, meaning, example});
  }
  return index = entries;
}

export function searchWords(search: string, page = 1, limit = 24) {
  const term = search.trim().toLowerCase();
  const start = (page - 1) * limit;
  const result: Entry[] = [];
  let total = 0;
  function collect(entry: Entry) {
    if (total >= start && result.length < limit) result.push(entry);
    total++;
  }
  const exact = words().get(term);
  if (exact) collect(exact);
  for (const entry of words().values()) {
    if (entry !== exact && (entry.word.startsWith(term) || localDictionary[entry.word]?.meaning?.toLowerCase().includes(term))) collect(entry);
  }
  return { result, total };
}

function dto(entry: Entry) {
  return { id: entry.word, word: entry.word, definition: entry.meaning, exampleSentence: entry.example || null,
    ipa: null, imageUrl: null, audioUrl: null, level: null, languageCode: 'en' };
}

export function dictionaryRouter(auth: RequestHandler) {
  const router = Router();
  router.use(auth);
  router.get('/', (req, res) => {
    const {search, page, limit, languageCode, level} = z.object({
      search:z.string().max(120).default(''), page:z.coerce.number().int().positive().max(200000).default(1),
      limit:z.coerce.number().int().min(1).max(100).default(20), languageCode:z.string().default('en'),
      level:z.coerce.number().int().optional(),
    }).parse(req.query);
    const {result,total} = languageCode === 'en' && level === undefined ? searchWords(search,page,limit) : {result:[],total:0};
    res.json({data:result.map(dto),metadata:{page,limit,total,totalPages:Math.ceil(total/limit)}});
  });
  router.get('/:id', (req, res) => {
    const word = words().get(req.params.id.toLowerCase());
    if (!word) throw new ApiError(404, 'Không tìm thấy từ.');
    res.json(dto(word));
  });
  return router;
}
