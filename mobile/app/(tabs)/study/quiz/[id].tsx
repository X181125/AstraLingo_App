import { Redirect, useLocalSearchParams } from 'expo-router';
const topics:Record<string,string>={'sys-grammar-past':'english-grammar','my-grammar-articles':'english-grammar','my-toeic-1':'english-words'};
export default function OpenQuiz() {
  const {id}=useLocalSearchParams<{id:string}>();
  const topic=topics[id] ?? id;
  return ['english-grammar','english-words','english-idioms','science-reading','english-listening'].includes(topic)
    ? <Redirect href={{pathname:'/study/exam/[id]',params:{id:topic,mini:'1'}}}/> : <Redirect href="/study/exam?mini=1"/>;
}
