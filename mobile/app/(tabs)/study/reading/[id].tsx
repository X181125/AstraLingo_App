import { Redirect, useLocalSearchParams } from 'expo-router';
export default function OpenLesson() {
  const {id}=useLocalSearchParams<{id:string}>();
  return <Redirect href={{pathname:'/practice/[id]',params:{id}}}/>;
}
