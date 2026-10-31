import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '../../src/auth';
import { api, ApiError } from '../../src/api';
import type { Category, Course } from '../../src/types';
import { colors as c, heading } from '../../src/theme';
import { Brand, Button, Notice } from '../../components/UI';
import { Artwork } from '../../components/Artwork';
import { CourseCard } from '../../components/CourseCard';

export default function Home() {
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const wide = width > 720;
  const scroll = useRef<ScrollView>(null);
  const [query, setQuery] = useState(''), [debounced, setDebounced] = useState(''), [category, setCategory] = useState('');
  const [level, setLevel] = useState(''), [filters, setFilters] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]), [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0), [error, setError] = useState(''), [total, setTotal] = useState(0);
  useEffect(() => { const id = setTimeout(() => setDebounced(query.trim()), 350); return () => clearTimeout(id); }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const params = new URLSearchParams({ limit: '50', q: debounced });
    if (category) params.set('category', category);
    if (level) params.set('level', level);
    Promise.all([api<Category[]>('/categories', { signal: controller.signal }), api<{ items: Course[]; total: number }>(`/courses?${params}`, { signal: controller.signal })])
      .then(([cats, result]) => { if (!controller.signal.aborted) { setCategories(cats); setCourses(result.items); setTotal(result.total); } })
      .catch(e => { if (!controller.signal.aborted) setError((e as Error).message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [debounced, category, level, refresh]);
  const filtered = !!(debounced || category || level);
  const reset = () => { setQuery(''); setDebounced(''); setCategory(''); setLevel(''); };
  const firstName = auth.user?.name.split(' ').at(-1) ?? 'bạn';
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.paper }}>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading && refresh > 0} onRefresh={() => setRefresh(n => n + 1)} tintColor={c.purple} />} contentContainerStyle={{ alignItems: 'center', paddingBottom: 26 }}>
      <View style={[st.container, wide && { paddingHorizontal: 36 }]}>
        <View style={st.header}><Brand small /><Pressable accessibilityRole="button" accessibilityLabel="Mở hồ sơ cá nhân" onPress={() => router.push('/(tabs)/profile')} style={st.avatar}><Text style={st.avatarText}>{firstName.slice(0, 1).toUpperCase()}</Text><View style={st.online} /></Pressable></View>
        <View style={st.greeting}><View><Text style={st.hello}>Chào {firstName}, một ngày thật vui <Text style={{ color: '#D79D4B' }}>☀</Text></Text><Text style={st.title}>Hôm nay bạn muốn{wide ? ' ' : '\n'}khám phá điều gì?</Text></View><View style={st.languagePill}><Ionicons name="globe-outline" size={15} color={c.purple} /><Text style={st.languageText}>{auth.user?.level} · English</Text></View></View>
        <View style={st.searchRow}><View style={st.search}><Ionicons name="search-outline" size={21} color="#9B91AE" /><TextInput accessibilityLabel="Tìm kiếm nội dung và khóa học" placeholder="Tìm nội dung, khóa học..." placeholderTextColor="#A69CAF" value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" onSubmitEditing={() => setDebounced(query.trim())} style={[st.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} />{!!query && <Pressable accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm" onPress={() => { setQuery(''); setDebounced(''); }} hitSlop={10}><Ionicons name="close-circle" size={18} color={c.muted} /></Pressable>}</View><Pressable accessibilityRole="button" accessibilityLabel="Bộ lọc khóa học" onPress={() => setFilters(true)} style={[st.filterButton, !!(level) && { backgroundColor: c.lavender }]}><Ionicons name="options-outline" size={22} color={c.purple} />{!!(level) && <View style={st.filterDot} />}</Pressable></View>
        {!filtered && <LinearGradient colors={['#7455C7', '#8E70D7']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={st.hero}>
          <View style={{ flex: 1, zIndex: 1 }}><View style={st.heroTag}><Ionicons name="sparkles" size={10} color="#F9DBA9" /><Text style={st.heroTagText}>MỘT CHÚT MỖI NGÀY</Text></View><Text style={[st.heroTitle, wide && { fontSize: 31, lineHeight: 39 }]}>10 phút hôm nay,{'\n'}cả thế giới ngày mai.</Text><Text style={st.heroSub}>Từng bước nhỏ. Tự tin lớn dần.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/course/english-first-steps')} style={st.heroAction}><Text style={st.heroActionText}>Bắt đầu khám phá</Text><Ionicons name="arrow-forward" size={15} color={c.purpleDark} /></Pressable></View>
          <View style={{ position: 'absolute', right: wide ? 20 : -18, top: wide ? -2 : 24, opacity: .95 }}><Artwork size={wide ? 240 : 170} dark /></View>
        </LinearGradient>}
        <View style={st.sectionHead}><Text style={st.sectionTitle}>Học theo cách của bạn</Text><Text style={st.sectionHint}>Từng kỹ năng, từng bước</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingBottom: 6 }}>
          {[{ id: '', name: 'Tất cả', icon: 'grid-outline' }, ...categories].map(cat => <Pressable accessibilityRole="button" accessibilityState={{ selected: category === cat.id }} accessibilityLabel={`Danh mục ${cat.name}`} key={cat.id} onPress={() => setCategory(cat.id)} style={[st.chip, category === cat.id && st.chipActive]}><Ionicons name={cat.icon as any} size={17} color={category === cat.id ? 'white' : '#9487AB'} /><Text style={[st.chipText, category === cat.id && { color: 'white' }]}>{cat.name}</Text></Pressable>)}
        </ScrollView>
        <View style={[st.sectionHead, { marginTop: 28 }]}><View><Text style={st.sectionTitle}>{filtered ? 'Kết quả khám phá' : 'Khóa học dành cho bạn'}</Text><Text style={st.sectionSub}>{loading ? 'Đang tìm những điều thú vị...' : `${total} khóa học ${filtered ? 'phù hợp' : 'để bắt đầu hành trình'}`}</Text></View>{filtered && <Pressable accessibilityRole="button" onPress={reset}><Text style={st.reset}>Xóa bộ lọc</Text></Pressable>}</View>
        {!!(level) && <Text style={{ color: c.purple, fontSize: 12, marginBottom: 14 }}>{`Trình độ ${level} · Tiếng Anh`}</Text>}
        {!!error ? <View style={{ gap: 12 }}><Notice message={error} /><Button secondary label="Thử tải lại" onPress={() => setRefresh(n => n + 1)} /></View> : loading ? <View style={{ padding: 50 }}><ActivityIndicator color={c.purple} /><Text style={{ color: c.muted, textAlign: 'center', marginTop: 12, fontSize: 12 }}>Đang tải khóa học...</Text></View> : courses.length ? <View style={st.grid}>{courses.map(course => <CourseCard key={course.id} course={course} width={wide ? '31.8%' : width < 370 ? '100%' : '48%'} />)}</View> : <View style={st.empty}><Ionicons name="telescope-outline" size={42} color="#B4A2D7" /><Text style={st.emptyTitle}>Chưa tìm thấy khóa học</Text><Text style={st.emptyText}>Thử một từ khóa khác hoặc bỏ bớt bộ lọc nhé.</Text><Button secondary label="Xem tất cả khóa học" onPress={reset} /></View>}
        <View style={st.bottomNote}><Ionicons name="heart-outline" size={14} color="#A99ABC" /><Text style={st.bottomText}>Học chậm một chút cũng được. Miễn là bạn tiếp tục.</Text></View>
      </View>
    </ScrollView>
    <Modal visible={filters} transparent animationType="fade" onRequestClose={() => setFilters(false)}><View style={st.overlay}><Pressable accessibilityLabel="Đóng bộ lọc" onPress={() => setFilters(false)} style={StyleSheet.absoluteFill} /><View style={st.sheet}><View style={st.sectionHead}><Text style={st.sectionTitle}>Tìm hành trình phù hợp</Text><Pressable accessibilityRole="button" accessibilityLabel="Đóng bộ lọc" onPress={() => setFilters(false)}><Ionicons name="close" size={22} color={c.ink} /></Pressable></View><Text style={st.filterLabel}>Trình độ</Text><View style={st.options}>{['', 'A1', 'A2', 'B1', 'B2'].map(v => <Pressable accessibilityRole="button" accessibilityState={{ selected: level === v }} key={v} onPress={() => setLevel(v)} style={[st.chip, level === v && st.chipActive]}><Text style={[st.chipText, level === v && { color: 'white' }]}>{v || 'Tất cả'}</Text></Pressable>)}</View><Button label="Xem khóa học" onPress={() => setFilters(false)} /><Pressable accessibilityRole="button" onPress={() => { setLevel(''); }} style={{ alignSelf: 'center', paddingTop: 17 }}><Text style={st.reset}>Đặt lại bộ lọc</Text></Pressable></View></View></Modal>
  </SafeAreaView>;
}
const st = StyleSheet.create({
  container: { width: '100%', maxWidth: 1080, paddingHorizontal: 22 },
  header: { paddingTop: 18, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: { width: 39, height: 39, borderRadius: 15, backgroundColor: '#F0E6D5', alignItems: 'center', justifyContent: 'center' }, avatarText: { fontFamily: heading, color: '#95764C', fontSize: 21 }, online: { position: 'absolute', right: -1, bottom: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#82AF91', borderColor: c.paper, borderWidth: 2 },
  greeting: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 21 }, hello: { fontSize: 12, color: c.muted, marginBottom: 8 }, title: { fontFamily: heading, fontSize: 28, lineHeight: 36, color: c.ink, letterSpacing: -.4 },
  languagePill: { flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: c.lavender, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, marginBottom: 4 }, languageText: { fontSize: 9, color: c.purple, fontWeight: '700' },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 25 }, search: { flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: c.border, borderRadius: 15, paddingHorizontal: 15, height: 53, flexDirection: 'row', alignItems: 'center', gap: 10 }, searchInput: { flex: 1, minWidth: 0, height: '100%', fontSize: 13, color: c.ink }, filterButton: { width: 52, borderWidth: 1, borderColor: c.border, borderRadius: 15, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' }, filterDot: { width: 7, height: 7, backgroundColor: '#DDA354', borderRadius: 5, position: 'absolute', right: 10, top: 10 },
  hero: { padding: 23, minHeight: 214, borderRadius: 24, marginBottom: 28, overflow: 'hidden', flexDirection: 'row' }, heroTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }, heroTagText: { color: '#E9DFFB', fontSize: 8, letterSpacing: 1.4, fontWeight: '700' }, heroTitle: { color: '#FFFDF8', fontFamily: heading, fontSize: 23, lineHeight: 30 }, heroSub: { color: '#DCD0F5', fontSize: 11, marginTop: 8 }, heroAction: { alignSelf: 'flex-start', flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#FBF8EE', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 13, marginTop: 20 }, heroActionText: { color: c.purpleDark, fontSize: 11, fontWeight: '700' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 10 }, sectionTitle: { fontFamily: heading, fontSize: 20, color: c.ink }, sectionHint: { fontSize: 9, color: '#A49BAD' }, sectionSub: { fontSize: 11, color: c.muted, marginTop: 5 },
  chip: { borderWidth: 1, borderColor: c.border, backgroundColor: 'white', paddingHorizontal: 13, paddingVertical: 12, borderRadius: 13, flexDirection: 'row', gap: 7, alignItems: 'center' }, chipActive: { backgroundColor: c.purple, borderColor: c.purple }, chipText: { fontSize: 11, color: '#83778F', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 17 },
  reset: { fontSize: 11, color: c.purple, fontWeight: '600' }, empty: { padding: 25, alignItems: 'center', gap: 16, backgroundColor: 'white', borderRadius: 20, borderColor: c.border, borderWidth: 1 }, emptyTitle: { fontFamily: heading, fontSize: 21, color: c.ink }, emptyText: { color: c.muted, fontSize: 13, textAlign: 'center', lineHeight: 21 },
  bottomNote: { flexDirection: 'row', justifyContent: 'center', gap: 6, alignItems: 'center', marginVertical: 27 }, bottomText: { fontSize: 9, color: '#A69BAD', flexShrink: 1 },
  overlay: { flex: 1, backgroundColor: '#21193366', justifyContent: 'flex-end', alignItems: 'center' }, sheet: { padding: 27, paddingBottom: 36, backgroundColor: c.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, width: '100%', maxWidth: 510 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 26 }, filterLabel: { color: '#74697F', fontSize: 12, fontWeight: '600', marginBottom: 12 },
});
