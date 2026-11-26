import { useAuth } from "@/src/auth";
import PaperSheet from "@/components/exam/paper-sheet";
import QuizHeader from "@/components/ExamHeader";
import { Feather } from "@expo/vector-icons";
import { ExternalLink } from "@/components/external-link";
import { createExamApi, requiresLogin, type Attempt, type ExamSummary } from "@/src/exams";
import { API_URL as API_BASE_URL } from "@/src/api";
import { router, useLocalSearchParams } from "expo-router";
import { useAudioPlayer } from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View, StyleSheet } from "react-native";
import { Text } from "@/components/typography";
import { SafeAreaView } from "react-native-safe-area-context";

function Button({label, onPress, disabled}: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, disabled && {opacity: 0.6}]}>
    <Text style={s.buttonText}>{label}</Text></Pressable>;
}
function Recording({path}: { path: string }) {
  const player = useAudioPlayer(path.startsWith("https://") ? path : API_BASE_URL.replace(/\/api\/?$/, "") + path);
  return <Button label="Play recording" onPress={async () => { await player.seekTo(0); player.play(); }} />;
}

export default function ExamPage() {
  const { token } = useAuth();
  const examApi = useMemo(() => createExamApi(token), [token]);
  const { id, attempt: attemptId, mini } = useLocalSearchParams<{ id: string; attempt?: string; mini?: string }>();
  const [exam, setExam] = useState<ExamSummary | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState("");
  const [login, setLogin] = useState(false);
  const [confirmSubmit,setConfirmSubmit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const lock = useRef(false);
  const clockOffset = useRef(0);
  const sync = useCallback((row: Attempt) => {
    clockOffset.current = Date.parse(row.serverTime) - Date.now();
    setClock(Date.parse(row.serverTime));
    setAttempt(row);
  }, []);
  const attemptedExpiry = useRef<string | null>(null);
  const report = useCallback((e: unknown) => {
    setLogin(requiresLogin(e));
    setError(requiresLogin(e) ? "Log in to take this exam and save your score." : e instanceof Error ? e.message : "Unable to load exam.");
  }, []);
  useEffect(() => {
    let active = true;
    setError(""); setLogin(false); setExam(null); setAttempt(null); setConfirmSubmit(false); attemptedExpiry.current = null;
    async function load() {
      const detail = await examApi.detail(id);
      if (active) setExam(detail);
      if (attemptId) {
        const row = await examApi.attempt(attemptId);
        if (row.examId !== id) throw new Error("This attempt belongs to a different exam.");
        if (active) sync(row);
      } else if (mini === "1" && active) {
        const row = await examApi.start(id);
        if (active) { sync(row); router.setParams({attempt:row.id}); }
      }
    }
    load().catch(e => { if (active) report(e); });
    return () => { active = false; };
  }, [id, attemptId, mini, reload, report, sync, examApi]);

  const act = useCallback(async (task: () => Promise<Attempt>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setLogin(false);
    try {
      const row = await task();
      sync(row);
      if (row.id !== attemptId) router.setParams({ attempt: row.id });
    } catch (e) { report(e); }
    finally { lock.current = false; setBusy(false); }
  }, [attemptId, report, sync]);
  useEffect(() => {
    if (!attempt || attempt.submittedAt) return;
    const timer = setInterval(() => setClock(Date.now() + clockOffset.current), 500);
    return () => clearInterval(timer);
  }, [attempt?.id, attempt?.submittedAt]);
  const remaining = attempt ? Math.max(0, Math.ceil((Date.parse(attempt.expiresAt) - clock) / 1000)) : 0;
  useEffect(() => {
    if (attempt && !attempt.submittedAt && remaining === 0 && !busy && attemptedExpiry.current !== attempt.id) {
      attemptedExpiry.current = attempt.id;
      act(() => examApi.attempt(attempt.id));
    }
  }, [attempt, remaining, busy, act]);
  const finished = !!attempt?.submittedAt;
  const answered = attempt?.answers.filter(x => x >= 0).length ?? 0;
  return <SafeAreaView style={s.screen}><ScrollView contentContainerStyle={[s.body,attempt?.paper && {maxWidth:1160}]}>
    <QuizHeader title={mini === "1" ? "Mini Quiz" : "Online Exam"} onBack={() => router.replace(mini === "1" ? "/study/exam?mini=1" : "/study/exam")} />
    <View style={s.banner}>
      <Feather name={finished ? "award" : "book-open"} size={28} color="#FFD875" />
      <Text style={s.bannerTitle}>{exam?.title ?? "Online Exam"}</Text>
      {exam && <Text style={s.light}>{exam.paper ? "College Board · Official practice booklet" : exam.tags.join(" · ")}  |  {exam.questions} questions</Text>}
    </View>
    {["english-grammar","english-words","english-idioms"].includes(id) && <View style={{flexDirection:"row", flexWrap:"wrap", alignItems:"center", gap:8}}>
      <ExternalLink style={s.link} href="https://thetriviaapi.com/">Questions by The Trivia API</ExternalLink>
      <ExternalLink style={s.link} href="https://creativecommons.org/licenses/by-nc/4.0/">CC BY-NC 4.0</ExternalLink>
    </View>}
    {id === "english-listening" && <ExternalLink style={s.link} href="https://dictionaryapi.dev/">Free Dictionary API · English voice backup</ExternalLink>}
    {id === "science-reading" && <View style={{gap:6}}>
      <ExternalLink style={s.link} href="https://huggingface.co/datasets/allenai/sciq">Passages and questions from SciQ · Allen Institute for AI</ExternalLink>
      <ExternalLink style={s.link} href="https://creativecommons.org/licenses/by-nc/3.0/">CC BY-NC 3.0</ExternalLink>
    </View>}
    {!!error && <View style={s.panel}><Text accessibilityRole="alert">{error}</Text>
      {login ? <Button label="Log in" onPress={() => router.replace("/login")} />
        : <Button label="Try again" onPress={() => setReload(v => v+1)} />}</View>}
    {!error && !exam && <Text>Loading exam…</Text>}
    {mini === "1" && exam && !attempt && !error && <Text>Preparing your quiz…</Text>}
    {mini !== "1" && exam && !attempt && !attemptId && <View style={s.panel}>
      <Text style={s.title}>{exam.paper ? "Reading and Writing answer sheet" : "Before you start"}</Text>
      <Text>{exam.questions} questions · {exam.durationMin} minutes</Text>
      {exam.paper && <><Text>Open the booklet for the passages and questions. Return here to select A–D for both modules. Your result is the number correct out of {exam.questions}.</Text>
      <ExternalLink style={s.link} href={(exam.paper.url+"#page="+exam.paper.modulePages[0]) as `https://${string}`}>Open official question booklet ↗</ExternalLink></>}
      <Text>Your answers are saved as you go. When time runs out, unanswered questions score zero.</Text>
      <Button label="Start exam" disabled={busy || login} onPress={() => act(() => examApi.start(id))} /></View>}
    {attempt && <>
      {attempt.savedSet && <Text>Using a saved question set from the provider.</Text>}
      <View style={s.panel}>
        <Text style={s.title}>{finished ? "Your score" : "Time remaining"}</Text>
        <Text style={s.heading}>{finished ? attempt.correct + " / " + attempt.questions.length :
          Math.floor(remaining / 60) + ":" + String(remaining % 60).padStart(2,"0")}</Text>
        <Text>{finished ? Math.round(100 * (attempt.correct ?? 0) / attempt.questions.length) + "% correct" : answered + " of " + attempt.questions.length + " answered"}</Text>
        <View style={s.track}><View style={[s.fill,{width:`${100*(finished ? attempt.correct ?? 0 : answered)/attempt.questions.length}%`}]} /></View>
      </View>
      <View style={s.panel}><Text style={s.passage}>{attempt.passage}</Text>{attempt.audio && <Recording path={attempt.audio} />}</View>
      {attempt.paper ? <PaperSheet key={attempt.id} attempt={attempt} disabled={busy || remaining === 0}
        onAnswer={(index,choice) => act(() => examApi.answer(attempt.id,index,choice,attempt.revision))} /> : attempt.questions.map((q, i) => <View key={q.prompt} style={s.panel}>
        {q.recording && <View style={{gap:6}}>
          <Recording path={q.recording.audio} />
          <ExternalLink style={s.link} href={q.recording.sourceUrl as `https://${string}`}>Recording credits · Wikimedia Commons</ExternalLink>
          <ExternalLink style={s.link} href={q.recording.license.url as `https://${string}`}>{q.recording.license.name}</ExternalLink>
        </View>}
        {!!q.context && <Text style={s.passage}>{q.context}</Text>}
        <Text style={s.title}>{i+1}. {q.prompt}</Text>
        {q.options.map((option, n) => <Pressable key={option} accessibilityRole="radio" aria-checked={attempt.answers[i]===n} accessibilityState={{checked:attempt.answers[i]===n}}
          disabled={finished || busy || remaining === 0} style={[s.option, attempt.answers[i]===n && s.selected]}
          onPress={() => act(() => examApi.answer(attempt.id, i, n, attempt.revision))}>
          <View style={[s.letter,attempt.answers[i]===n && {backgroundColor:"#0961F5"}]}><Text style={{fontWeight:"600",color:attempt.answers[i]===n ? "white" : "#36557F"}}>{String.fromCharCode(65+n)}</Text></View><Text style={{flex:1,color:"#202244",fontSize:15}}>{option}</Text></Pressable>)}
        {finished && <><Text>Your answer: {q.options[attempt.answers[i]] ?? "Unanswered"}</Text>
          <Text style={s.link}>Correct answer: {q.options[q.correct!]}</Text>{!!q.explanation && <Text>{q.explanation}</Text>}</>}
      </View>)}
      {finished ? <Button label="View exam history" onPress={() => router.push("/study/exam/history")} /> :
        confirmSubmit ? <View style={s.panel}><Text style={s.title}>Submit with {attempt.questions.length-answered} unanswered?</Text>
          <Button label="Submit now" disabled={busy} onPress={() => act(() => examApi.submit(attempt.id))}/>
          <Button label="Keep working" onPress={() => setConfirmSubmit(false)}/></View> :
        <Button label="Submit exam" disabled={busy} onPress={() => answered === attempt.questions.length ? act(() => examApi.submit(attempt.id)) : setConfirmSubmit(true)} />}
    </>}
  </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#F5F9FF"},body:{width:"100%",maxWidth:760,alignSelf:"center",padding:20,gap:16,paddingBottom:44},
  banner:{borderRadius:20,backgroundColor:"#1249B0",padding:20,gap:8},bannerTitle:{fontSize:25,lineHeight:31,fontWeight:"600",color:"white"},
  light:{fontSize:14,color:"#E1EEFF"},track:{height:7,borderRadius:4,backgroundColor:"#E8F1FF",overflow:"hidden"},fill:{height:7,backgroundColor:"#0961F5"},
  letter:{width:32,height:32,borderRadius:12,backgroundColor:"#E8F1FF",alignItems:"center",justifyContent:"center"},
  heading:{fontSize:27,fontFamily:"Fredoka_600SemiBold",color:"#202244"},title:{fontSize:18,fontWeight:"600",color:"#202244"},
  panel:{padding:18,gap:12,borderRadius:18,backgroundColor:"white",borderWidth:1,borderColor:"#DFE9F7"},passage:{fontSize:16,lineHeight:24},
  button:{alignSelf:"flex-start",backgroundColor:"#0961F5",paddingVertical:12,paddingHorizontal:18,borderRadius:10},
  buttonText:{color:"white",fontWeight:"600"},link:{color:"#174CB2",fontFamily:"Fredoka_600SemiBold"},
  option:{flexDirection:"row",alignItems:"center",gap:12,padding:10,borderRadius:14,borderWidth:1,borderColor:"#D0DAE8"},selected:{borderColor:"#0961F5",backgroundColor:"#E8F1FF"}
});
