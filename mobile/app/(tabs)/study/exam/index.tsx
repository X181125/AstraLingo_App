import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ExamHeader from "@/components/ExamHeader";
import { Text } from "@/components/typography";
import { createExamApi, type ExamSummary } from "@/src/exams";

const examApi = createExamApi(null);

export default function ExamCatalog() {
  const { mini } = useLocalSearchParams<{mini?: string}>();
  const isQuiz = mini === "1";
  const [items,setItems] = useState<ExamSummary[]>([]);
  const [error,setError] = useState(false);
  const [retry,setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    examApi.list().then(rows => { if (active) setItems(rows); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [retry]);
  const visible = items.filter(row => isQuiz ? !row.paper : !!row.paper);
  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.page}>
    <ExamHeader title={isQuiz ? "Mini Quiz" : "Online Exam"} onBack={() => router.replace("/study")}/>
    <View style={styles.hero}>
      <Feather name={isQuiz ? "zap" : "book-open"} size={28} color="#FFD875"/>
      <Text style={styles.title}>{isQuiz ? "Choose your skill" : "SAT Reading and Writing"}</Text>
      <Text style={styles.subtitle}>{isQuiz ? "English practice by topic, with instant scores." : "Official College Board practice papers, with two modules per test."}</Text>
    </View>
    {error ? <Text accessibilityRole="button" onPress={() => setRetry(n=>n+1)}>Could not load questions. Try again.</Text> :
      !items.length && <Text>Loading questions...</Text>}
    {visible.map(item => <Pressable key={item.id} accessibilityRole="button"
      onPress={() => router.push({pathname:"/study/exam/[id]",params:{id:item.id,...(isQuiz && {mini:"1"})}})}
      style={styles.card}>
      <View style={styles.icon}><Feather name={item.paper ? "file-text" : "edit-3"} size={22} color="#1252B6"/></View>
      <View style={{flex:1,gap:6}}>
        <Text style={styles.name}>{item.title}</Text>
        <Text style={styles.meta}>{item.questions} questions  |  {item.durationMin} min  |  {item.paper ? "College Board" : item.tags[0]}</Text>
      </View>
      <Feather name="chevron-right" size={18} color="#1252B6"/>
    </Pressable>)}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:"#F5F9FF"},page:{width:"100%",maxWidth:760,alignSelf:"center",padding:20,gap:14},
  hero:{backgroundColor:"#1249B0",borderRadius:20,padding:20,gap:8},
  title:{fontSize:24,fontWeight:"700",color:"white"},subtitle:{fontSize:15,color:"#E6F0FF"},
  card:{backgroundColor:"white",padding:16,gap:12,borderRadius:16,borderWidth:1,borderColor:"#DFE9F7",flexDirection:"row",alignItems:"center"},
  icon:{width:44,height:44,borderRadius:14,backgroundColor:"#E8F1FF",alignItems:"center",justifyContent:"center"},
  name:{fontSize:17,fontWeight:"600",color:"#202244"},meta:{color:"#53637C"}
});
