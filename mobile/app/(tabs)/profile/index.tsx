import React, { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '@/components/typography';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../src/auth';
import { api, ApiError } from '../../../src/api';
import type { Enrollment } from '../../../src/types';
import { heading } from '../../../src/theme';
import { Button, Notice } from '../../../components/UI';
import { StudyProgress } from '../../../components/StudyProgress';
import { Copy, LearningScreen, Panel, Section, useLearningColors } from '../../../components/Learning';
import { DiscoveryRow, type IconName } from '../../../components/DiscoveryUI';
import { languageName } from '../../../src/learning';

export default function Profile() {
  const c = useLearningColors();
  const auth = useAuth();
  const [courses, setCourses] = useState<Enrollment[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!auth.token) return;
      let active = true;
      setLoading(true);
      setError('');
      setCourses([]);
      api<Enrollment[]>('/me/enrollments', { token: auth.token })
        .then((v) => {
          if (active) setCourses(v);
        })
        .catch((e) => {
          if (active) setError(e.message);
          if (active && e instanceof ApiError && e.status === 401) void auth.expire(auth.token);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [auth.token, refresh]),
  );
  const initials = auth.user?.name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  return (
    <LearningScreen title="">
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.lavender,
          }}
        >
          <Text style={{ fontFamily: heading, color: c.purple }}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: heading, fontSize: 22, color: c.ink }}>{auth.user?.name}</Text>
          <Text style={{ color: c.muted }}>{auth.user?.email}</Text>
        </View>
        <Ionicons
          accessibilityRole="button"
          accessibilityLabel="Chỉnh sửa hồ sơ"
          onPress={() => router.push('/settings')}
          name="create-outline"
          size={25}
          color={c.ink}
        />
      </View>
      <Section title="Account settings">
        <DiscoveryRow
          plain
          title="Personal Information"
          icon="person-outline"
          onPress={() => router.push('/profile/personal_information')}
        />
        <DiscoveryRow
          plain
          title="Learning language"
          detail="English"
          icon="language-outline"
          onPress={() => router.push('/profile/language-options')}
        />
        <DiscoveryRow
          plain
          title="Change theme"
          icon="sunny-outline"
          onPress={() => router.push('/profile/change-theme')}
        />
        <DiscoveryRow
          plain
          title="Delete account"
          icon="trash-outline"
          onPress={() => router.push('/profile/delete-account')}
        />
        <DiscoveryRow
          plain
          title="Support center"
          icon="help-buoy-outline"
          onPress={() => router.push('/profile/support-center')}
        />
        <DiscoveryRow
          plain
          title="FAQ"
          icon="chatbubbles-outline"
          onPress={() => router.push('/profile/faq')}
        />
        <Button label="Đăng xuất" secondary onPress={auth.logout} />
      </Section>
      <StudyProgress />
      <Section title={`Khóa học trong lộ trình (${courses.length})`}>
        {loading ? (
          <ActivityIndicator color={c.purple} />
        ) : error ? (
          <>
            <Notice message={error} />
            <Button label="Tải lại" secondary onPress={() => setRefresh((n) => n + 1)} />
          </>
        ) : courses.length ? (
          courses.map((item) => (
            <DiscoveryRow
              key={item.courseId}
              icon={item.course.category.icon as IconName}
              title={item.course.title}
              detail={`${item.course.level} · ${item.course.lessonsCount} bài học`}
              onPress={() => router.push(`/course/${item.courseId}`)}
            />
          ))
        ) : (
          <Panel>
            <Copy>Bạn chưa thêm khóa học vào lộ trình.</Copy>
            <Button label="Khám phá khóa học" secondary onPress={() => router.push('/(tabs)/home')} />
          </Panel>
        )}
      </Section>
    </LearningScreen>
  );
}
