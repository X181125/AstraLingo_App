import { Redirect, useLocalSearchParams } from 'expo-router';
import { LearningScreen, Pending, useFocusedData } from '@/components/Learning';
import type { Practice } from '@/src/learning';
import { LessonWorkspace } from '@/components/LessonWorkspace';

export default function LessonLink() {
  const {
    parts: raw,
    attemptId,
    submissionId,
    assessmentId,
  } = useLocalSearchParams<{
    parts: string[] | string;
    attemptId?: string;
    submissionId?: string;
    assessmentId?: string;
  }>();
  const [kind, key, ...rest] = Array.isArray(raw) ? raw : (raw ?? '').split('/');
  const lesson = useFocusedData<Practice>('/study/lessons/' + encodeURIComponent(key ?? kind));
  if (!lesson.data)
    return (
      <LearningScreen title="Lesson" back>
        <Pending {...lesson} />
      </LearningScreen>
    );
  const item = lesson.data;
  if (kind === 'edit') return <Redirect href={{ pathname: '/practice/editor', params: { id: item.id } }} />;
  return (
    <LessonWorkspace
      key={[item.id, ...rest, attemptId, submissionId, assessmentId].join('/')}
      lesson={item}
      path={rest}
      attemptId={attemptId ?? submissionId}
      assessmentId={assessmentId}
    />
  );
}
