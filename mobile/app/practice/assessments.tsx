import { View } from 'react-native';
import { Text } from '@/components/typography';
import { useAppColors } from '@/src/theme';
import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  LearningScreen,
  Section,
  Panel,
  Copy,
  Input,
  Choice,
  Pending,
  ActionNotice,
  useAction,
  useFocusedData,
} from '@/components/Learning';
import { Button } from '@/components/UI';
import { useAuth } from '@/src/auth';
import { api } from '@/src/api';

type SetInfo = { id: number; title: string; isActive: boolean; questionCount: number };
type Question = {
  id: number;
  questionType: string;
  questionText: string;
  options: { id: number; optionText: string }[];
};
type Run = { id: number; questions: Question[]; finishedAt: string | null; score: number | null };
type Result = {
  score: number;
  correctCount: number;
  totalGradable: number;
  questions: { questionId: number; isCorrect: boolean; explanation: string | null }[];
};
type Response = { attempt: Run; result: Result | null };
type Selection = { questionId: number; selectedOptionId?: number; answerText?: string };
const emptyQuestion = () => ({ prompt: '', answer: '', other: '' });

export default function AssessmentSets() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind: string }>();
  return <AssessmentWorkspace id={id} kind={kind} />;
}

export function AssessmentWorkspace({
  id,
  kind,
  screen,
  target,
  assessmentId,
  footer,
}: {
  id: string;
  kind: string;
  screen?: string;
  target?: string;
  assessmentId?: string;
  footer?: React.ReactNode;
}) {
  const c = useAppColors();
  const { token, user } = useAuth();
  const action = useAction();
  const item = useFocusedData<{ authorId: string | null; title: string }>('/content-items/' + id);
  const group = kind === 'listening' ? 'listening' : 'reading';
  const prefix = '/' + (group === 'listening' ? 'listening-audios' : 'reading-passages') + '/' + id;
  const sets = useFocusedData<SetInfo[]>(prefix + '/assessments');
  const history = useFocusedData<Run[]>(prefix + '/attempts/mine');
  const [run, setRun] = useState<Run>();
  const [result, setResult] = useState<Result | null>(null);
  const [choices, setChoices] = useState<Record<number, Selection>>({});
  const [title, setTitle] = useState('');
  const [draft, setDraft] = useState([emptyQuestion()]);
  const [showEditor, edit] = useState(target === 'create');
  const capabilities = useFocusedData<{ gemini: boolean }>('/learn/ai/capabilities');
  async function open(attempt: Run) {
    const detail = await api<Response & { attempt: Run & { answersJson?: Selection[] } }>(
      '/' + group + '-attempts/' + attempt.id,
      { token },
    );
    setRun(detail.attempt);
    setResult(detail.result);
    setChoices(Object.fromEntries((detail.attempt.answersJson ?? []).map((a) => [a.questionId, a])));
  }
  const owner = !!user && item.data?.authorId === user.id;
  function update(index: number, patch: Partial<ReturnType<typeof emptyQuestion>>) {
    setDraft((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  const objectiveHistory = ['result', 'review', 'progress', 'attempts'].includes(screen ?? '');
  const chooseRun = target && /^\d+$/.test(target) ? Number(target) : undefined;
  useEffect(() => {
    if (!objectiveHistory || !history.data?.length) return;
    const entry = chooseRun
      ? history.data.find((row) => row.id === chooseRun)
      : ['result', 'review'].includes(screen ?? '')
        ? history.data.find((row) => row.finishedAt)
        : undefined;
    if (entry) void action.run(() => open(entry));
  }, [chooseRun, screen, history.data]);
  const titles: Record<string, string> = {
    assessments: 'Assessments',
    quiz: 'Reading Quiz',
    attempt: 'Assessment Questions',
    attempts: 'Attempts',
    result: 'Result',
    review: 'Answer Review',
    progress: 'Progress & History',
    questions: 'Manage Questions',
    assessment: 'Manage Assessments',
  };
  const setId =
    screen === 'assessments' && chooseRun
      ? String(chooseRun)
      : screen === 'questions'
        ? assessmentId
        : undefined;
  if (setId)
    return (
      <SetDetail
        id={setId}
        lessonId={id}
        group={group}
        editAllowed={owner}
        editMode={screen === 'questions' || (target !== undefined && assessmentId === 'edit')}
      />
    );
  return (
    <LearningScreen
      title={
        target === 'create' ? 'Create Assessment' : (titles[screen ?? ''] ?? item.data?.title ?? 'Bộ câu hỏi')
      }
      subtitle={item.data?.title}
      back
    >
      <Pending {...item} />
      <ActionNotice action={action} />
      {run ? (
        <>
          <Section
            title={
              result
                ? `${result.correctCount}/${result.totalGradable} câu đúng · ${result.score}/100`
                : 'Làm bài'
            }
          >
            {result ? (
              <Panel>
                <View style={{ alignItems: 'center', gap: 12, paddingVertical: 12 }}>
                  <View
                    style={{
                      width: 105,
                      height: 105,
                      borderRadius: 53,
                      borderWidth: 7,
                      borderColor: c.purple,
                      backgroundColor: c.lavender,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 34, fontWeight: '700', color: c.purpleDark }}>
                      {result.score}
                    </Text>
                    <Text style={{ color: c.muted }}>/ 100</Text>
                  </View>
                  <Copy>
                    {result.correctCount} correct · {Math.max(result.totalGradable - result.correctCount, 0)}{' '}
                    incorrect
                  </Copy>
                </View>
              </Panel>
            ) : (
              <Panel>
                <Copy>
                  {Object.keys(choices).length} / {run.questions.length} answered
                </Copy>
              </Panel>
            )}
            {result && group === 'listening' && capabilities.data?.gemini && (
              <ListeningAnalysis key={run.id} attemptId={run.id} />
            )}
            {run.questions.map((q) => (
              <Panel key={q.id}>
                <Copy>
                  {q.id}. {q.questionText}
                </Copy>
                {result ? (
                  <Copy>
                    {result.questions.find((x) => x.questionId === q.id)?.isCorrect ? 'Đúng' : 'Chưa đúng'} ·{' '}
                    {result.questions.find((x) => x.questionId === q.id)?.explanation}
                  </Copy>
                ) : ['MCQ', 'TF'].includes(q.questionType) ? (
                  q.options.map((o) => (
                    <Choice
                      key={o.id}
                      label={o.optionText}
                      selected={choices[q.id]?.selectedOptionId === o.id}
                      onPress={() =>
                        setChoices((prev) => ({
                          ...prev,
                          [q.id]: { questionId: q.id, selectedOptionId: o.id },
                        }))
                      }
                    />
                  ))
                ) : (
                  <Input
                    label="Câu trả lời"
                    value={choices[q.id]?.answerText ?? ''}
                    onChangeText={(answerText) =>
                      setChoices((prev) => ({ ...prev, [q.id]: { questionId: q.id, answerText } }))
                    }
                  />
                )}
              </Panel>
            ))}
            {!result && (
              <Button
                label="Nộp bộ câu hỏi"
                loading={action.busy}
                onPress={() =>
                  void action.run(async () => {
                    const saved = await api<Response>('/' + group + '-attempts/' + run.id + '/submit', {
                      method: 'PATCH',
                      token,
                      body: { answers: Object.values(choices) },
                    });
                    setRun(saved.attempt);
                    setResult(saved.result);
                    history.reload();
                  })
                }
              />
            )}
            <Button
              label="Về danh sách bộ câu hỏi"
              secondary
              disabled={action.busy}
              onPress={() =>
                void action.run(async () => {
                  if (!result)
                    await api('/' + group + '-attempts/' + run.id + '/answers', {
                      method: 'PATCH',
                      token,
                      body: { answers: Object.values(choices) },
                    });
                  setRun(undefined);
                  history.reload();
                })
              }
            />
          </Section>
        </>
      ) : (
        <>
          {!objectiveHistory && target !== 'create' && (
            <Section title="Chọn bộ câu hỏi">
              <Pending {...sets} />
              {sets.data?.length === 0 && <Copy>Bài này chưa có bộ câu hỏi.</Copy>}
              {sets.data?.map((s) => (
                <Panel key={s.id}>
                  <Copy>
                    {s.title} · {s.questionCount} câu{s.isActive ? ' · Đang dùng' : ''}
                  </Copy>
                  {screen && (
                    <Button
                      secondary
                      label={screen === 'questions' ? 'Edit questions' : 'View detail'}
                      onPress={() =>
                        router.push(
                          '/study/content/' +
                            group +
                            '/' +
                            id +
                            '/assessments/' +
                            (screen === 'questions' ? 'edit/' : '') +
                            s.id,
                        )
                      }
                    />
                  )}
                  <Button
                    label="Bắt đầu làm bộ này"
                    disabled={action.busy}
                    onPress={() =>
                      void action.run(async () => {
                        setRun(
                          await api<Run>(prefix + '/attempts', {
                            method: 'POST',
                            token,
                            body: { assessmentId: s.id },
                          }),
                        );
                        setResult(null);
                        setChoices({});
                        history.reload();
                      })
                    }
                  />
                  {owner && !s.isActive && (
                    <Button
                      label="Đặt làm bộ chính"
                      secondary
                      disabled={action.busy}
                      onPress={() =>
                        void action.run(async () => {
                          await api('/' + group + '-assessments/' + s.id + '/active', {
                            method: 'PATCH',
                            token,
                          });
                          sets.reload();
                        })
                      }
                    />
                  )}
                </Panel>
              ))}
            </Section>
          )}
          {target === 'create' && item.data && !owner && <Copy>Only the author can create assessments.</Copy>}
          {owner && !objectiveHistory && (
            <Section title="Soạn đề">
              <Button
                label={showEditor ? 'Đóng trình soạn' : 'Tạo bộ câu hỏi'}
                secondary
                onPress={() => edit((v) => !v)}
              />
              {showEditor && (
                <>
                  <Input label="Tên bộ câu hỏi" value={title} onChangeText={setTitle} />
                  {draft.map((q, i) => (
                    <Panel key={i}>
                      <Input
                        label={`Câu hỏi ${i + 1}`}
                        value={q.prompt}
                        onChangeText={(prompt) => update(i, { prompt })}
                      />
                      <Input
                        label="Đáp án đúng"
                        value={q.answer}
                        onChangeText={(answer) => update(i, { answer })}
                      />
                      <Input
                        label="Phương án còn lại"
                        value={q.other}
                        onChangeText={(other) => update(i, { other })}
                      />
                    </Panel>
                  ))}
                  <Button
                    label="Thêm câu hỏi"
                    secondary
                    disabled={draft.length >= 40}
                    onPress={() => setDraft((rows) => [...rows, emptyQuestion()])}
                  />
                  <Button
                    label="Lưu bộ câu hỏi"
                    loading={action.busy}
                    disabled={
                      !title.trim() ||
                      draft.some((q) => !q.prompt.trim() || !q.answer.trim() || !q.other.trim())
                    }
                    onPress={() =>
                      void action.run(async () => {
                        const questions = draft.map((q, i) => ({
                          questionType: 'MCQ',
                          questionText: q.prompt,
                          options:
                            i % 2
                              ? [
                                  { optionText: q.answer, isCorrect: true },
                                  { optionText: q.other, isCorrect: false },
                                ]
                              : [
                                  { optionText: q.other, isCorrect: false },
                                  { optionText: q.answer, isCorrect: true },
                                ],
                        }));
                        await api(prefix + '/assessments', {
                          method: 'POST',
                          token,
                          body: { title, questions },
                        });
                        setTitle('');
                        setDraft([emptyQuestion()]);
                        edit(false);
                        sets.reload();
                      })
                    }
                  />
                </>
              )}
              {capabilities.data?.gemini && (
                <Button
                  label="Tạo bộ câu hỏi bằng AI"
                  secondary
                  loading={action.busy}
                  onPress={() =>
                    void action.run(async () => {
                      await api(prefix + '/assessments/generate', {
                        method: 'POST',
                        token,
                        body: {},
                        timeoutMs: 55000,
                      });
                      sets.reload();
                    })
                  }
                />
              )}
            </Section>
          )}
          {(!screen || objectiveHistory) && (
            <Section title="Lượt làm gần đây">
              <Pending {...history} />
              {history.data?.length === 0 && <Copy>Bạn chưa làm bộ câu hỏi nào của bài này.</Copy>}
              {history.data?.map((r) => (
                <Button
                  key={r.id}
                  label={r.finishedAt ? `Xem kết quả lượt ${r.id} · ${r.score}/100` : `Tiếp tục lượt ${r.id}`}
                  secondary
                  disabled={action.busy}
                  onPress={() => void action.run(() => open(r))}
                />
              ))}
            </Section>
          )}
        </>
      )}
      {footer}
    </LearningScreen>
  );
}

type SetQuestion = {
  id: number;
  questionType: string;
  questionText: string;
  explanation?: string | null;
  answerText?: string;
  options: { id: number; optionText: string; isCorrect?: boolean }[];
};
function SetDetail({
  id,
  lessonId,
  group,
  editAllowed,
  editMode,
}: {
  id: string;
  lessonId: string;
  group: string;
  editAllowed: boolean;
  editMode: boolean;
}) {
  const path = '/' + group + '-assessments/' + id,
    { token } = useAuth(),
    action = useAction();
  const data = useFocusedData<{
    title: string;
    questions: SetQuestion[];
    passageId: number;
    audioId: number;
  }>(path);
  const [draft, setDraft] = useState<SetQuestion[]>(),
    [title, setTitle] = useState<string>();
  const row = data.data,
    rows = draft ?? row?.questions ?? [],
    editing = editMode && editAllowed;
  if (row && String(row.passageId ?? row.audioId) !== lessonId)
    return (
      <LearningScreen title="Assessment" back>
        <Copy>This set belongs to another lesson.</Copy>
      </LearningScreen>
    );
  function change(index: number, patch: Partial<SetQuestion>) {
    setDraft(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  return (
    <LearningScreen title={editMode ? 'Edit Assessment' : 'Assessment Detail'} subtitle={row?.title} back>
      <Pending {...data} />
      <ActionNotice action={action} />
      {editMode && !editAllowed && <Copy>Only the author can edit this set.</Copy>}
      {editing && <Input label="Title" value={title ?? row?.title ?? ''} onChangeText={setTitle} />}
      {rows.map((q, i) => (
        <Panel key={q.id}>
          {editing ? (
            <Input
              label={'Question ' + (i + 1)}
              value={q.questionText}
              onChangeText={(questionText) => change(i, { questionText })}
            />
          ) : (
            <Copy>
              {i + 1}. {q.questionText}
            </Copy>
          )}
          {q.options.map((o, j) =>
            editing ? (
              <Input
                key={o.id}
                label={'Option ' + (j + 1) + (o.isCorrect ? ' · correct' : '')}
                value={o.optionText}
                onChangeText={(optionText) =>
                  change(i, { options: q.options.map((v, k) => (j === k ? { ...v, optionText } : v)) })
                }
              />
            ) : (
              <Copy key={o.id}>{o.optionText}</Copy>
            ),
          )}
        </Panel>
      ))}
      {editing && row && (
        <Button
          label="Save changes"
          loading={action.busy}
          onPress={() =>
            void action.run(async () => {
              await api(path, {
                method: 'PATCH',
                token,
                body: {
                  title: title ?? row.title,
                  questions: rows.map((q) => ({
                    ...q,
                    options: q.options.length ? q.options : undefined,
                    answerText: q.answerText ?? undefined,
                  })),
                },
              });
              data.reload();
              action.setSuccess('Saved.');
            })
          }
        />
      )}
    </LearningScreen>
  );
}

function ListeningAnalysis({ attemptId }: { attemptId: number }) {
  const { token } = useAuth();
  const action = useAction();
  const [feedback, setFeedback] = useState('');
  return (
    <Panel>
      <Button
        label="Phân tích điểm yếu bài nghe"
        secondary
        loading={action.busy}
        onPress={() =>
          void action.run(async () => {
            const result = await api<{ text: string }>(`/listening-attempts/${attemptId}/weakness-analysis`, {
              method: 'POST',
              token,
              timeoutMs: 55_000,
            });
            setFeedback(result.text);
          })
        }
      />
      <ActionNotice action={action} />
      {!!feedback && <Copy selectable>{feedback}</Copy>}
    </Panel>
  );
}
