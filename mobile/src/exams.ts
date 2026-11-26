import { api, ApiError } from "./api";

type Paper = { url: string; solutions: string; modulePages: number[]; moduleSize: number };
export type ExamSummary = { paper?: Paper; id: string; title: string; durationMin: number; questions: number; tags: string[] };
export type Attempt = {
  paper?: Paper;
  id: string; examId: string; savedSet?: boolean; title: string; passage: string; audio: string | null;
  expiresAt: string; serverTime: string; submittedAt: string | null; correct: number | null; revision: number; answers: number[];
  questions: { recording?: {audio:string;sourceUrl:string;license:{name:string;url:string}}; context?: string; prompt: string; options: string[]; correct?: number; explanation?: string }[];
};
export type HistoryItem = { id: string; examId: string; title: string; startedAt: string; correct: number | null; total: number };
export function createExamApi(token: string | null) {
  const request = <T>(path: string, method = "GET", body?: object) =>
    api<T>("/exams" + path, {token, method, body});
  return {
    list: () => request<ExamSummary[]>(""),
    detail: (id: string) => request<ExamSummary>("/" + encodeURIComponent(id)),
    start: (id: string) => request<Attempt>("/" + encodeURIComponent(id) + "/start", "POST"),
    attempt: (id: string) => request<Attempt>("/attempts/" + encodeURIComponent(id)),
    answer: (id: string, question: number, choice: number, revision: number) =>
      request<Attempt>("/attempts/" + encodeURIComponent(id) + "/answers", "PUT", {question, choice, revision}),
    submit: (id: string) => request<Attempt>("/attempts/" + encodeURIComponent(id) + "/submit", "POST"),
    history: () => request<HistoryItem[]>("/history"),
  };
}
export function requiresLogin(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}
