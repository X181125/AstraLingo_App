export type User = { id: string; name: string; email: string; nativeLang: string; targetLang: string; level: string };
export type Category = { id: string; name: string; icon: string; color: string; _count?: { courses: number } };
export type Lesson = { id: string; title: string; minutes: number; contentType: string; preview: string };
export type Course = { id: string; title: string; description: string; category: Category; categoryId: string; level: string; language: string; minutes: number; lessonsCount: number; accent: string; illustration: string; featured: boolean; lessons?: Lesson[] };
export type Enrollment = { courseId: string; createdAt: string; course: Course };
