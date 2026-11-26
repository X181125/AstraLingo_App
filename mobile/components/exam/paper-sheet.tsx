import Booklet from "./booklet";
import { Feather } from "@expo/vector-icons";
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Text } from "@/components/typography";
import { useState } from "react";
import { ExternalLink } from "@/components/external-link";
import type { Attempt } from "@/src/exams";

type Props = { attempt: Attempt; disabled: boolean; onAnswer: (index: number, choice: number) => void };

export default function PaperSheet({ attempt, disabled, onAnswer }: Props) {
  const [module, setModule] = useState(0);
  const paper = attempt.paper!;
  const wide = useWindowDimensions().width >= 1000 && Platform.OS === "web";
  const finished = Boolean(attempt.submittedAt);
  const offset = module * paper.moduleSize;
  const questions = attempt.questions.slice(offset, offset + paper.moduleSize);
  const moduleAnswers = attempt.answers.slice(offset, offset + questions.length);
  const progress = finished
    ? moduleAnswers.filter((choice, index) => choice === questions[index].correct).length
    : moduleAnswers.filter(choice => choice >= 0).length;
  return <View style={s.card}>
    <Text style={s.title}>Reading and Writing</Text>
    <View style={s.switch}>{paper.modulePages.map((_, i) => <Pressable key={i} accessibilityRole="tab"
      aria-selected={module === i} accessibilityState={{selected:module === i}} style={[s.tab, module === i && s.activeTab]} onPress={() => setModule(i)}>
      <Text style={[s.tabText, module === i && {color:"#fff"}]}>Module {i + 1}</Text>
    </Pressable>)}</View>
    <ExternalLink href={`${paper.url}#page=${paper.modulePages[module]}` as `https://${string}`} style={s.link}>
      Open module {module + 1} in the official booklet ↗
    </ExternalLink>
    {finished && <ExternalLink href={paper.solutions as `https://${string}`} style={s.link}>
      Read College Board’s answer explanations ↗
    </ExternalLink>}
    <View style={s.divider}><Feather name={finished ? "check-circle" : "edit-3"} size={16} color="#1252B6"/>
      <Text style={s.count}>{progress} / {questions.length} {finished ? "correct" : "answered"}</Text></View>
    <View style={wide ? {flexDirection:"row",gap:16,alignItems:"flex-start"} : undefined}>
    {wide && <Booklet url={`${paper.url}#page=${paper.modulePages[module]}`} title={`${attempt.title}, module ${module + 1}`}/>}
    <ScrollView key={module} scrollEnabled={wide} style={wide ? {flex:1,height:640} : undefined} contentContainerStyle={{gap:8}}>
    {questions.map((q,i) => <View key={q.prompt} style={s.row}>
      <Text accessibilityLabel={q.prompt} style={s.number}>{i + 1}</Text>
      {q.options.map((letter, choice) => {
        const selected = moduleAnswers[i] === choice;
        const correct = finished && q.correct === choice;
        const wrong = finished && selected && !correct;
        return <Pressable key={letter} accessibilityRole="radio" aria-checked={selected} accessibilityState={{checked:selected}}
          accessibilityLabel={`${q.prompt}, ${letter}${correct ? ", correct answer" : wrong ? ", incorrect" : ""}`}
          disabled={disabled || finished} onPress={() => onAnswer(offset + i, choice)}
          style={[s.bubble, selected && s.selected, correct && s.correct, wrong && s.wrong]}>
          <Text style={[s.letter,(selected || correct) && {color:"white"}]}>{letter}{correct ? " ✓" : wrong ? " ×" : ""}</Text>
        </Pressable>;
      })}
    </View>)}
    </ScrollView></View>
    {module + 1 < paper.modulePages.length && <Pressable style={s.next} accessibilityRole="button" onPress={() => setModule(module+1)}>
      <Text style={s.link}>Go to module {module+2} →</Text></Pressable>}
  </View>;
}

const s = StyleSheet.create({
  card:{backgroundColor:"white",borderWidth:1,borderColor:"#DFE9F7",borderRadius:18,padding:16,gap:12},
  title:{fontSize:20,fontWeight:"600",color:"#202244"},switch:{flexDirection:"row",backgroundColor:"#EBF2FF",borderRadius:14,padding:4},
  tab:{flex:1,alignItems:"center",paddingVertical:10,borderRadius:11},activeTab:{backgroundColor:"#0961F5"},tabText:{fontWeight:"600",color:"#264582"},
  link:{fontFamily:"Fredoka_600SemiBold",fontSize:15,color:"#1252B6",paddingVertical:4},
  divider:{flexDirection:"row",gap:8,alignItems:"center"},count:{color:"#53637C"},
  row:{flexDirection:"row",gap:6,alignItems:"center",borderTopWidth:1,borderColor:"#EAF0F9",paddingTop:8},
  number:{width:30,fontSize:16,fontWeight:"600",color:"#202244"},bubble:{flex:1,minHeight:44,maxWidth:96,borderRadius:14,
    borderWidth:1,borderColor:"#C6D7EF",alignItems:"center",justifyContent:"center"},
  letter:{fontWeight:"600",fontSize:16,color:"#294164"},selected:{backgroundColor:"#0961F5",borderColor:"#0961F5"},
  correct:{backgroundColor:"#167047",borderColor:"#167047"},wrong:{backgroundColor:"#AB3447",borderColor:"#AB3447"},
  next:{alignSelf:"center",padding:8},
});
