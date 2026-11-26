import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/components/typography";
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../../components/UI';
import { Choice, Copy, LearningScreen, Pending, Section, useFocusedData } from '../../../components/Learning';
import { DiscoveryRow, IconTile, SearchBox, Segments, skillVisuals, type IconName } from '../../../components/DiscoveryUI';
import { skillName, skills, type Page, type Skill, type StudyLesson } from '../../../src/learning';
import { heading, useAppColors } from '../../../src/theme';

const tabs = [{ id: 'explore', label: 'Khám phá' }, { id: 'mine', label: 'Bài của tôi' }] as const;
const filters = ['all', ...skills] as const;
const tools = [
  { label: "Lịch sử", caption: "Kết quả", icon: "time-outline", background: "#E8F1FF", ink: "#2450A0", route: "/study/exam/history" },
  { label: 'Mini Quiz', caption: '5 chủ đề', icon: 'flash-outline', background: '#FDF0D4', ink: '#815719', route: '/study/exam?mini=1' },
  { label: 'Thi trực tuyến', caption: '8 đề SAT', icon: 'timer-outline', background: '#E6ECFA', ink: '#3C548A', route: '/study/exam' },
  { label: 'Bộ thẻ Flashcard', caption: 'Ôn từ', icon: 'layers-outline', background: '#EEE5FA', ink: '#5D3DB6', route: '/flashcards' },
] as const satisfies readonly { label: string; caption: string; icon: IconName; background: string; ink: string; route: string }[];
const statusName = { DRAFT: 'Nháp', PUBLISHED: 'Đã xuất bản', ARCHIVED: 'Lưu trữ' };

export default function Study() {
  const c = useAppColors();
  const params = useLocalSearchParams<{ skill?: Skill; view?: string }>();
  const [view, setView] = useState<'explore' | 'mine'>(params.view === 'mine' ? 'mine' : 'explore');
  const [skill, setSkill] = useState<'all' | Skill>(params.skill && skills.includes(params.skill) ? params.skill : 'all');
  React.useEffect(() => {
    setSkill(params.skill && skills.includes(params.skill) ? params.skill : 'all');
    setView(params.view === 'mine' ? 'mine' : 'explore'); setPage(1);
  }, [params.skill, params.view]);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const lessons = useFocusedData<Page<StudyLesson>>(`/study/lessons?view=${view}&page=${page}&q=${encodeURIComponent(query)}${skill === 'all' ? '' : `&skill=${skill}`}`);

  return <LearningScreen title="Học tập" subtitle="Chọn bài luyện theo kỹ năng hoặc ôn từ vựng.">
    <Section title="Ôn tập và kiểm tra">
      <View style={s.tools}>
        {tools.map(tool => <Pressable accessibilityRole="button" accessibilityLabel={tool.label} key={tool.label}
          onPress={() => router.push(tool.route)} style={({ pressed }) => [s.tool, { backgroundColor: pressed ? c.lavender : c.white, borderColor: c.border }]}>
          <IconTile icon={tool.icon} background={tool.background} ink={tool.ink} size={36} />
          <Text style={{ color: c.ink, fontFamily: heading, fontSize: 14, lineHeight: 17, textAlign: 'center' }}>{tool.label}</Text>
          <Text style={{ color: c.muted, fontSize: 11 }}>{tool.caption}</Text>
        </Pressable>)}
      </View>
    </Section>
    <Section title="Bài luyện">
      <Segments items={tabs} selected={view} onChange={item => { setView(item); setPage(1); }} />
      <SearchBox label="Tìm bài luyện" placeholder="Tìm tên bài luyện…" value={q} onChange={setQ}
        onSubmit={() => { setQuery(q.trim()); setPage(1); }} clear={() => { setQ(''); setQuery(''); setPage(1); }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
        {filters.map(item => <Choice key={item} label={item === 'all' ? 'Tất cả' : skillName[item]} selected={skill === item}
          onPress={() => { setSkill(item); setPage(1); }} />)}
      </ScrollView>
      {view === 'mine' && <Button label="Tạo bài mới" icon="add" onPress={() => router.push('/practice/editor')} />}
      <Pending {...lessons} />
      {!lessons.loading && lessons.data && <>
        {!lessons.data.items.length && <Copy>Chưa tìm thấy bài phù hợp.</Copy>}
        {lessons.data.items.map(item => <DiscoveryRow key={item.id} {...skillVisuals[item.contentType]}
          caption={view === 'mine' ? `${skillName[item.contentType]} · ${statusName[item.status]}` : skillName[item.contentType]}
          title={item.title} detail={view === 'mine' ? 'Chỉnh sửa và quản lý' : item.preview}
          onPress={() => view === 'mine'
            ? router.push({ pathname: '/practice/editor', params: { id: item.id } })
            : router.push({ pathname: '/practice/[id]', params: { id: item.id } })} />)}
        <View style={s.pagination}>
          {page > 1 && <Button label="Trang trước" secondary onPress={() => setPage(old => old - 1)} />}
          {lessons.data.hasMore && <Button label="Trang sau" secondary onPress={() => setPage(old => old + 1)} />}
        </View>
      </>}
    </Section>
  </LearningScreen>;
}

const s = StyleSheet.create({
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'stretch' },
  tool: { flexGrow: 1, flexBasis: '44%', minWidth: 0, alignItems: 'center', justifyContent: 'center', minHeight: 100, gap: 5, borderWidth: 1, borderRadius: 16, padding: 8 },
  filters: { gap: 7, paddingBottom: 2 },
  pagination: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
