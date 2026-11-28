import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActionNotice,
  Choice,
  Choices,
  Copy,
  Input,
  LearningScreen,
  Panel,
  Pending,
  Section,
  useAction,
  useFocusedData,
} from '../../components/Learning';
import { Recorder, Listen } from '../../components/PracticeAudio';
import { Button } from '../../components/UI';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { uploadRecording, type Recording } from '../../src/audio';
import {
  skillName,
  skills,
  type EditableQuestion,
  type Status,
  type Skill,
  type StudyLesson,
  type Transcript,
} from '../../src/learning';
import type { Course } from '../../src/types';

type Draft = {
  courseId: string;
  title: string;
  contentType: Skill;
  body: string;
  questions: EditableQuestion[];
  status: Status;
  isPublic: boolean;
  transcript: Transcript[];
  audioId?: string;
};
const statuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
const statusName = { DRAFT: 'Nháp', PUBLISHED: 'Xuất bản', ARCHIVED: 'Lưu trữ' };
const blankQuestion = (): EditableQuestion => ({
  prompt: '',
  options: ['', '', ''],
  answer: 0,
  explanation: '',
});

export default function Editor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const data = useFocusedData<Draft>(id ? `/study/lessons/${encodeURIComponent(id)}/edit` : null);
  const courses = useFocusedData<{ items: Course[] }>('/courses?limit=50');
  return (
    <LearningScreen title={id ? 'Edit Lesson' : 'Create Lesson'} back>
      <Pending {...data} />
      <Pending {...courses} />
      {courses.data && (!id || data.data) && (
        <LessonForm key={id ?? 'new'} id={id} initial={data.data} courses={courses.data.items} />
      )}
    </LearningScreen>
  );
}

