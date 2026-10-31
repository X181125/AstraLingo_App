import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth';
import { api, ApiError } from '../../src/api';
import type { Enrollment } from '../../src/types';
import { colors as c, heading } from '../../src/theme';
import { Button, Notice } from '../../components/UI';

export default function Profile() {
  const auth = useAuth();
  const [courses, setCourses] = useState<Enrollment[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true; setLoading(true); setError('');
    api<Enrollment[]>('/me/enrollments', { token: auth.token }).then(v => { if (active) setCourses(v); }).catch(e => { if (active) setError(e.message); if (e instanceof ApiError && e.status === 401) void auth.logout(); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.token, refresh]));
  return <SafeAreaView edges={['top']} style={{ flex: 1 }}><ScrollView contentContainerStyle={{ padding: 26, width: '100%', maxWidth: 660, alignSelf: 'center', gap: 22 }}>
    <Text style={{ fontFamily: heading, fontSize: 29, color: c.ink }}>Góc của bạn</Text>
    <View style={{ padding: 24, borderRadius: 22, backgroundColor: c.lavender, gap: 8 }}><Text style={{ fontFamily: heading, fontSize: 25, color: c.purple }}>{auth.user?.name}</Text><Text style={{ color: '#897C9F' }}>{auth.user?.email}</Text><Text style={{ color: '#897C9F', fontSize: 12, marginTop: 7 }}>Tiếng Việt → Tiếng Anh · Trình độ {auth.user?.level}</Text></View>
    <Text style={{ fontFamily: heading, fontSize: 21, color: c.ink }}>Khóa học trong lộ trình ({courses.length})</Text>
    {loading ? <ActivityIndicator color={c.purple} /> : error ? <><Notice message={error} /><Button label="Tải lại" secondary onPress={() => setRefresh(n => n + 1)} /></> : courses.length ? courses.map(item => <Pressable key={item.courseId} accessibilityRole="button" onPress={() => router.push(`/course/${item.courseId}`)} style={{ padding: 19, borderRadius: 16, backgroundColor: 'white', borderColor: c.border, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}><Ionicons name="book-outline" color={c.purple} size={22} /><View style={{ flex: 1 }}><Text style={{ color: c.ink, fontWeight: '600', lineHeight: 21 }}>{item.course.title}</Text><Text style={{ color: c.muted, fontSize: 12, marginTop: 5 }}>{item.course.level} · {item.course.lessonsCount} bài giới thiệu</Text></View><Ionicons name="chevron-forward" color={c.muted} /></Pressable>) : <View style={{ gap: 17 }}><Text style={{ color: c.muted, lineHeight: 23 }}>Chưa có khóa học nào. Khám phá một chủ đề bạn thích và thêm vào lộ trình nhé.</Text><Button label="Khám phá khóa học" secondary onPress={() => router.push('/(tabs)/home')} /></View>}
    <Text style={{ color: c.muted, fontSize: 12, lineHeight: 20 }}>Chỉnh sửa hồ sơ và thống kê học tập sẽ được bổ sung ở phần Profile. Các khóa học đã thêm được lưu theo tài khoản.</Text>
    <Button secondary label="Đăng xuất" icon="log-out-outline" onPress={async () => { try { await auth.logout(); router.replace('/login'); } catch { setError('Chưa thể xóa phiên đăng nhập trên thiết bị. Hãy thử lại.'); } }} />
  </ScrollView></SafeAreaView>;
}
