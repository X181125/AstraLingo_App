import React, { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Button } from '../../components/UI';
import { ActionNotice, Answers, Copy, LearningScreen, Panel, Pending, Questions, Section, useAction, useFocusedData } from '../../components/Learning';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { duration, type AnswerResult, type Question } from '../../src/learning';

type Quiz = { id: string; mode: 'QUIZ' | 'EXAM'; questions: Question[]; expiresAt: string | null; result?: AnswerResult | null };
type History = Omit<Quiz, 'questions'> & { createdAt: string };

export default function QuizScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { token } = useAuth();
  const [quiz, setQuiz] = useState<Quiz>();
  const [answers, setAnswers] = useState<number[]>([]);
  const [now, setNow] = useState(Date.now());
  const action = useAction();
  const history = useFocusedData<History[]>('/study/quizzes');
  const seconds = quiz?.expiresAt ? (Date.parse(quiz.expiresAt) - now) / 1000 : null;
  useEffect(() => {
    if (!quiz?.expiresAt || quiz.result) return;
    const handle = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(handle);
  }, [quiz?.expiresAt, quiz?.result]);
  const exam = quiz ? quiz.mode === 'EXAM' : mode === 'EXAM';
  return <LearningScreen title={exam ? 'Thi trực tuyến' : 'Mini Quiz'} back
    subtitle={exam ? 'Bài thi có 10 phút kể từ khi bắt đầu. Nộp bài trước khi hết giờ.' : 'Năm câu hỏi, có đáp án và giải thích sau khi nộp.'}>
    <ActionNotice action={action} />
    {!quiz && <Button label="Bắt đầu làm bài" loading={action.busy} onPress={() => void action.run(async () => {
      const next = await api<Quiz>('/study/quizzes', { token, method: 'POST', body: { mode: exam ? 'EXAM' : 'QUIZ' } });
      setNow(Date.now()); setAnswers([]); setQuiz(next); history.reload();
    })} />}
    {quiz?.result && <Answers result={quiz.result} />}
    {quiz && !quiz.result && <>
      {seconds !== null && <Copy>{seconds > 0 ? `Thời gian còn lại ${duration(Math.ceil(seconds))}` : 'Bài đã hết giờ.'}</Copy>}
      <Questions questions={quiz.questions} selections={answers} onChange={setAnswers} />
      <Button label="Nộp bài" loading={action.busy} disabled={seconds !== null && seconds <= 0} onPress={() => void action.run(async () => {
        const result = await api<AnswerResult>(`/study/quizzes/${quiz.id}/submit`, {
          token, method: 'POST', body: { answers: quiz.questions.map((_, i) => answers[i] ?? -1) },
        });
        setQuiz({ ...quiz, result }); history.reload();
      })} />
    </>}
    {quiz && <Button label="Về danh sách lượt làm" secondary disabled={action.busy} onPress={() => setQuiz(undefined)} />}
    {!quiz && <Section title="Lịch sử làm bài">
      <Pending {...history} />
      {history.data?.length === 0 && <Copy>Chưa có lượt làm nào.</Copy>}
      {history.data?.map(item => <Panel key={item.id}>
        <Copy>{item.mode === 'EXAM' ? 'Thi trực tuyến' : 'Mini Quiz'} · {new Date(item.createdAt).toLocaleString('vi-VN')}</Copy>
        <Copy>{item.result ? `Điểm ${item.result.score}/100` : item.expiresAt && Date.parse(item.expiresAt) <= Date.now() ? 'Đã hết giờ' : 'Chưa nộp'}</Copy>
        <Button label={item.result ? 'Xem đáp án' : 'Mở lượt làm'} secondary disabled={action.busy} onPress={() => void action.run(async () => {
          const next = await api<Quiz>(`/study/quizzes/${item.id}`, { token }); setNow(Date.now()); setAnswers([]); setQuiz(next);
        })} />
      </Panel>)}
    </Section>}
  </LearningScreen>;
}