function LessonForm({ id, initial, courses }: { id?: string; initial?: Draft; courses: Course[] }) {
  const { token } = useAuth();
  const action = useAction();
  const ai = useFocusedData<{ gemini: boolean }>('/learn/ai/capabilities');
  const [courseId, setCourse] = useState(initial?.courseId ?? courses[0]?.id ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [type, setType] = useState<Skill>(initial?.contentType ?? 'READING');
  const [body, setBody] = useState(initial?.body ?? '');
  const [status, setStatus] = useState<Status>(initial?.status ?? 'DRAFT');
  const [published, setPublished] = useState(initial?.isPublic ?? false);
  const [questions, setQuestions] = useState<EditableQuestion[]>(initial?.questions ?? []);
  const [lines, setLines] = useState(
    initial?.transcript.map((item) => `${item.second} | ${item.text}`).join('\n') ?? '',
  );
  const [audioId, setAudioId] = useState(initial?.audioId);
  const [audio, setAudio] = useState<Recording>();
  const path = id ? `/study/lessons/${id}` : '/study/lessons';
  const objective = type === 'READING' || type === 'LISTENING';

  const [step, setStep] = useState(0);
  function setQuestion(index: number, patch: Partial<EditableQuestion>) {
    setQuestions((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function save() {
    const transcript =
      type === 'LISTENING'
        ? lines
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => {
              const separator = line.indexOf('|');
              const time = line.slice(0, separator).trim();
              const text = line.slice(separator + 1).trim();
              if (separator < 0 || !/^\d+(\.\d+)?$/.test(time) || !text)
                throw new Error('Mỗi dòng transcript cần dạng giây | nội dung.');
              return { second: Number(time), text };
            })
        : [];
    const sortedTranscript = transcript.sort((a, b) => a.second - b.second);
    let uploaded = type === 'LISTENING' ? audioId : undefined;
    if (type === 'LISTENING' && audio && !uploaded) {
      uploaded = await uploadRecording(token, audio);
      setAudioId(uploaded);
    }
    const lesson = await api<StudyLesson>(path, {
      token,
      method: id ? 'PUT' : 'POST',
      body: {
        courseId,
        title,
        body,
        contentType: type,
        questions: objective ? questions : [],
        transcript: sortedTranscript,
        audioId: uploaded,
        status,
        isPublic: published,
      },
    });
    router.replace({ pathname: '/practice/[id]', params: { id: lesson.id } });
  }

  return (
    <>
      {!courses.length && <Copy>Cần có ít nhất một khóa học để tạo bài luyện.</Copy>}
      {!id && step === 0 && (
        <Section title="Choose lesson type">
          <Choices values={skills} value={type} label={(value) => skillName[value]} onChange={setType} />
          <Button label="Continue" onPress={() => setStep(1)} />
        </Section>
      )}
      {(!!id || step === 1) && (
        <>
          <Section title="Lesson details">
            <Input label="Tên bài" value={title} onChangeText={setTitle} maxLength={120} />
            <Copy>Khóa học</Copy>
            <Choices
              values={courses.map((course) => course.id)}
              value={courseId}
              label={(value) => courses.find((course) => course.id === value)?.title ?? value}
              onChange={setCourse}
            />
            <Copy>{skillName[type]}</Copy>
            <Input
              label={type === 'LISTENING' ? 'Nội dung bài nghe' : objective ? 'Đoạn văn tiếng Anh' : 'Đề bài'}
              multiline
              value={body}
              onChangeText={setBody}
              maxLength={10_000}
            />
            {type === 'LISTENING' && (
              <>
                <Input
                  label="Transcript (mỗi dòng: giây | nội dung)"
                  multiline
                  value={lines}
                  onChangeText={setLines}
                  placeholder="0 | Hello.\n4 | Nice to meet you."
                />
                <Recorder
                  allowFile
                  onRecorded={(recording) => {
                    setAudio(recording);
                    setAudioId(undefined);
                  }}
                />
                {audioId && !audio && <Listen key={audioId} audioId={audioId} />}
                {(audio || audioId) && (
                  <Button
                    label="Bỏ bản ghi"
                    secondary
                    onPress={() => {
                      setAudio(undefined);
                      setAudioId(undefined);
                    }}
                  />
                )}
              </>
            )}
          </Section>
          {objective && (
            <Section title="Câu hỏi trắc nghiệm">
              {questions.map((question, i) => (
                <Panel key={i}>
                  <Input
                    label={`Câu ${i + 1}`}
                    value={question.prompt}
                    onChangeText={(prompt) => setQuestion(i, { prompt })}
                    maxLength={400}
                  />
                  {question.options.map((option, optionIndex) => (
                    <Input
                      key={optionIndex}
                      label={`Lựa chọn ${optionIndex + 1}`}
                      value={option}
                      onChangeText={(changed) =>
                        setQuestion(i, {
                          options: question.options.map((old, j) => (j === optionIndex ? changed : old)),
                        })
                      }
                      maxLength={200}
                    />
                  ))}
                  <Copy>Đáp án đúng</Copy>
                  <Choices
                    values={question.options.map((_, index) => index)}
                    value={question.answer}
                    label={(value) => String(value + 1)}
                    onChange={(answer) => setQuestion(i, { answer })}
                  />
                  <Input
                    label="Giải thích"
                    value={question.explanation}
                    onChangeText={(explanation) => setQuestion(i, { explanation })}
                    maxLength={500}
                  />
                  <Button
                    label="Bỏ câu hỏi"
                    secondary
                    onPress={() => setQuestions((items) => items.filter((_, j) => j !== i))}
                  />
                </Panel>
              ))}
              <Button
                label="Thêm câu hỏi"
                secondary
                disabled={questions.length >= 20}
                onPress={() => setQuestions((items) => [...items, blankQuestion()])}
              />
              {ai.data?.gemini && (
                <Button
                  label="Sinh câu hỏi từ nội dung bằng AI"
                  secondary
                  disabled={!body.trim() || action.busy || questions.length >= 20}
                  onPress={() =>
                    void action.run(async () => {
                      const result = await api<{ questions: EditableQuestion[] }>('/learn/ai', {
                        token,
                        method: 'POST',
                        timeoutMs: 55_000,
                        body: { task: 'questions', text: body },
                      });
                      setQuestions((items) => [...items, ...result.questions].slice(0, 20));
                      action.setSuccess('Đã thêm câu hỏi AI. Kiểm tra đáp án trước khi lưu.');
                    })
                  }
                />
              )}
            </Section>
          )}
          <Section title="Xuất bản">
            <Choices
              values={statuses}
              value={status}
              label={(item) => statusName[item]}
              onChange={setStatus}
            />
            {status === 'PUBLISHED' && (
              <Choice
                label={published ? 'Hiển thị trong cộng đồng' : 'Chỉ tài khoản của tôi'}
                selected={published}
                onPress={() => setPublished((value) => !value)}
              />
            )}
            <ActionNotice action={action} />
            <Button
              label="Lưu bài luyện"
              loading={action.busy}
              disabled={!courseId || title.trim().length < 2 || !body.trim()}
              onPress={() => void action.run(save)}
            />
          </Section>
          {!id && <Button label="Back" secondary onPress={() => setStep(0)} />}
        </>
      )}
    </>
  );
}
