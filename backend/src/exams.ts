import { recordStudy } from './study.js';
import { officialPapers } from "./services/officialPapers.js";
import { liveQuizzes, loadLiveQuiz, soundSets } from "./services/grammarExam.js";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { Router, type RequestHandler, type Response } from "express";
import reserved from "./data/quiz-reserve.json" with { type: "json" };
import type { ExamAttempt, PrismaClient } from "@prisma/client";

type Question = { recording?: {audio:string; sourceUrl:string; license:{name:string;url:string}}; context?: string; prompt: string; options: string[]; correct: number; explanation: string };
type Exam = { paper?: (typeof officialPapers)[number]["paper"]; savedSet?: boolean; id: string; title: string; tags: string[]; durationMin: number; audio: string | null; passage: string; questions: Question[] };
const catalog: Exam[] = officialPapers;
const reserve: Exam[] = reserved;
const ok = (res: Response, data: unknown) => res.json({success:true,data});
const failure = (res: Response, status: number, message: string) =>
  res.status(status).json({error:{status,message}});

export function examRoutes(prisma: PrismaClient, authenticateToken: RequestHandler) {
  const router = Router();

  // Only fixed dictionary audio paths can be requested through this endpoint.
  const media = new Map<string, {word:string; upstream:string}>();
  const clipKey = (url: string) => createHash("sha256").update(url).digest("hex").slice(0,24);
  for (const word of soundSets.flat()) {
    for (const accent of ["us","uk","au","ca","nz",""]) {
      const upstream = "https://api.dictionaryapi.dev/media/pronunciations/en/" + word + (accent ? "-" + accent : "") + ".mp3";
      media.set(clipKey(upstream), {word,upstream});
    }
  }

  router.get("/audio/:key", async (req,res) => {
    const clip = media.get(req.params.key);
    if (!clip) return res.sendStatus(404);
    try {
      const response = await fetch(clip.upstream, {signal:AbortSignal.timeout(3000)});
      if (response.ok && response.headers.get("content-type")?.startsWith("audio/")) {
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length) return res.type("audio/mpeg").set("Cache-Control","public, max-age=86400").send(bytes);
      }
    } catch { /* Play the bundled English voice when the provider is unavailable. */ }
    return res.sendFile(resolve("preview-media/quiz", clip.word + ".wav"));
  });

  function summary(exam: Exam) {
    return { paper:exam.paper, id: exam.id, title: exam.title, tags: exam.tags, durationMin: exam.durationMin, questions: exam.questions.length };
  }

  function view(attempt: ExamAttempt) {
    const exam = attempt.snapshot as unknown as Exam;
    const submitted = attempt.submittedAt !== null;
    return {
      paper: exam.paper, savedSet: exam.savedSet ?? false,
      id: attempt.id, examId: exam.id, title: exam.title, audio: exam.audio, passage: exam.passage,
      answers: attempt.answers, revision: attempt.revision, expiresAt: attempt.expiresAt, serverTime: new Date(),
      correct: attempt.correct, submittedAt: attempt.submittedAt,
      questions: exam.questions.map(({ recording, context, prompt, options, correct, explanation }) => {
        let playback = recording;
        if (recording) {
          const upstream = media.has(clipKey(recording.audio)) ? recording.audio :
            "https://api.dictionaryapi.dev/media/pronunciations/en/" + options[correct] + "-us.mp3";
          playback = {...recording, audio:"/api/exams/audio/" + clipKey(upstream)};
        }
        const question = {recording:playback, context, prompt, options};
        return submitted ? {...question,correct,explanation} : question;
      }),
    };
  }

  async function finish(attempt: ExamAttempt): Promise<ExamAttempt> {
    const exam = attempt.snapshot as unknown as Exam;
    const correct = exam.questions.filter((q, index) => q.correct === attempt.answers[index]).length;
    const updated = await prisma.$transaction(async tx => {
      const change = await tx.examAttempt.updateMany({
        where: { id: attempt.id, revision: attempt.revision, submittedAt: null },
        data: { submittedAt: new Date(), openKey: null, correct, revision: { increment: 1 } },
      });
      if (change.count) await recordStudy(tx, attempt.userId);
      return change;
    });
    const latest = await prisma.examAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    if (!updated.count && !latest.submittedAt) return finish(latest);
    return latest;
  }

  async function current(attempt: ExamAttempt) {
    return !attempt.submittedAt && attempt.expiresAt.getTime() <= Date.now() ? finish(attempt) : attempt;
  }

  router.get("/", (_req, res) => ok(res, [...catalog.map(summary), ...liveQuizzes]));
  router.get("/history", authenticateToken, async (req, res) => {
    const rows = await prisma.examAttempt.findMany({ where: { userId: res.locals.user.id }, orderBy: { startedAt: "desc" }, take: 100 });
    const attempts = await Promise.all(rows.map(current));
    ok(res, attempts.map(a => ({ id: a.id, examId: a.examId, title: (a.snapshot as unknown as Exam).title,
      correct: a.correct, total: a.answers.length, startedAt: a.startedAt })));
  });
  router.get("/:examId", (req, res) => {
    const live = liveQuizzes.find(s => s.id === req.params.examId);
    if (live) return ok(res, live);
    const exam = catalog.find(e => e.id === req.params.examId);
    if (!exam) return failure(res, 404, "Không tìm thấy đề thi.");
    ok(res, summary(exam));
  });
  router.post("/:examId/start", authenticateToken, async (req, res) => {
    const examId = req.params.examId;
    if (typeof examId !== "string") return failure(res, 404, "Không tìm thấy đề thi.");
    const openKey = res.locals.user.id + "/" + examId;
    const existing = await prisma.examAttempt.findUnique({ where: { openKey } });
    if (existing) {
      const active = await current(existing);
      if (!active.submittedAt) return ok(res, view(active));
    }
    let exam = catalog.find(e => e.id === examId);
    if (liveQuizzes.some(q => q.id === examId)) {
      try { exam = await loadLiveQuiz(examId); }
      catch {
        const saved = reserve.find(q => q.id === examId);
        if (!saved) return failure(res, 503, "Tạm thời không tải được câu hỏi.");
        exam = {...saved, savedSet:true};
      }
    }
    if (!exam) return failure(res, 404, "Không tìm thấy đề thi.");
    const attempt = await prisma.examAttempt.upsert({ where: { openKey }, update: { openKey },
      create: { userId: res.locals.user.id, examId: exam.id, openKey, snapshot: exam, answers: exam.questions.map(() => -1),
        expiresAt: new Date(Date.now() + exam.durationMin * 60000) } });
    ok(res, view(attempt));
  });
  router.use("/attempts/:id", authenticateToken, async (req, res, next) => {
    const id = req.params.id;
    if (typeof id !== "string") return failure(res, 404, "Không tìm thấy lượt làm bài.");
    const row = await prisma.examAttempt.findFirst({ where: { id, userId: res.locals.user.id } });
    if (!row) return failure(res, 404, "Không tìm thấy lượt làm bài.");
    res.locals.attempt = await current(row);
    next();
  });
  router.get("/attempts/:id", (_req, res) => ok(res, view(res.locals.attempt)));
  router.put("/attempts/:id/answers", async (req, res) => {
    const attempt: ExamAttempt = res.locals.attempt;
    if (attempt.submittedAt) return ok(res, view(attempt));
    const { question, choice, revision } = req.body ?? {};
    const exam = attempt.snapshot as unknown as Exam;
    if (!Number.isInteger(question) || !Number.isInteger(choice) || !Number.isInteger(revision) ||
        !exam.questions[question]?.options[choice]) return failure(res, 400, "Đáp án không hợp lệ.");
    const answers = [...attempt.answers];
    answers[question] = choice;
    await prisma.examAttempt.updateMany({ where: { id: attempt.id, revision: attempt.revision === revision ? revision : -1, submittedAt: null, expiresAt: { gt: new Date() } },
      data: { answers, revision: { increment: 1 } } });
    const latest = await current(await prisma.examAttempt.findUniqueOrThrow({ where: { id: attempt.id } }));
    ok(res, view(latest));
  });
  router.post("/attempts/:id/submit", async (_req, res) => {
    const row: ExamAttempt = res.locals.attempt;
    ok(res, view(row.submittedAt ? row : await finish(row)));
  });
  return router;
}
