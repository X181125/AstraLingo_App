import { Redirect, useLocalSearchParams } from 'expo-router';
export default function OpenSession() {
  const {id}=useLocalSearchParams<{id?:string}>();
  return id ? <Redirect href={{pathname:'/practice/[id]',params:{id,panel:'practice'}}}/> : <Redirect href="/study?skill=LISTENING"/>;
}
