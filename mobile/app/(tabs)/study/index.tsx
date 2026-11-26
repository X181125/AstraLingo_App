import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/UI";
import { Text } from "@/components/typography";

export default function Study() {
  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <Ionicons name="school-outline" color="#FFD875" size={35}/>
        <Text style={styles.title}>Học tập</Text>
        <Text style={styles.subtitle}>Luyện tiếng Anh theo chủ đề hoặc làm đề có tính giờ.</Text>
      </View>
      <Button label="Online Exam" icon="document-text-outline" onPress={() => router.push("/study/exam")}/>
      <Button label="Mini Quiz" icon="flash-outline" secondary onPress={() => router.push("/study/exam?mini=1")}/>
      <Button label="Lịch sử làm bài" icon="time-outline" secondary onPress={() => router.push("/study/exam/history")}/>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:"#F5F9FF"},
  page:{width:"100%",maxWidth:760,alignSelf:"center",padding:22,gap:16},
  hero:{backgroundColor:"#1249B0",borderRadius:22,padding:24,gap:10},
  title:{fontSize:30,fontWeight:"700",color:"white"},
  subtitle:{fontSize:16,color:"#E6F0FF"},
});
