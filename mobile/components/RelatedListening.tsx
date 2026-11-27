import { router } from 'expo-router';
import { DiscoveryRow } from './DiscoveryUI';
import { Copy, Pending, Section, useFocusedData } from './Learning';

type Recommendation = {
  id: number;
  reason?: 'SAME_COURSE' | 'SAME_LEVEL' | 'MORE_LISTENING';
  contentItem: { title: string; description?: string };
};
const labels = {
  SAME_COURSE: 'Cùng khóa học',
  SAME_LEVEL: 'Cùng trình độ',
  MORE_LISTENING: 'Luyện nghe thêm',
};

export function RelatedListening({ id }: { id: number }) {
  const recommendations = useFocusedData<{ items: Recommendation[] }>(
    `/listening-audios/${id}/related?limit=4`,
  );
  return (
    <Section title="Bài nghe gợi ý">
      <Pending {...recommendations} />
      {recommendations.data?.items.length === 0 && <Copy>Chưa có bài nghe phù hợp.</Copy>}
      {recommendations.data?.items.map(({ id: nextId, contentItem, reason }) => (
        <DiscoveryRow
          key={nextId}
          icon="headset-outline"
          title={contentItem.title}
          caption={reason && labels[reason]}
          detail={contentItem.description}
          onPress={() => router.push(`/study/content/listening/${nextId}`)}
        />
      ))}
    </Section>
  );
}
