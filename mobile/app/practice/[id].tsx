import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ActionNotice, Answers, Choices, Copy, Highlighted, Input, LearningScreen, Panel, Pending, Questions, Section, useAction, useFocusedData, useLearningColors } from '../../components/Learning';
import { Listen, Recorder } from '../../components/PracticeAudio';
import { Button } from '../../components/UI';
import { api } from '../../src/api';
import { uploadRecording, type Recording } from '../../src/audio';
import { useAuth } from '../../src/auth';
import { duration, skillName, type Annotation, type AnswerResult, type Attempt, type Feedback, type Practice, type StudyLesson } from '../../src/learning';

const markTypes = ['HIGHLIGHT', 'NOTE', 'BOOKMARK'] as const;
const markName = { HIGHLIGHT: 'Tô sáng', NOTE: 'Ghi chú', BOOKMARK: 'Đánh dấu' };

export default function PracticeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const path = id && `/study/lessons/${encodeURIComponent(id)}`;
  const lesson = useFocusedData<Practice>(path || null);
  return <LearningScreen title={lesson.data?.title ?? 'Bài luyện'} subtitle={lesson.data && skillName[lesson.data.contentType]} back>
    <Pending {...lesson} />
    {lesson.data && path && <PracticeContent key={id} lesson={lesson.data} path={path} />}
  </LearningScreen>;
}

