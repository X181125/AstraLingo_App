import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Text } from '@/components/typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Artwork } from '@/components/Artwork';
import { Ionicons } from '@expo/vector-icons';

import { router, useLocalSearchParams } from 'expo-router';

import { api } from '../../../src/api';
import type { Category, Course } from '../../../src/types';
import { colors, heading, useAppColors } from '../../../src/theme';
import { Brand, Button, Notice } from '../../../components/UI';

import { CourseCard } from '../../../components/CourseCard';
import { IconTile, SearchBox } from '../../../components/DiscoveryUI';
import { HomeMentors } from '../../../components/HomeMentors';

export default function Home() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const c = useAppColors();
  const st = React.useMemo(() => makeStyles(c), [c]);

  const { width } = useWindowDimensions();
  const wide = width >= 820;

  const horizontalPadding = 24;
  const contentWidth = Math.min(width, 920) - horizontalPadding * 2;
  const featuredCardWidth = wide ? Math.floor((contentWidth - 24) / 3) : Math.min(280, contentWidth - 32);
  const scroll = useRef<ScrollView>(null);
  const [query, setQuery] = useState(''),
    [debounced, setDebounced] = useState(''),
    [category, setCategory] = useState('');
  const [level, setLevel] = useState(''),
    [filters, setFilters] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]),
    [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [error, setError] = useState(''),
    [total, setTotal] = useState(0);
  const filterKey = JSON.stringify([debounced, category, level]);
  const [pagination, setPagination] = useState({ key: '', page: 1 });
  if (pagination.key !== filterKey) setPagination({ key: filterKey, page: 1 });
  const page = pagination.page;
  const [hasMore, setHasMore] = useState(false);
  const reload = () => {
    setPagination({ key: filterKey, page: 1 });
    setRefresh((n) => n + 1);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: '12', page: String(page), q: debounced });
    if (category) params.set('category', category);
    if (level) params.set('level', level);
    Promise.all([
      api<Category[]>('/categories', { signal: controller.signal }),
      api<{ items: Course[]; total: number; hasMore: boolean }>(`/courses?${params}`, {
        signal: controller.signal,
      }),
    ])
      .then(([cats, result]) => {
        if (controller.signal.aborted) return;
        setCategories(cats);
        setCourses((previous) =>
          page === 1
            ? result.items
            : [...previous, ...result.items.filter((item) => !previous.some((old) => old.id === item.id))],
        );
        setTotal(result.total);
        setHasMore(result.hasMore);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError((e as Error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debounced, category, level, refresh, page]);

  const filtered = Boolean(debounced || category || level);
  const clearSearch = () => {
    setQuery('');
    setDebounced('');
  };
  const reset = () => {
    clearSearch();
    setCategory('');
    setLevel('');
  };
  const orderedCategories = [...categories].sort(
    (a, b) => Number(a.id === 'all-skills') - Number(b.id === 'all-skills'),
  );
  const featured = filtered || error ? [] : courses.filter((course) => course.featured).slice(0, 3);
  const catalogue = courses.filter((course) => !featured.includes(course));
  const showCatalogue = filtered || loading || error || catalogue.length > 0 || hasMore || !featured.length;

  return (
    <SafeAreaView edges={['top']} style={st.screen}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={loading && refresh > 0} onRefresh={reload} tintColor={c.purple} />
        }
        contentContainerStyle={[st.container, { paddingHorizontal: horizontalPadding }]}
      >
        <View style={st.topBar}>
          <Brand small />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở hồ sơ cá nhân"
            onPress={() => router.push('/(tabs)/profile')}
            style={st.avatar}
          >
            <Ionicons name="person-outline" color={c.purpleDark} size={21} />
          </Pressable>
        </View>
        <View style={st.searchRow}>
          <SearchBox
            key={focus}
            autoFocus={focus === 'search'}
            label="Tìm kiếm nội dung và khóa học"
            placeholder="Search for…"
            value={query}
            onChange={setQuery}
            onSubmit={() => setDebounced(query.trim())}
            clear={clearSearch}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bộ lọc khóa học"
            accessibilityState={{ selected: Boolean(level) }}
            onPress={() => setFilters(true)}
            style={[st.filterButton, { backgroundColor: c.purple }]}
          >
            <Ionicons name="options-outline" size={22} color={c.white} />
            {!!level && <View style={st.filterDot} />}
          </Pressable>
        </View>
        {!filtered && (
          <LinearGradient
            colors={['#242147', '#37337D', '#28539D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={st.hero}
          >
            <View style={st.heroCopy}>
              <Text style={st.heroTitle}>English exam practice</Text>
              <Text style={st.heroSub}>
                Practise SAT Reading and Writing with a full paper or a short English quiz.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose an exam"
                onPress={() => router.push('/study/exam')}
                style={st.heroAction}
              >
                <Text style={st.heroActionText}>Choose an exam</Text>
                <Ionicons name="arrow-forward" size={17} color="#18365B" />
              </Pressable>
            </View>
            <View style={st.planet}>
              <Artwork size={90} dark />
            </View>
          </LinearGradient>
        )}
        {!filtered && (
          <View style={st.section}>
            <View style={st.sectionHead}>
              <Text accessibilityRole="header" style={st.sectionTitle}>
                Categories
              </Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/home/category')}>
                <Text style={st.link}>See all ›</Text>
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push('/home/category')}>
              <Text style={st.link}>English</Text>
            </Pressable>
          </View>
        )}
        <View style={st.section}>
          <View style={st.sectionHead}>
            <Text accessibilityRole="header" style={st.sectionTitle}>
              Popular Courses
            </Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/home/search')}>
              <Text style={st.link}>See all ›</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.categories}>
            {[{ id: '', name: 'All' }, ...orderedCategories].map((cat) => (
              <Pressable
                accessibilityRole="button"
                key={cat.id}
                accessibilityLabel={`Danh mục ${cat.name}`}
                accessibilityState={{ selected: category === cat.id }}
                style={[st.category, category === cat.id && st.categoryActive]}
                onPress={() => setCategory(cat.id)}
              >
                <Text style={[st.categoryName, category === cat.id && { color: '#fff' }]}>{cat.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        {!!featured.length && (
          <View style={st.section}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={st.featuredRail}
              snapToInterval={wide ? undefined : featuredCardWidth + 12}
              decelerationRate="fast"
            >
              {featured.map((course) => (
                <CourseCard key={course.id} course={course} width={featuredCardWidth} featured />
              ))}
            </ScrollView>
          </View>
        )}
        {!filtered && (
          <HomeMentors
            categories={categories}
            onChoose={(id) => {
              setCategory(id);
              scroll.current?.scrollTo({ y: 0, animated: false });
            }}
          />
        )}
        {showCatalogue && (
          <View style={st.section}>
            <View style={st.sectionHead}>
              <View style={st.sectionLabel}>
                <Text accessibilityRole="header" style={st.sectionTitle}>
                  {filtered
                    ? 'Kết quả tìm kiếm'
                    : featured.length
                      ? 'Các khóa học khác'
                      : 'Khóa học tiếng Anh'}
                </Text>
                {!loading && !error && (
                  <Text style={st.meta}>
                    {total - featured.length} khóa học{level ? ` · ${level}` : ''}
                  </Text>
                )}
              </View>
              {filtered && (
                <Pressable accessibilityRole="button" onPress={reset}>
                  <Text style={st.link}>Xóa bộ lọc</Text>
                </Pressable>
              )}
            </View>
            {error ? (
              <View style={{ gap: 12 }}>
                <Notice message={error} />
                <Button secondary label="Thử tải lại" onPress={reload} />
              </View>
            ) : loading && page === 1 ? (
              <View style={st.feedback}>
                <ActivityIndicator color={c.purple} />
                <Text style={st.meta}>Đang tải khóa học…</Text>
              </View>
            ) : catalogue.length ? (
              <View style={st.courseGrid}>
                {catalogue.map((course) => (
                  <CourseCard key={course.id} course={course} width={wide ? '49%' : '100%'} />
                ))}
              </View>
            ) : (
              !hasMore && (
                <View style={st.feedback}>
                  <IconTile icon="search-outline" size={48} />
                  <Text style={st.sectionTitle}>Chưa tìm thấy khóa học</Text>
                  <Text style={st.meta}>Thử từ khóa khác hoặc bỏ bớt bộ lọc.</Text>
                  <Button secondary label="Xem tất cả khóa học" onPress={reset} />
                </View>
              )
            )}
            {!error && hasMore && (page > 1 || !loading) && (
              <Button
                secondary
                loading={loading}
                label="Xem thêm khóa học"
                onPress={() => setPagination({ key: filterKey, page: page + 1 })}
              />
            )}
          </View>
        )}
      </ScrollView>
      <Modal visible={filters} transparent animationType="fade" onRequestClose={() => setFilters(false)}>
        <View style={st.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFilters(false)} accessible={false} />
          <View style={st.sheet} accessibilityViewIsModal>
            <View style={st.sectionHead}>
              <Text accessibilityRole="header" style={st.sectionTitle}>
                Lọc theo trình độ
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng bộ lọc"
                onPress={() => setFilters(false)}
                style={st.filterButton}
              >
                <Ionicons name="close" size={21} color={c.ink} />
              </Pressable>
            </View>
            <View style={st.levelOptions}>
              {['', 'A1', 'A2', 'B1', 'B2'].map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: level === value }}
                  onPress={() => setLevel(value)}
                  style={[st.levelChoice, level === value && st.categoryActive]}
                >
                  <Text style={{ color: c.ink }}>{value || 'Tất cả'}</Text>
                </Pressable>
              ))}
            </View>
            <Button label="Xem khóa học" onPress={() => setFilters(false)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c: typeof colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.paper },
    container: {
      width: '100%',
      maxWidth: 920,
      alignSelf: 'center',
      paddingTop: 14,
      paddingBottom: 32,
      gap: 19,
    },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.lavender,
      borderWidth: 1,
      borderColor: c.border,
    },
    searchRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
    filterButton: {
      width: 52,
      minHeight: 44,
      borderRadius: 16,
      backgroundColor: c.white,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterDot: {
      position: 'absolute',
      width: 7,
      height: 7,
      top: 9,
      right: 9,
      borderRadius: 4,
      backgroundColor: '#E9B367',
    },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 22,
      padding: 22,
      backgroundColor: '#0961F5',
    },
    heroCopy: { flex: 1, gap: 8 },
    planet: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTitle: { color: '#fff', fontFamily: heading, fontSize: 25, lineHeight: 30 },
    heroSub: { color: '#F4F8FF', fontSize: 14, lineHeight: 20, maxWidth: 385 },
    heroAction: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginTop: 5,
      padding: 12,
      borderRadius: 12,
      backgroundColor: '#FFE29A',
    },
    heroActionText: { color: '#18365B', fontWeight: '700' },
    section: { gap: 12 },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    sectionLabel: { flex: 1, gap: 2 },
    sectionTitle: { fontFamily: heading, fontSize: 23, color: c.ink, lineHeight: 28 },
    link: { color: c.purpleDark, fontSize: 12, fontWeight: '700' },
    meta: { color: c.muted, fontSize: 12, lineHeight: 19 },
    categories: { gap: 8, paddingBottom: 2 },
    category: {
      justifyContent: 'center',
      borderRadius: 20,
      paddingHorizontal: 17,
      minHeight: 34,
      backgroundColor: c.lavender,
    },
    categoryActive: { backgroundColor: '#167F71' },
    categoryName: { fontWeight: '600', fontSize: 14, color: c.ink },
    featuredRail: { gap: 12, paddingBottom: 2 },
    courseGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
    feedback: {
      padding: 22,
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.white,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
    },
    overlay: { flex: 1, backgroundColor: '#21193388', alignItems: 'center', justifyContent: 'flex-end' },
    sheet: {
      width: '100%',
      maxWidth: 520,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: c.paper,
      padding: 24,
      paddingBottom: 36,
      gap: 16,
    },
    levelOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    levelChoice: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 13,
      borderRadius: 12,
      backgroundColor: c.white,
      borderWidth: 1,
      borderColor: c.border,
    },
  });
