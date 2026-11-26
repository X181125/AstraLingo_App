import { randomInt } from "node:crypto";
import { z } from "zod";

const topics = [
  { id: "english-grammar", title: "English Grammar Quiz", topic: "Grammar", count: 8, tag: "topic:grammar-and-punctuation" },
  { id: "english-words", title: "English Vocabulary Quiz", topic: "Vocabulary", count: 12, tag: "topic:words" },
  { id: "english-idioms", title: "English Idioms Quiz", topic: "Idioms", count: 8, tag: "topic:idioms-and-phrases" },
];
export const readingSummary = { id: "science-reading", title: "Science Reading Comprehension", tags: ["Reading", "English"], durationMin: 15, questions: 10 };
const listeningSummary = {id:"english-listening", title:"English Listening Quiz", tags:["Listening","English"], durationMin:6, questions:6};
export const liveQuizzes = [
  ...topics.map(t => ({id: t.id, title: t.title, tags:[t.topic,"English"], durationMin:t.count, questions:t.count})),
  readingSummary, listeningSummary
];
const entry = z.object({
  type: z.literal("text_choice"), question: z.object({text:z.string().trim().min(1)}),
  tags:z.array(z.string()), correctAnswer:z.string().trim().min(1), incorrectAnswers:z.array(z.string().trim().min(1)).length(3)
});

function shuffled<T>(values: T[]) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export async function loadLiveQuiz(id: string) {
  if (id === listeningSummary.id) return loadListening();
  if (id === readingSummary.id) return loadReading();
  const topic = topics.find(t => t.id === id);
  const summary = liveQuizzes.find(s => s.id === id);
  if (!topic || !summary) throw new Error("Unknown quiz");
  const tag = topic.tag;
  const url = new URL("https://the-trivia-api.com/v2/questions");
  url.search = new URLSearchParams({tags:tag,limit:"20"}).toString();
  const res = await fetch(url, {signal:AbortSignal.timeout(10000)});
  if (!res.ok) throw new Error("Question service unavailable");
  const raw: unknown = await res.json();
  const questions = [];
  const seen = new Set<string>();
  for (const value of Array.isArray(raw) ? raw : []) {
    const parsed = entry.safeParse(value);
    if (!parsed.success) continue;
    const q = parsed.data;
    const prompt = q.question.text;
    if (!q.tags.includes(tag) || seen.has(prompt.toLowerCase()) ||
        /\b(french|spanish|german|italian|portuguese|japanese|russian|latin|mandarin)\b/i.test(prompt)) continue;
    const options = shuffled([q.correctAnswer,...q.incorrectAnswers]);
    if (new Set(options.map(o=>o.toLowerCase())).size !== options.length) continue;
    seen.add(prompt.toLowerCase());
    questions.push({ prompt, options, correct:options.indexOf(q.correctAnswer), explanation:"" });
  }
  if (questions.length < summary.questions) throw new Error("Too few eligible questions");
  return { ...summary, audio:null, passage:"Choose one answer for each question.", questions:shuffled(questions).slice(0,summary.questions) };
}

const scienceRow = z.object({
  support: z.string().trim().min(60).max(1800), question: z.string().trim().min(5),
  correct_answer: z.string().trim().min(1), distractor1: z.string().trim().min(1),
  distractor2: z.string().trim().min(1), distractor3: z.string().trim().min(1),
});

async function loadReading() {
  const url = new URL("https://datasets-server.huggingface.co/rows");
  // The published SciQ test split contains 1,000 rows.
  url.search = new URLSearchParams({dataset:"allenai/sciq", config:"default", split:"test",
    offset:String(randomInt(941)), length:"60"}).toString();
  const response = await fetch(url, { signal:AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("Reading service unavailable");
  const {rows} = z.object({rows:z.array(z.object({row:z.unknown()}))}).parse(await response.json());
  const questions = [];
  const seen = new Set<string>();
  for (const item of shuffled(rows)) {
    const parsed = scienceRow.safeParse(item.row);
    if (!parsed.success) continue;
    const q = parsed.data;
    if (seen.has(q.question) || !q.support.toLowerCase().includes(q.correct_answer.toLowerCase()) ||
        /figure|diagram|image below|table below/i.test(q.support + q.question)) continue;
    const options = shuffled([q.correct_answer,q.distractor1,q.distractor2,q.distractor3]);
    if (new Set(options.map(s => s.toLowerCase())).size !== 4) continue;
    seen.add(q.question);
    questions.push({context:q.support, prompt:q.question, options, correct:options.indexOf(q.correct_answer), explanation:""});
    if (questions.length === readingSummary.questions) break;
  }
  if (questions.length < readingSummary.questions) throw new Error("Too few complete passages");
  return {...readingSummary, passage:"Read each short passage and use it to answer the question.", audio:null, questions};
}

export const soundSets = [
  ["ship","sheep","shop","shape"], ["coat","goat","code","cold"],
  ["light","right","late","rate"], ["fan","van","fin","vine"],
  ["seat","sit","set","sat"], ["pull","pool","pole","pale"],
  ["cap","cup","cab","cub"], ["bed","bad","bud","bird"]
];
const clip = z.object({
  audio:z.string().startsWith("https://api.dictionaryapi.dev/media/pronunciations/en/"),
  sourceUrl:z.string().startsWith("https://commons.wikimedia.org/"),
  license:z.object({name:z.string(),url:z.string().startsWith("https://creativecommons.org/")})
});

async function loadListening() {
  const responses = await Promise.allSettled(shuffled(soundSets).map(async choices => {
    const options = shuffled(choices);
    const correct = randomInt(options.length);
    const response = await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + options[correct],
      {signal:AbortSignal.timeout(3500)});
    if (!response.ok) return null;
    const entries = z.array(z.object({phonetics:z.array(z.unknown())})).safeParse(await response.json());
    if (!entries.success) return null;
    const recording = entries.data.flatMap(e=>e.phonetics).map(p=>clip.safeParse(p)).find(p=>p.success);
    if (!recording?.success) return null;
    const {audio,sourceUrl,license} = recording.data;
    return {recording:{audio,sourceUrl,license}, options,correct,explanation:""};
  }));
  const questions = responses.flatMap(r => r.status === "fulfilled" && r.value ? [r.value] : [])
    .slice(0,listeningSummary.questions).map((item,index) => ({
      ...item, prompt: "Recording " + (index+1) + " · Which word do you hear?",
    }));
  if (questions.length < listeningSummary.questions) throw new Error("Not enough recordings");
  return {...listeningSummary, passage:"Play each recording and choose the word you hear.", audio:null, questions};
}
