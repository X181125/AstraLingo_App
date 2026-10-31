import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth';
import { api, ApiError } from '../../src/api';
import type { Course, Enrollment } from '../../src/types';
import { colors as c, heading } from '../../src/theme';
import { Button, Notice } from '../../components/UI';
import { Artwork } from '../../components/Artwork';

export default function CourseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(), auth = useAuth();
  const [course, setCourse] = useState<Course | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [enrolled, setEnrolled] = useState(false), [expanded, setExpanded] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!auth.token) return;
    let active = true; setLoading(true); setError('');
    Promise.all([api<Course>(`/courses/${encodeURIComponent(id)}`), api<Enrollment[]>('/me/enrollments', { token: auth.token })]).then(([data, list]) => { if (active) { setCourse(data); setEnrolled(list.some(x => x.courseId === id)); } }).catch(e => { if (active) setError(e.message); if (e instanceof ApiError && e.status === 401) void auth.logout(); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, auth.token, retry]);
  if (!auth.loading && !auth.user) return <Redirect href="/login" />;
  async function enroll() {
    if (busy) return; setBusy(true); setError('');
    try { await api(`/courses/${id}/enroll`, { method: 'POST', token: auth.token }); setEnrolled(true); }
    catch (e) { setError((e as Error).message); if (e instanceof ApiError && e.status === 401) await auth.logout(); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }}><ScrollView contentContainerStyle={st.container}>
    <Pressable accessibilityRole="button" accessibilityLabel="Quay về Trang chủ" onPress={() => router.replace('/(tabs)/home')} style={st.back}><Ionicons name="arrow-back" size={20} color={c.ink} /><Text style={{ color: c.muted, fontSize: 12 }}>Khám phá khóa học</Text></Pressable>
    {loading ? <ActivityIndicator color={c.purple} style={{ padding: 60 }} /> : course && <><View style={[st.hero, { backgroundColor: course.accent }]}><Text style={st.tag}>{course.level} · TIẾNG ANH</Text><Artwork kind={course.illustration} size={185} /></View><Text style={st.title}>{course.title}</Text><View style={st.meta}><Text style={st.metaText}>{course.category.name}</Text><Text style={st.metaText}>{course.lessonsCount} bài</Text><Text style={st.metaText}>{course.minutes} phút</Text><Text style={[st.metaText, { color: c.green }]}>Miễn phí</Text></View><Text style={st.description}>{course.description}</Text><Text style={st.section}>Bên trong hành trình</Text><View style={{ gap: 9 }}>{course.lessons?.map((lesson, i) => <Pressable accessibilityRole="button" accessibilityLabel={`Giới thiệu bài ${lesson.title}`} key={lesson.id} onPress={() => setExpanded(expanded === lesson.id ? '' : lesson.id)} style={st.lesson}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}><View style={st.number}><Text style={{ color: c.purple, fontFamily: heading }}>{String(i + 1).padStart(2, '0')}</Text></View><View style={{ flex: 1 }}><Text style={{ color: c.ink, fontSize: 14, fontWeight: '600' }}>{lesson.title}</Text><Text style={{ color: c.muted, fontSize: 10, marginTop: 5 }}>{lesson.contentType} · {lesson.minutes} phút · Giới thiệu</Text></View><Ionicons name={expanded === lesson.id ? 'chevron-up' : 'chevron-down'} size={17} color={c.muted} /></View>{expanded === lesson.id && <Text style={{ color: c.muted, fontSize: 13, lineHeight: 21, marginTop: 14 }}>{lesson.preview}</Text>}</Pressable>)}</View><View style={st.note}><Ionicons name="information-circle-outline" color={c.purple} size={20} /><Text style={{ color: '#867399', fontSize: 12, flex: 1, lineHeight: 20 }}>Đây là dữ liệu mẫu để thử luồng Home. Phần thực hành và chấm bài sẽ có ở giai đoạn Study.</Text></View><Notice message={error} />{enrolled ? <><Notice success message="Khóa học đã nằm trong lộ trình của bạn." /><Button label="Xem lộ trình của tôi" secondary onPress={() => router.push('/(tabs)/profile')} /></> : <Button label="Thêm vào lộ trình" icon="add-outline" loading={busy} onPress={enroll} />}</>}
    {!loading && !course && <><Notice message={error || 'Không tìm thấy khóa học.'} /><Button label="Thử lại" onPress={() => setRetry(n => n + 1)} /></>}
  </ScrollView></SafeAreaView>;
}
const st = StyleSheet.create({ container: { padding: 24, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center', gap: 19 }, back: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8 }, hero: { borderRadius: 25, height: 220, alignItems: 'center', justifyContent: 'center' }, tag: { position: 'absolute', left: 20, top: 17, color: '#746085', fontSize: 10, fontWeight: '700', letterSpacing: 1 }, title: { fontFamily: heading, fontSize: 31, color: c.ink }, meta: { flexDirection: 'row', gap: 15, flexWrap: 'wrap' }, metaText: { fontSize: 12, color: c.muted }, description: { color: '#8C8297', fontSize: 14, lineHeight: 25 }, section: { fontFamily: heading, fontSize: 23, color: c.ink, marginTop: 6 }, lesson: { padding: 16, backgroundColor: 'white', borderWidth: 1, borderColor: c.border, borderRadius: 16 }, number: { height: 35, width: 35, borderRadius: 11, backgroundColor: c.lavender, alignItems: 'center', justifyContent: 'center' }, note: { flexDirection: 'row', padding: 14, gap: 10, borderRadius: 14, backgroundColor: '#F0EBF7' } });
