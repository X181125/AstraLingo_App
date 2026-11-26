import source from "../data/sat-reading-writing.json" with { type: "json" };

type PaperKey = { number: number; modules: [string, string]; modulePages: number[] };
const keys = source as PaperKey[];
const publisher = "https://satsuite.collegeboard.org/media/pdf";

export const officialPapers = keys.map(({ number, modules, modulePages }) => ({
  id: `sat-paper-${number}`,
  title: `SAT Practice Test ${number} · Reading and Writing`,
  tags: ["SAT", "College Board"],
  durationMin: 78,
  paper: {
    url: `${publisher}/sat-practice-test-${number}-digital.pdf`,
    solutions: `${publisher}/sat-practice-test-${number}-answers-digital.pdf`,
    modulePages,
    moduleSize: modules[0].length,
  },
  passage: "Read the questions in the official College Board booklet. Record your choices here for both Reading and Writing modules.",
  audio: null,
  questions: modules.flatMap((key, module) => Array.from(key, (answer, index) => ({
    prompt: `Module ${module + 1} · Question ${index + 1}`,
    options: ["A", "B", "C", "D"],
    correct: "ABCD".indexOf(answer),
    explanation: "",
  }))),
}));
