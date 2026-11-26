import { View } from 'react-native';
import { useState } from 'react';
import { SearchBox } from '@/components/DiscoveryUI';
import { LearningScreen, Panel, Copy, Section, Choice, Pending, useFocusedData } from '@/components/Learning';
import { CourseCard } from '@/components/CourseCard';
import { Button } from '@/components/UI';
import type { Course } from '@/src/types';
export default function SearchCourses() {
  const [text, setText] = useState(''),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(1);
  const result = useFocusedData<{ items: Course[]; hasMore: boolean }>(
    '/courses?page=' + page + '&q=' + encodeURIComponent(query),
  );
  const [recent, setRecent] = useState<string[]>([]);
  function search(value: string) {
    const term = value.trim();
    setQuery(term);
    setPage(1);
    if (term) setRecent((items) => [term, ...items.filter((x) => x !== term)].slice(0, 8));
  }
  return (
    <LearningScreen title="All Category" back>
      <SearchBox
        label="Search courses"
        placeholder="Search for…"
        value={text}
        onChange={setText}
        onSubmit={() => search(text)}
        clear={() => {
          setText('');
          search('');
        }}
      />
      {!query && (
        <Section title="Recent searches">
          {recent.length ? (
            recent.map((term) => (
              <View key={term} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Choice
                  label={term}
                  onPress={() => {
                    setText(term);
                    search(term);
                  }}
                />
                <Choice
                  label={'Remove ' + term}
                  onPress={() => setRecent((items) => items.filter((x) => x !== term))}
                >
                  ×
                </Choice>
              </View>
            ))
          ) : (
            <Copy>Your searches will appear here.</Copy>
          )}
        </Section>
      )}
      <Pending {...result} />
      {result.data?.items.map((course) => (
        <CourseCard key={course.id} course={course} width="100%" />
      ))}
      {result.data?.items.length === 0 && (
        <Panel>
          <Copy>No matching courses.</Copy>
        </Panel>
      )}
      {page > 1 && <Button secondary label="Previous" onPress={() => setPage(page - 1)} />}
      {result.data?.hasMore && <Button secondary label="Next" onPress={() => setPage(page + 1)} />}
    </LearningScreen>
  );
}
