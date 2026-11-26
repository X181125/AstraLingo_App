import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { router, useLocalSearchParams } from 'expo-router';
import { Button } from './UI';
import { Choice, Copy, LearningScreen, Pending, Section, useFocusedData } from './Learning';
import { DiscoveryRow, SearchBox, Segments, skillVisuals } from './DiscoveryUI';
import { skillName, skills, type Page, type Skill, type StudyLesson } from '../src/learning';

const tabs = [
  { id: 'explore', label: 'Khám phá' },
  { id: 'mine', label: 'Bài của tôi' },
] as const;
const filters = ['all', ...skills] as const;
const statusName = { DRAFT: 'Nháp', PUBLISHED: 'Đã xuất bản', ARCHIVED: 'Lưu trữ' };

export function LessonLibrary({ initialSkill, mine = false }: { initialSkill?: Skill; mine?: boolean }) {
  const params = useLocalSearchParams<{ skill?: Skill; view?: string }>();
  const [view, setView] = useState<'explore' | 'mine'>(mine || params.view === 'mine' ? 'mine' : 'explore');
  const [skill, setSkill] = useState<'all' | Skill>(
    initialSkill ?? (params.skill && skills.includes(params.skill) ? params.skill : 'all'),
  );
  React.useEffect(() => {
    setSkill(initialSkill ?? (params.skill && skills.includes(params.skill) ? params.skill : 'all'));
    setView(mine || params.view === 'mine' ? 'mine' : 'explore');
    setPage(1);
  }, [params.skill, params.view, initialSkill, mine]);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const lessons = useFocusedData<Page<StudyLesson>>(
    `/study/lessons?view=${view}&page=${page}&q=${encodeURIComponent(query)}${skill === 'all' ? '' : `&skill=${skill}`}`,
  );

  const name = initialSkill
    ? initialSkill[0] + initialSkill.slice(1).toLowerCase() + ' Practice'
    : mine
      ? 'My Content'
      : 'Explore';
  return (
    <LearningScreen
      title={name}
      subtitle={initialSkill ? 'English practice sets' : mine ? 'Manage your lessons' : 'Community lessons'}
      back
    >
      <Section title={initialSkill ? 'Practice sets' : 'Lessons'}>
        <Segments
          items={tabs}
          selected={view}
          onChange={(item) => {
            setView(item);
            setPage(1);
          }}
        />
        <SearchBox
          label="Tìm bài luyện"
          placeholder="Tìm tên bài luyện…"
          value={q}
          onChange={setQ}
          onSubmit={() => {
            setQuery(q.trim());
            setPage(1);
          }}
          clear={() => {
            setQ('');
            setQuery('');
            setPage(1);
          }}
        />
        {!initialSkill && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
            {filters.map((item) => (
              <Choice
                key={item}
                label={item === 'all' ? 'Tất cả' : skillName[item]}
                selected={skill === item}
                onPress={() => {
                  setSkill(item);
                  setPage(1);
                }}
              />
            ))}
          </ScrollView>
        )}
        {view === 'mine' && (
          <Button label="Tạo bài mới" icon="add" onPress={() => router.push('/practice/editor')} />
        )}
        <Pending {...lessons} />
        {!lessons.loading && lessons.data && (
          <>
            {!lessons.data.items.length && <Copy>Chưa tìm thấy bài phù hợp.</Copy>}
            {initialSkill && lessons.data.items.length > 0 && (
              <Button
                label="Quick Start"
                icon="play"
                onPress={() => {
                  const choices = lessons.data!.items,
                    pick = choices[Math.floor(Math.random() * choices.length)];
                  router.push('/study/content/' + pick.contentType.toLowerCase() + '/' + pick.id);
                }}
              />
            )}
            {lessons.data.items.map((item) => (
              <DiscoveryRow
                key={item.id}
                {...skillVisuals[item.contentType]}
                caption={
                  view === 'mine'
                    ? `${skillName[item.contentType]} · ${statusName[item.status]}`
                    : skillName[item.contentType]
                }
                title={item.title}
                detail={view === 'mine' ? 'Chỉnh sửa và quản lý' : item.preview}
                onPress={() =>
                  view === 'mine'
                    ? router.push({ pathname: '/practice/editor', params: { id: item.id } })
                    : router.push('/study/content/' + item.contentType.toLowerCase() + '/' + item.id)
                }
              />
            ))}
            <View style={s.pagination}>
              {page > 1 && <Button label="Trang trước" secondary onPress={() => setPage((old) => old - 1)} />}
              {lessons.data.hasMore && (
                <Button label="Trang sau" secondary onPress={() => setPage((old) => old + 1)} />
              )}
            </View>
          </>
        )}
      </Section>
    </LearningScreen>
  );
}

const s = StyleSheet.create({
  filters: { gap: 7, paddingBottom: 2 },
  pagination: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
