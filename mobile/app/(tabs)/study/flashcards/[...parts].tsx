import { Redirect, useLocalSearchParams } from 'expo-router';
import { LearningScreen, Pending, useFocusedData } from '@/components/Learning';

export default function FlashcardLink() {
  const {parts:raw,deckId,id}=useLocalSearchParams<{parts:string[]|string;deckId?:string;id?:string}>();
  const parts=Array.isArray(raw)?raw:raw.split('/');
  const key=parts[0]==='deck'?parts[1]:deckId ?? id;
  const deck=useFocusedData<{id:string}>(key?'/learn/decks/'+encodeURIComponent(key):null);
  if(!key) return <Redirect href={parts.includes('explore_tab')?'/flashcards?view=explore':'/flashcards'}/>;
  if(!deck.data) return <LearningScreen title="Mở bộ thẻ" back><Pending {...deck}/></LearningScreen>;
  return <Redirect href={{pathname:'/flashcards/[id]',params:{id:deck.data.id}}}/>;
}
