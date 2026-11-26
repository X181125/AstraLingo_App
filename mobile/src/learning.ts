export const skills = ['READING', 'LISTENING', 'SPEAKING', 'WRITING'] as const;
export type Skill = typeof skills[number];
export const skillName: Record<Skill, string> = {
  READING: 'Đọc hiểu', LISTENING: 'Nghe hiểu', SPEAKING: 'Luyện nói', WRITING: 'Luyện viết',
};
export const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const languages = ['vi', 'en', 'other'];
export const languageName: Record<string, string> = { vi: 'Tiếng Việt', en: 'Tiếng Anh', other: 'Ngôn ngữ khác' };
export type Page<T> = { items: T[]; hasMore: boolean };
export type Question = { prompt: string; options: string[] };
export type EditableQuestion = Question & { answer: number; explanation: string };
export type AnswerResult = { score: number; correct: number; total: number; details: (EditableQuestion & { selected: number; correct: boolean })[] };
export type Feedback = { score: number; strengths: string[]; improvements: string[]; criteria: { name: string; score: number; comment: string }[]; segments: { second: number; comment: string }[] };
export type Transcript = { second: number; text: string };
export type Status = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type StudyLesson = { id: string; courseId: string; title: string; contentType: Skill; status: Status; ownerId?: string | null; isPublic: boolean; preview: string };
export type Practice = StudyLesson & { publicId: number; body: string; audioUrl?: string; audioId?: string; transcript: Transcript[]; questions: Question[] };
export type Attempt = { id: string; publicId: number; mode: string; state: 'DRAFT' | 'SUBMITTED' | 'COMPLETED'; response: { text?: string; audioId?: string; answers?: number[] }; feedback?: Feedback | AnswerResult | null; score?: number | null; updatedAt: string };
export type Annotation = { id: string; kind: 'HIGHLIGHT' | 'NOTE' | 'BOOKMARK'; quote: string; note: string };
export type Word = { word: string; meaning: string; example?: string };
export type CardInput = { front: string; back: string };
export type Card = CardInput & { id: string; reviews: { box: number; nextReview: string }[] };
export type Deck = { id: string; title: string; ownerId: string; isPublic: boolean; _count?: { cards: number }; cards?: Card[] };

export function duration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
