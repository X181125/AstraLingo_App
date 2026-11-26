import { View } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import {
  LearningScreen,
  Section,
  Choice,
  Copy,
  Panel,
  Input,
  ActionNotice,
  Pending,
  useFocusedData,
  useAction,
} from './Learning';
import { DiscoveryRow } from './DiscoveryUI';
import { Button } from './UI';
import { Listen } from './PracticeAudio';
import { LanguageCoach } from './LanguageCoach';
import { PracticeContent } from '@/app/practice/[id]';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';
import type { Practice } from '@/src/learning';

const menu: Record<Practice['contentType'], [string, string][]> = {
  READING: [
    ['quiz', 'Take quiz'],
    ['saved-words', 'Saved words'],
    ['annotations', 'Annotations'],
    ['assessments', 'Assessments'],
    ['attempts', 'Attempts'],
  ],
  LISTENING: [
    ['attempt', 'Start assessment'],
    ['transcript', 'Transcript'],
    ['annotations', 'My annotations'],
    ['learning-tools', 'AI Learning Tools'],
    ['progress', 'Progress & History'],
  ],
  SPEAKING: [
    ['attempt', 'Record a response'],
    ['submission', 'Submission'],
    ['result', 'Speaking Result'],
    ['review', 'Speaking Review'],
    ['history', 'Speaking History'],
  ],
  WRITING: [
    ['editor', 'Start writing'],
    ['result', 'Writing Result'],
    ['history', 'Writing History'],
  ],
};
const titles: Record<string, string> = {
  annotations: 'Annotations',
  'saved-words': 'Saved Words',
  transcript: 'Transcript',
  attempt: 'Practice Session',
  attempts: 'Attempts',
  history: 'History',
  progress: 'Progress & History',
  review: 'Answer Review',
  result: 'Result',
  editor: 'Writing Editor',
  submission: 'Submission',
  'learning-tools': 'AI Learning Tools',
};
export function LessonWorkspace({
  lesson,
  path,
  attemptId,
  assessmentId,
}: {
  lesson: Practice;
  path: string[];
  attemptId?: string;
  assessmentId?: string;
}) {
  const { user } = useAuth();
  const section = path[0],
    kind = lesson.contentType.toLowerCase(),
    base = '/study/content/' + kind + '/' + lesson.id;
  const objective = ['READING', 'LISTENING'].includes(lesson.contentType);
  if (section === 'manage' && path[1] === 'transcript') return <ManageTranscript lesson={lesson} />;
  if (
    section === 'assessments' ||
    section === 'quiz' ||
    (objective && ['attempt', 'attempts', 'result', 'review', 'progress', 'manage'].includes(section))
  ) {
    const screen = section === 'manage' ? path[1] : section;
    return (
      <AssessmentWorkspace
        id={String(lesson.publicId)}
        kind={kind}
        screen={screen}
        target={path[0] === 'assessments' ? (path[1] === 'edit' ? path[2] : path[1]) : (path[1] ?? attemptId)}
        assessmentId={path[1] === 'edit' ? 'edit' : assessmentId}
      />
    );
  }
  const panel =
    section === 'annotations'
      ? 'notes'
      : section === 'attempt' || section === 'editor'
        ? 'practice'
        : section;
  return (
    <LearningScreen
      title={section ? (titles[section] ?? lesson.title) : lesson.title}
      subtitle={section ? lesson.title : kind.toUpperCase() + ' PRACTICE'}
      back
    >
      {!section && (
        <>
          {kind === 'reading' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {menu.READING.filter(([k]) => ['saved-words', 'annotations', 'attempts'].includes(k)).map(
                ([k, label]) => (
                  <Choice key={k} label={label} onPress={() => router.push(base + '/' + k)} />
                ),
              )}
            </View>
          )}
          <Section title={kind === 'reading' ? 'Passage' : kind === 'listening' ? 'Audio' : 'Prompt'}>
            <Panel>
              {kind === 'listening' ? (
                <Listen
                  body={lesson.body}
                  audioUrl={lesson.audioUrl}
                  audioId={lesson.audioId}
                  transcript={lesson.transcript}
                />
              ) : (
                <Copy selectable>{lesson.body}</Copy>
              )}
            </Panel>
          </Section>
          {kind === 'reading' ? (
            <>
              <Button label="Take Quiz" onPress={() => router.push(base + '/quiz')} />
              <Button label="Assessments" secondary onPress={() => router.push(base + '/assessments')} />
            </>
          ) : (
            <Section title="Practice">
              {menu[lesson.contentType].map(([route, title]) => (
                <DiscoveryRow
                  key={route}
                  title={title}
                  icon="chevron-forward-circle-outline"
                  onPress={() => router.push(base + '/' + route)}
                />
              ))}
            </Section>
          )}
          {lesson.ownerId === user?.id && (
            <>
              <Button
                label="Edit lesson"
                secondary
                onPress={() => router.push('/study/content/edit/' + lesson.id)}
              />
              {lesson.contentType === 'LISTENING' &&
                ['assessment', 'questions', 'transcript'].map((key) => (
                  <Button
                    key={key}
                    label={'Manage ' + key}
                    secondary
                    onPress={() => router.push(base + '/manage/' + key)}
                  />
                ))}
            </>
          )}
        </>
      )}
      {section === 'transcript' ? (
        <Panel>
          <Listen
            initiallyShown
            body={lesson.body}
            audioUrl={lesson.audioUrl}
            audioId={lesson.audioId}
            transcript={lesson.transcript}
          />
        </Panel>
      ) : section === 'saved-words' ? (
        <PassageWords id={lesson.publicId} />
      ) : section === 'learning-tools' ? (
        <LanguageCoach kind="listening" id={lesson.publicId} />
      ) : (
        section && (
          <PracticeContent
            lesson={lesson}
            path={'/study/lessons/' + lesson.id}
            initialPanel={panel}
            attemptId={attemptId}
          />
        )
      )}
    </LearningScreen>
  );
}
import { AssessmentWorkspace } from '@/app/practice/assessments';
function ManageTranscript({ lesson }: { lesson: Practice }) {
  const { token, user } = useAuth(),
    action = useAction();
  const [lines, setLines] = useState(
    lesson.transcript.map((line) => line.second + ' | ' + line.text).join('\n'),
  );
  return (
    <LearningScreen title="Manage Transcript" subtitle={lesson.title} back>
      {lesson.ownerId !== user?.id ? (
        <Copy>Only the lesson author can edit this transcript.</Copy>
      ) : (
        <>
          <Input label="Timed segments (seconds | text)" multiline value={lines} onChangeText={setLines} />
          <ActionNotice action={action} />
          <Button
            label="Save transcript"
            loading={action.busy}
            onPress={() =>
              void action.run(async () => {
                const segments = lines
                  .split('\n')
                  .filter((s) => s.trim())
                  .map((s) => {
                    const pos = s.indexOf('|'),
                      startSec = Number(s.slice(0, pos)),
                      text = s.slice(pos + 1).trim();
                    if (pos < 1 || !Number.isFinite(startSec) || startSec < 0 || !text)
                      throw Error('Enter seconds and text for each segment.');
                    return { startSec, text };
                  });
                const resource = '/study/lessons/' + lesson.id;
                const draft = await api<Record<string, unknown>>(resource + '/edit', { token });
                await api(resource, {
                  method: 'PUT',
                  token,
                  body: {
                    ...draft,
                    transcript: segments
                      .map((s) => ({ second: s.startSec, text: s.text }))
                      .sort((a, b) => a.second - b.second),
                  },
                });
                action.setSuccess('Transcript saved.');
              })
            }
          />
        </>
      )}
    </LearningScreen>
  );
}
function PassageWords({ id }: { id: number }) {
  const { token } = useAuth(),
    action = useAction(),
    path = '/reading-passages/' + id + '/saved-words';
  const words = useFocusedData<{ id: number; surfaceForm: string; meaningNative: string | null }[]>(
    path + '/mine',
  );
  const [word, setWord] = useState(''),
    [meaning, setMeaning] = useState('');
  return (
    <>
      <Panel>
        <Input label="Word or phrase" value={word} onChangeText={setWord} />
        <Input label="Meaning" value={meaning} onChangeText={setMeaning} />
        <Button
          label="Save word"
          disabled={!word.trim()}
          loading={action.busy}
          onPress={() =>
            void action.run(async () => {
              await api(path, { method: 'POST', token, body: { surfaceForm: word, meaningNative: meaning } });
              setWord('');
              setMeaning('');
              words.reload();
            })
          }
        />
      </Panel>
      <ActionNotice action={action} />
      <Pending {...words} />
      {words.data?.length === 0 && <Copy>No saved words for this passage.</Copy>}
      {words.data?.map((w) => (
        <Panel key={w.id}>
          <Copy>
            {w.surfaceForm} · {w.meaningNative}
          </Copy>
          <Button
            label="Remove word"
            secondary
            onPress={() =>
              void action.run(async () => {
                await api('/reading-saved-words/' + w.id, { method: 'DELETE', token });
                words.reload();
              })
            }
          />
        </Panel>
      ))}
    </>
  );
}
