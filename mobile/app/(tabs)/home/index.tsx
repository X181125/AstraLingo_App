import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "@/components/typography";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../src/auth';
import { api } from '../../../src/api';
import type { Category, Course } from '../../../src/types';
import { colors, heading, useAppColors } from '../../../src/theme';
import { Brand, Button, Notice } from '../../../components/UI';
import { Artwork } from '../../../components/Artwork';
import { CourseCard } from '../../../components/CourseCard';
import { IconTile, SearchBox, skillVisuals, type IconName } from '../../../components/DiscoveryUI';
import { HomeMentors } from '../../../components/HomeMentors';

const categoryVisuals: Record<string, (typeof skillVisuals)[keyof typeof skillVisuals]> = {
  reading: skillVisuals.READING, listening: skillVisuals.LISTENING, speaking: skillVisuals.SPEAKING, writing: skillVisuals.WRITING,
};

export default function Home() {
  const { focus } = useLocalSearchParams<{focus?:string}>();
  const c = useAppColors();
  const st = React.useMemo(() => makeStyles(c), [c]);
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const compact = width < 380;
  const horizontalPadding = wide ? 44 : 20;
  const contentWidth = Math.min(width, 1110) - horizontalPadding * 2;
  const featuredCardWidth = wide ? Math.floor((contentWidth - 24) / 3) : Math.min(252, contentWidth - 34);
  const scroll = useRef<ScrollView>(null);
  const [query, setQuery] = useState(''), [debounced, setDebounced] = useState(''), [category, setCategory] = useState('');
  const [level, setLevel] = useState(''), [filters, setFilters] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]), [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0), [error, setError] = useState(''), [total, setTotal] = useState(0);
  const filterKey = JSON.stringify([debounced, category, level]);
  const [pagination, setPagination] = useState({ key: '', page: 1 });
  if (pagination.key !== filterKey) setPagination({ key: filterKey, page: 1 });
  const page = pagination.page;
  const [hasMore, setHasMore] = useState(false);
  const reload = () => { setPagination({ key: filterKey, page: 1 }); setRefresh(n => n + 1); };

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const params = new URLSearchParams({ limit: '12', page: String(page), q: debounced });
    if (category) params.set('category', category);
    if (level) params.set('level', level);
    Promise.all([
      api<Category[]>('/categories', { signal: controller.signal }),
      api<{ items: Course[]; total: number; hasMore: boolean }>(`/courses?${params}`, { signal: controller.signal }),
    ]).then(([cats, result]) => {
      if (controller.signal.aborted) return;
      setCategories(cats);
      setCourses(previous => page === 1 ? result.items : [...previous, ...result.items.filter(item => !previous.some(old => old.id === item.id))]);
      setTotal(result.total);
      setHasMore(result.hasMore);
    }).catch(e => {
      if (!controller.signal.aborted) setError((e as Error).message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [debounced, category, level, refresh, page]);

  const filtered = Boolean(debounced || category || level);
  const clearSearch = () => { setQuery(''); setDebounced(''); };
  const reset = () => { clearSearch(); setCategory(''); setLevel(''); };
  const firstName = user?.name.trim().split(/\s+/).at(-1) || 'bạn';
  const heroCourse = courses.find(course => course.id === 'english-first-steps') ?? courses[0];
  const orderedCategories = [...categories].sort((a, b) => Number(a.id === 'all-skills') - Number(b.id === 'all-skills'));
  const featured = filtered || error ? [] : courses.filter(course => course.featured).slice(0, 3);
  const catalogue = courses.filter(course => !featured.includes(course));
  const showCatalogue = filtered || loading || error || catalogue.length > 0 || hasMore || !featured.length;

  return <SafeAreaView edges={['top']} style={st.screen}>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loading && refresh > 0} onRefresh={reload} tintColor={c.purple} />}
      contentContainerStyle={[st.container, { paddingHorizontal: horizontalPadding }]}>
      <View style={st.topBar}>
        <Brand small />
        <Pressable accessibilityRole="button" accessibilityLabel="Mở hồ sơ cá nhân" onPress={() => router.push('/(tabs)/profile')} style={st.avatar}>
          <Text style={st.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
        </Pressable>
      </View>
      <View style={st.intro}>
        <Text accessibilityRole="header" style={st.title}>Chào {firstName}!</Text>
        <View style={st.level}>
          <Ionicons name="globe-outline" size={16} color={c.purpleDark} />
          <Text style={st.levelText}>Tiếng Anh · {user?.level ?? 'A1'}</Text>
        </View>
      </View>
      <View style={st.searchRow}>
        <SearchBox key={focus} autoFocus={focus === 'search'} label="Tìm kiếm nội dung và khóa học" placeholder="Tìm khóa học tiếng Anh…" value={query} onChange={setQuery}
          onSubmit={() => setDebounced(query.trim())} clear={clearSearch} />
        <Pressable accessibilityRole="button" accessibilityLabel="Bộ lọc khóa học" accessibilityState={{ selected: Boolean(level) }}
          onPress={() => setFilters(true)} style={[st.filterButton, Boolean(level) && { backgroundColor: c.lavender }]}>
          <Ionicons name="options-outline" size={22} color={c.purpleDark} />
          {!!level && <View style={st.filterDot} />}
        </Pressable>
      </View>
      {!filtered && <LinearGradient colors={['#32215B', '#52358D', '#694EB3']} start={{ x: 0, y: .4 }} end={{ x: 1, y: .85 }}
        style={[st.hero, wide && st.heroWide]}>
        <View style={[st.heroCopy, compact && st.heroCopyCompact]}>
          <Text style={[st.heroTitle, wide && st.heroTitleWide, compact && st.heroTitleCompact]}>Một chút tiếng Anh{compact ? ' ' : '\n'}mỗi ngày</Text>
          <Text style={st.heroSub}>{user?.preferences?.dailyMinutes ?? 10} phút luyện tập theo nhịp của bạn.</Text>
          <Pressable accessibilityRole="button" onPress={() => heroCourse ? router.push(`/course/${heroCourse.id}`) : router.push('/(tabs)/study')} style={st.heroAction}>
            <Text style={st.heroActionText}>Bắt đầu khám phá</Text><Ionicons name="arrow-forward" size={16} color="#39265D" />
          </Pressable>
        </View>
        <View pointerEvents="none" style={[st.heroArt, wide && st.heroArtWide, compact && st.heroArtCompact]}><Artwork size={wide ? 236 : compact ? 106 : 157} dark /></View>
      </LinearGradient>}
      {!!categories.length && <View style={st.section} onLayout={event => {
        if (focus === 'categories') scroll.current?.scrollTo({y:event.nativeEvent.layout.y,animated:true});
      }}>
        <View style={st.sectionHead}>
          <Text accessibilityRole="header" style={st.sectionTitle}>Khám phá theo kỹ năng</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Danh mục Tất cả" accessibilityState={{ selected: !category }}
            onPress={() => setCategory('')} hitSlop={6}><Text style={st.link}>Tất cả</Text></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.categories}>
          {orderedCategories.map(cat => {
            const art = categoryVisuals[cat.id];
            const active = category === cat.id;
            return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`Danh mục ${cat.name}`} key={cat.id}
              onPress={() => setCategory(cat.id)} style={[st.category, wide && st.categoryWide, active && st.categoryActive]}>
              <IconTile icon={art?.icon ?? cat.icon as IconName} background={art?.background} ink={art?.ink} size={40} />
              <Text style={st.categoryName}>{cat.name}</Text>
            </Pressable>;
          })}
        </ScrollView>
      </View>}
      {!!featured.length && <View style={st.section}>
        <Text accessibilityRole="header" style={st.sectionTitle}>Khóa học nổi bật</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          contentContainerStyle={st.featuredRail} snapToInterval={wide ? undefined : featuredCardWidth + 12} decelerationRate="fast">
          {featured.map(course => <CourseCard key={course.id} course={course} width={featuredCardWidth} featured />)}
        </ScrollView>
      </View>}
      {!filtered && <HomeMentors categories={categories} onChoose={id => {
        setCategory(id);
        scroll.current?.scrollTo({ y: 0, animated: false });
      }} />}
      {showCatalogue && <View style={st.section}>
        <View style={st.sectionHead}>
          <View style={st.sectionLabel}>
            <Text accessibilityRole="header" style={st.sectionTitle}>{filtered ? 'Kết quả tìm kiếm' : featured.length ? 'Các khóa học khác' : 'Khóa học tiếng Anh'}</Text>
            {!loading && !error && <Text style={st.meta}>{total - featured.length} khóa học{level ? ` · ${level}` : ''}</Text>}
          </View>
          {filtered && <Pressable accessibilityRole="button" onPress={reset}><Text style={st.link}>Xóa bộ lọc</Text></Pressable>}
        </View>
        {error ? <View style={{ gap: 12 }}><Notice message={error} /><Button secondary label="Thử tải lại" onPress={reload} /></View>
          : loading && page === 1 ? <View style={st.feedback}><ActivityIndicator color={c.purple} /><Text style={st.meta}>Đang tải khóa học…</Text></View>
          : catalogue.length ? <View style={st.courseGrid}>{catalogue.map(course => <CourseCard key={course.id} course={course} width={wide ? '49%' : '100%'} />)}</View>
          : !hasMore && <View style={st.feedback}>
            <IconTile icon="search-outline" size={48} /><Text style={st.sectionTitle}>Chưa tìm thấy khóa học</Text>
            <Text style={st.meta}>Thử từ khóa khác hoặc bỏ bớt bộ lọc.</Text>
            <Button secondary label="Xem tất cả khóa học" onPress={reset} />
          </View>}
        {!error && hasMore && (page > 1 || !loading) && <Button secondary loading={loading} label="Xem thêm khóa học" onPress={() => setPagination({ key: filterKey, page: page + 1 })} />}
      </View>}
    </ScrollView>
    <Modal visible={filters} transparent animationType="fade" onRequestClose={() => setFilters(false)}>
      <View style={st.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setFilters(false)} accessible={false} />
        <View style={st.sheet} accessibilityViewIsModal>
          <View style={st.sectionHead}>
            <Text accessibilityRole="header" style={st.sectionTitle}>Lọc theo trình độ</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Đóng bộ lọc" onPress={() => setFilters(false)} style={st.filterButton}>
              <Ionicons name="close" size={21} color={c.ink} />
            </Pressable>
          </View>
          <View style={st.levelOptions}>{['', 'A1', 'A2', 'B1', 'B2'].map(value => <Pressable key={value}
            accessibilityRole="button" accessibilityState={{ selected: level === value }} onPress={() => setLevel(value)}
            style={[st.levelChoice, level === value && st.categoryActive]}><Text style={st.levelText}>{value || 'Tất cả'}</Text></Pressable>)}</View>
          <Button label="Xem khóa học" onPress={() => setFilters(false)} />
        </View>
      </View>
    </Modal>
  </SafeAreaView>;
}