function PracticeContent({ lesson, path }: { lesson: Practice; path: string }) {
  const auth = useAuth();
  const action = useAction();
  const attempts = useFocusedData<Attempt[]>(path + '/attempts');
  const marks = useFocusedData<Annotation[]>(['READING', 'LISTENING'].includes(lesson.contentType) ? path + '/annotations' : null);
  const ai = useFocusedData<{ gemini: boolean }>('/learn/ai/capabilities');
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<Attempt>();
  const [text, setText] = useState('');
  const [audio, setAudio] = useState<Recording>();
  const [audioId, setAudioId] = useState<string>();
  const [draftId, setDraftId] = useState<string>();
  const [outline, setOutline] = useState('');
  const [listeningGuide, setListeningGuide] = useState('');
  const [kind, setKind] = useState<Annotation['kind']>('HIGHLIGHT');
  const [quote, setQuote] = useState('');
  const [note, setNote] = useState('');
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState('');
  const c = useLearningColors();
  const objective = ['READING', 'LISTENING'].includes(lesson.contentType);
  const writing = lesson.contentType === 'WRITING';
  const owned = lesson.ownerId === auth.user?.id;
  const published = lesson.status === 'PUBLISHED';
  const highlights = (marks.data ?? []).filter(mark => mark.kind === 'HIGHLIGHT').map(mark => mark.quote);

  function selectAttempt(item: Attempt) {
    setSelected(item);
    if (item.state !== 'DRAFT') return;
    setDraftId(item.id);
    setText(item.response.text ?? '');
    setAudio(undefined);
    setAudioId(item.response.audioId);
  }

  async function save(submit: boolean) {
    let uploaded = audioId;
    if (audio && !uploaded) {
      uploaded = await uploadRecording(auth.token, audio);
      setAudioId(uploaded);
    }
    const data = await api<Attempt>(path + '/submission', { token: auth.token, method: 'POST',
      body: { text, audioId: uploaded, attemptId: draftId, submit } });
    attempts.reload();
    setSelected(data);
    setDraftId(submit ? undefined : data.id);
    if (submit) { setText(''); setAudio(undefined); setAudioId(undefined); }
    action.setSuccess(submit ? 'Đã nộp bài. Bạn có thể xem lại trong lịch sử.' : 'Đã lưu bản nháp.');
  }

  return <>
    <ActionNotice action={action} />
    <Section title={objective ? lesson.contentType === 'READING' ? 'Bài đọc' : 'Âm thanh và transcript' : 'Đề bài'}>
      {lesson.contentType === 'LISTENING'
        ? <Listen body={lesson.body} transcript={lesson.transcript} audioId={lesson.audioId} highlights={highlights} />
        : <Panel><Copy selectable><Highlighted text={lesson.body} quotes={highlights} /></Copy></Panel>}
      {lesson.contentType === 'LISTENING' && ai.data?.gemini && <Button label="Gợi ý luyện nghe và phát âm" secondary disabled={action.busy} onPress={() => void action.run(async () => {
        const result = await api<{ text: string }>('/learn/ai', { token: auth.token, method: 'POST', timeoutMs: 55_000,
          body: { task: 'listening-guide', text: lesson.body } });
        setListeningGuide(result.text);
      })} />}
      {!!listeningGuide && <Panel><Copy selectable>{listeningGuide}</Copy></Panel>}
    </Section>
    {!published && <Panel><Copy>Bản xem trước của bài {lesson.status === 'DRAFT' ? 'nháp' : 'đã lưu trữ'}. Xuất bản để nhận bài làm.</Copy></Panel>}
    {objective && published && lesson.questions.length > 0 && <Section title="Bài đánh giá">
      <Questions questions={lesson.questions} selections={answers} onChange={setAnswers} />
      <Button label="Nộp đáp án" loading={action.busy} onPress={() => void action.run(async () => {
        const item = await api<Attempt>(path + '/assessment', { token: auth.token, method: 'POST',
          body: { answers: lesson.questions.map((_, index) => answers[index] ?? -1) } });
        setSelected(item); attempts.reload();
      })} />
    </Section>}
    {!objective && published && <Section title={writing ? 'Soạn bài viết' : 'Ghi âm và nộp bài'}>
      {writing ? <>
        <Input label="Bài viết của bạn" multiline value={text} onChangeText={setText} maxLength={15_000} editable={!action.busy} />
        <Copy>{text.trim().split(/\s+/).filter(Boolean).length} từ</Copy>
        {ai.data?.gemini && <Button label="Gợi ý ý tưởng và dàn ý AI" secondary disabled={action.busy} onPress={() => void action.run(async () => {
          const result = await api<{ text: string }>('/learn/ai', { token: auth.token, method: 'POST', timeoutMs: 55_000,
            body: { task: 'outline', text: lesson.body } });
          setOutline(result.text);
        })} />}
        {ai.data?.gemini && <Button label="Nhận gợi ý sửa bản nháp" secondary disabled={action.busy || !text.trim()} onPress={() => void action.run(async () => {
          const result = await api<{ text: string }>('/learn/ai', { token: auth.token, method: 'POST', timeoutMs: 55_000,
            body: { task: 'writing-revision', text: `Đề bài: ${lesson.body.slice(0, 3500)}\nBản nháp: ${text.slice(0, 6400)}` } });
          setOutline(result.text);
        })} />}
        {!!outline && <Panel><Copy selectable>{outline}</Copy></Panel>}
      </> : <>
        <Recorder onRecorded={recording => { setAudio(recording); setAudioId(undefined); }} />
        {!!audioId && !audio && <Listen key={audioId} audioId={audioId} />}
      </>}
      <Button label="Lưu bản nháp" secondary loading={action.busy} disabled={!draftId && !text.trim() && !audio && !audioId} onPress={() => void action.run(() => save(false))} />
      <Button label="Nộp bài" loading={action.busy} disabled={writing ? !text.trim() : !audio && !audioId} onPress={() => void action.run(() => save(true))} />
    </Section>}
    <Section title="Lịch sử và kết quả">
      <Pending {...attempts} />
      {attempts.data?.length === 0 && <Copy>Chưa có bài làm.</Copy>}
      {attempts.data?.map(item => <Panel key={item.id}>
        <Copy>{new Date(item.updatedAt).toLocaleString('vi-VN')} · {item.state === 'DRAFT' ? 'Bản nháp' : item.score == null ? 'Đã nộp, chờ chấm' : `${item.score}/100`}</Copy>
        <Button secondary label={item.state === 'DRAFT' ? 'Tiếp tục bản nháp' : 'Xem bài làm'} onPress={() => selectAttempt(item)} />
      </Panel>)}
      {selected && selected.state !== 'DRAFT' && <Panel>
        {!!selected.response.text && <Copy selectable>{selected.response.text}</Copy>}
        {!!selected.response.audioId && <Listen key={selected.id} audioId={selected.response.audioId} />}
        {selected.state === 'SUBMITTED' && (ai.data?.gemini
          ? <Button label="Chấm và nhận phản hồi AI" loading={action.busy} onPress={() => void action.run(async () => {
            const item = await api<Attempt>(`/study/attempts/${selected.id}/feedback`, { token: auth.token, method: 'POST', timeoutMs: 55_000 });
            setSelected(item); attempts.reload();
          })} />
          : <Copy>Máy chủ cần cấu hình Gemini để chấm bài.</Copy>)}
        {selected.feedback && ('details' in selected.feedback
          ? <Answers result={selected.feedback as AnswerResult} />
          : <FeedbackView feedback={selected.feedback} />)}
      </Panel>}
    </Section>
    {objective && <>
      <Section title="Ghi chú và dấu trang">
        <Choices values={markTypes} value={kind} label={item => markName[item]} onChange={setKind} />
        {kind !== 'BOOKMARK' && <Input label="Đoạn trích nguyên văn" value={quote} onChangeText={setQuote} maxLength={500} />}
        {kind === 'NOTE' && <Input label="Nội dung ghi chú" multiline value={note} onChangeText={setNote} maxLength={1000} />}
        <Button label="Lưu đánh dấu" secondary disabled={action.busy} onPress={() => void action.run(async () => {
          await api(path + '/annotations', { token: auth.token, method: 'POST', body: {
            kind, quote: kind === 'BOOKMARK' ? '' : quote, note: kind === 'NOTE' ? note : '',
          } });
          setQuote(''); setNote(''); marks.reload(); action.setSuccess('Đã lưu đánh dấu.');
        })} />
        <Pending {...marks} />
        {marks.data?.map(item => <Panel key={item.id}>
          <Copy>{markName[item.kind]}{item.quote ? ` · ${item.quote}` : ''}</Copy>
          {!!item.note && <Copy>{item.note}</Copy>}
          <Button label="Bỏ đánh dấu" secondary disabled={action.busy} onPress={() => void action.run(async () => {
            await api(`/study/annotations/${item.id}`, { token: auth.token, method: 'DELETE' }); marks.reload();
          })} />
        </Panel>)}
      </Section>
      <Section title="Lưu từ vựng">
        <Input label="Từ hoặc cụm từ" value={word} onChangeText={setWord} maxLength={120} />
        <Input label="Nghĩa (không bắt buộc)" value={meaning} onChangeText={setMeaning} maxLength={500} />
        <Button label="Thêm vào từ đã lưu" secondary disabled={!word.trim() || action.busy} onPress={() => void action.run(async () => {
          await api('/study/words', { token: auth.token, method: 'PUT', body: { word, meaning } });
          setWord(''); setMeaning(''); action.setSuccess('Đã lưu từ vựng.');
        })} />
        <Button label="Mở từ điển và từ đã lưu" secondary onPress={() => router.push('/(tabs)/dictionary')} />
      </Section>
    </>}
    <View style={{ gap: 10, borderTopWidth: 1, borderColor: c.border, paddingTop: 16 }}>
      {owned && <Button label="Chỉnh sửa bài" secondary onPress={() => router.push({ pathname: '/practice/editor', params: { id: lesson.id } })} />}
      <Button label="Sao chép làm bài của tôi" secondary disabled={action.busy} onPress={() => void action.run(async () => {
        const item = await api<StudyLesson>(path + '/clone', { token: auth.token, method: 'POST' });
        router.push({ pathname: '/practice/editor', params: { id: item.id } });
      })} />
      {lesson.ownerId && !owned && lesson.isPublic && <>
        <Button label={report ? 'Đóng báo cáo' : 'Báo cáo nội dung'} secondary onPress={() => setReport(value => !value)} />
        {report && <>
          <Input label="Lý do báo cáo" multiline value={reason} onChangeText={setReason} maxLength={500} />
          <Button label="Gửi báo cáo" loading={action.busy} disabled={reason.trim().length < 5} onPress={() => void action.run(async () => {
            await api(path + '/report', { token: auth.token, method: 'POST', body: { reason } });
            setReport(false); setReason(''); action.setSuccess('Đã lưu báo cáo.');
          })} />
        </>}
      </>}
      <ActionNotice action={action} />
    </View>
  </>;
}

function FeedbackView({ feedback }: { feedback: Feedback }) {
  return <Section title={`Phản hồi AI · ${feedback.score}/100`}>
    {feedback.criteria.map((item, i) => <Panel key={i}><Copy>{item.name} · {item.score}/100</Copy><Copy>{item.comment}</Copy></Panel>)}
    {!!feedback.strengths.length && <Copy>Điểm mạnh{'\n'}{feedback.strengths.join('\n')}</Copy>}
    {!!feedback.improvements.length && <Copy>Cần cải thiện{'\n'}{feedback.improvements.join('\n')}</Copy>}
    {feedback.segments.map((item, i) => <Copy key={i}>{duration(item.second)} · {item.comment}</Copy>)}
  </Section>;
}
