import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/typography';
import { Copy, LearningScreen, Pending, useFocusedData } from '@/components/Learning';
import { IconTile, SearchBox } from '@/components/DiscoveryUI';
import { useAppColors } from '@/src/theme';
import type { ExamSummary } from '@/src/exams';

export default function Categories() {
  const c = useAppColors();
  const tests = useFocusedData<ExamSummary[]>('/exams');
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const available = tests.data?.filter((test) =>
    [test.title, ...test.tags].some((text) => text.toLowerCase().includes(term)),
  );
  return (
    <LearningScreen title="English practice" back>
      <SearchBox
        label="Find English practice"
        placeholder="Search by title or skill…"
        value={query}
        onChange={setQuery}
        onSubmit={() => setQuery(query.trim())}
        clear={() => setQuery('')}
      />
      <Pending {...tests} />
      {available?.length === 0 && <Copy>No matching tests or quizzes.</Copy>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {available?.map((test) => (
          <Pressable
            key={test.id}
            accessibilityRole="button"
            accessibilityLabel={test.title}
            onPress={() =>
              router.push({
                pathname: '/study/exam/[id]',
                params: { id: test.id, ...(!test.paper && { mini: '1' }) },
              })
            }
            style={({ pressed }) => ({
              width: '31%',
              flexGrow: 1,
              maxWidth: '47%',
              minHeight: 108,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: 9,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: pressed ? c.lavender : c.white,
            })}
          >
            <IconTile
              icon={test.paper ? 'document-text-outline' : 'flash-outline'}
              background={test.paper ? '#E8F1FF' : '#FFF1D5'}
              ink={test.paper ? '#1252B6' : '#795414'}
            />
            <Text
              numberOfLines={3}
              style={{ fontSize: 13, fontWeight: '600', color: c.ink, textAlign: 'center' }}
            >
              {test.title.replace(' · Reading and Writing', '')}
            </Text>
          </Pressable>
        ))}
      </View>
    </LearningScreen>
  );
}
