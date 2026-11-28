import { router, useLocalSearchParams } from 'expo-router';
import { LearningScreen, Panel, Copy, Pending, useFocusedData } from '@/components/Learning';
import { Button } from '@/components/UI';
import type { Practice } from '@/src/learning';
export default function SetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const result = useFocusedData<Practice>('/study/lessons/' + encodeURIComponent(id));
  return (
    <LearningScreen title="Reading Set" back>
      <Pending {...result} />
      {result.data && (
        <Panel>
          <Copy>{result.data.title}</Copy>
          <Copy>{result.data.preview}</Copy>
          <Button label="Start Session" onPress={() => router.push('/study/content/reading/' + id)} />
        </Panel>
      )}
    </LearningScreen>
  );
}