const makeStyles = (c: typeof colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.paper },
  container: { width: '100%', maxWidth: 1110, alignSelf: 'center', paddingTop: 14, paddingBottom: 32, gap: 19 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.lavender, borderWidth: 1, borderColor: c.border },
  avatarText: { color: c.purpleDark, fontFamily: heading, fontSize: 22 },
  intro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 7 },
  title: { fontFamily: heading, fontSize: 34, lineHeight: 39, color: c.ink },
  level: { flexDirection: 'row', alignItems: 'center', borderRadius: 11, gap: 5, paddingVertical: 7, paddingHorizontal: 10, backgroundColor: c.lavender },
  levelText: { color: c.purpleDark, fontSize: 12, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  filterButton: { width: 52, minHeight: 44, borderRadius: 16, backgroundColor: c.white, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  filterDot: { position: 'absolute', width: 7, height: 7, top: 9, right: 9, borderRadius: 4, backgroundColor: '#E9B367' },
  hero: { borderRadius: 24, overflow: 'hidden', minHeight: 182, justifyContent: 'center', padding: 18 },
  heroWide: { minHeight: 221, paddingHorizontal: 35 },
  heroCopy: { zIndex: 1, alignSelf: 'flex-start', maxWidth: '74%', gap: 8 },
  heroCopyCompact: { maxWidth: '67%' },
  heroTitle: { color: '#FFF9F0', fontFamily: heading, fontSize: 27, lineHeight: 30 },
  heroTitleWide: { fontSize: 38, lineHeight: 41 },
  heroTitleCompact: { fontSize: 24, lineHeight: 27 },
  heroSub: { color: '#EDE3FA', fontSize: 12, lineHeight: 17 },
  heroAction: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: '#F7DCA6', borderRadius: 12, marginTop: 3, minHeight: 44, paddingHorizontal: 12 },
  heroActionText: { color: '#39265D', fontWeight: '700', fontSize: 12 },
  heroArt: { position: 'absolute', right: -7, top: '50%', transform: [{ translateY: -74 }] },
  heroArtWide: { right: 46, transform: [{ translateY: -118 }] },
  heroArtCompact: { right: -2, transform: [{ translateY: -53 }] },
  section: { gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionLabel: { flex: 1, gap: 2 },
  sectionTitle: { fontFamily: heading, fontSize: 23, color: c.ink, lineHeight: 28 },
  link: { color: c.purpleDark, fontSize: 12, fontWeight: '700' },
  meta: { color: c.muted, fontSize: 12, lineHeight: 19 },
  categories: { gap: 8, paddingBottom: 2 },
  category: { width: 74, alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 8, minHeight: 80, backgroundColor: c.white },
  categoryWide: { width: 135, flexDirection: 'row', minHeight: 62, justifyContent: 'flex-start', paddingHorizontal: 11 },
  categoryActive: { borderColor: c.purple, backgroundColor: c.lavender },
  categoryName: { color: c.ink, fontWeight: '600', fontSize: 11, textAlign: 'center' },
  featuredRail: { gap: 12, paddingBottom: 2 },
  courseGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  feedback: { padding: 22, alignItems: 'center', gap: 10, backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 20 },
  overlay: { flex: 1, backgroundColor: '#21193388', alignItems: 'center', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 520, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: c.paper, padding: 24, paddingBottom: 36, gap: 16 },
  levelOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelChoice: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 12, backgroundColor: c.white, borderWidth: 1, borderColor: c.border },
});
