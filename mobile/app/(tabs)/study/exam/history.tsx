import { useAuth } from "@/src/auth";
import QuizHeader from "@/components/ExamHeader";
import { Feather } from "@expo/vector-icons";
import { createExamApi, requiresLogin, type HistoryItem } from "@/src/exams";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, Pressable, View } from "react-native";
import { Text } from "@/components/typography";
import { SafeAreaView } from "react-native-safe-area-context";

export default function History() {
  const { token } = useAuth();
  const examApi = useMemo(() => createExamApi(token), [token]);
  const [rows, setRows] = useState<HistoryItem[]>([]);
  const [message, setMessage] = useState("Loading…");
  const [login, setLogin] = useState(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setRows([]); setMessage("Loading…"); setLogin(false);
    examApi.history().then(data => {
      if (active) { setRows(data); setMessage(data.length ? "" : "You have no exam attempts yet."); }
    }).catch(e => { if (active) { setLogin(requiresLogin(e)); setMessage(requiresLogin(e) ? "Log in to view your exam history." : "Could not load exam history."); } });
    return () => { active = false; };
  }, [retry, examApi]));
  return <SafeAreaView style={{flex:1,backgroundColor:"#F5F9FF"}}><ScrollView contentContainerStyle={{padding:20,gap:14,width:"100%",maxWidth:760,alignSelf:"center"}}>
    <QuizHeader title="Exam history" onBack={() => router.replace("/study/exam")} />
    {!!message && <Text>{message}</Text>}
    {login && <Text accessibilityRole="button" onPress={() => router.replace("/login")}>Log in</Text>}
    {message === "Could not load exam history." && <Text accessibilityRole="button" onPress={() => setRetry(v=>v+1)}>Try again</Text>}
    {rows.map(row => <Pressable key={row.id} accessibilityRole="button"
      onPress={() => router.push({pathname:"/study/exam/[id]",params:{id:row.examId,attempt:row.id}})}
      style={{backgroundColor:"white",flexDirection:"row",alignItems:"center",gap:14,padding:16,borderRadius:16,borderWidth:1,borderColor:"#DBE7F6"}}>
      <View style={{width:44,height:44,borderRadius:14,backgroundColor:"#E8F1FF",alignItems:"center",justifyContent:"center"}}><Feather name={row.correct === null ? "edit-3" : "award"} size={22} color="#1252B6"/></View>
      <View style={{flex:1,gap:4}}><Text style={{color:"#202244",fontSize:18,fontWeight:"600"}}>{row.title}</Text>
      <Text>{new Date(row.startedAt).toLocaleString()} · {row.correct === null ? "Continue exam" : row.correct + " / " + row.total}</Text>
      </View><Feather name="chevron-right" size={18} color="#627591"/>
    </Pressable>)}
  </ScrollView></SafeAreaView>;
}
