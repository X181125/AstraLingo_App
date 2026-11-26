import React, { useCallback, useState } from 'react';
import { ActivityIndicator, View } from "react-native";
import { Text } from "@/components/typography";
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth';
import { api, ApiError } from '../../src/api';
import type { Enrollment } from '../../src/types';
import { heading } from '../../src/theme';
import { Button, Notice } from '../../components/UI';
import { StudyProgress } from '../../components/StudyProgress';
import { Copy, LearningScreen, Panel, Section, useLearningColors } from '../../components/Learning';
import { DiscoveryRow, type IconName } from '../../components/DiscoveryUI';
import { languageName } from '../../src/learning';

export default function Profile() {
  const c = useLearningColors();
  const auth = useAuth();
  const [courses, setCourses] = useState<Enrollment[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0);
  useFocusEffect(useCallback(() => {
    if (!auth.token) return;
    let active = true; setLoading(true); setError(''); setCourses([]);
    api<Enrollment[]>('/me/enrollments', { token: auth.token }).then(v => { if (active) setCourses(v); }).catch(e => { if (active) setError(e.message); if (active && e instanceof ApiError && e.status === 401) void auth.expire(auth.token); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.token, refresh]));
  const initials = auth.user?.name.trim().split(/\s+/).slice(-2).map(part => part.charAt(0).toUpperCase()).join('');
  return <LearningScreen title="Góc của bạn">
    <View style={{ padding: 18, borderRadius: 22, backgroundColor: '#432C75', gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
        <View style={{ width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7DCA6' }}>
          <Text style={{ fontFamily: heading, fontSize: 22, color: '#39265D' }}>{initials}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={{ fontFamily: heading, fontSize: 25, color: '#FFF9F0' }}>{auth.user?.name}</Text>
          <Text selectable style={{ color: '#EEE4F8', fontSize: 13 }}>{auth.user?.email}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <Ionicons name="globe-outline" size={16} color="#F7DCA6" />
        <Text style={{ color: '#FFF9F0', fontSize: 12 }}>{languageName[auth.user?.nativeLang ?? 'vi']} → Tiếng Anh · Trình độ {auth.user?.level}</Text>
      </View>
    </View>
    <StudyProgress />
    <Section title={`Khóa học trong lộ trình (${courses.length})`}>
      {loading ? <ActivityIndicator color={c.purple} /> : error ? <><Notice message={error} /><Button label="Tải lại" secondary onPress={() => setRefresh(n => n + 1)} /></>
        : courses.length ? courses.map(item => <DiscoveryRow key={item.courseId} icon={item.course.category.icon as IconName} title={item.course.title}
          detail={`${item.course.level} · ${item.course.lessonsCount} bài học`} onPress={() => router.push(`/course/${item.courseId}`)} />)
        : <Panel><Copy>Bạn chưa thêm khóa học vào lộ trình.</Copy><Button label="Khám phá khóa học" secondary onPress={() => router.push('/(tabs)/home')} /></Panel>}
    </Section>
    <Section title="Tài khoản">
      <DiscoveryRow title="Chỉnh sửa hồ sơ" icon="settings-outline" onPress={() => router.push('/settings')} />
      <DiscoveryRow title="Đăng xuất" icon="log-out-outline" onPress={auth.logout} />
    </Section>
  </LearningScreen>;
}
