import { Redirect, useLocalSearchParams } from 'expo-router';
import { LearningScreen, Pending, useFocusedData } from '@/components/Learning';
import type { Practice } from '@/src/learning';

export default function LessonLink() {
  const {parts:raw} = useLocalSearchParams<{parts:string[]|string}>();
  const parts=Array.isArray(raw)?raw:raw.split('/');
  const [first,second,...rest]=parts;
  const id=second ?? first;
  const lesson=useFocusedData<Practice>('/study/lessons/'+encodeURIComponent(id));
  if(!lesson.data) return <LearningScreen title="Mở bài luyện" back><Pending {...lesson}/></LearningScreen>;
  const item=lesson.data, section=rest[0];
  if(first==='edit' || section==='manage') return <Redirect href={{pathname:'/practice/editor',params:{id:item.id}}}/>;
  if(section==='assessments' || section==='quiz' || (section==='attempt' && ['reading','listening'].includes(first))) return <Redirect href={{pathname:'/practice/assessments',params:{id:String(item.publicId),kind:first}}}/>;
  const panel=section==='annotations' || section==='saved-words' ? 'notes' : ['history','result','review','progress','attempts'].includes(section)?'history':
    section==='editor'||section==='attempt'||section==='submission'?'practice':'overview';
  return <Redirect href={{pathname:'/practice/[id]',params:{id:item.id,panel}}}/>;
}
