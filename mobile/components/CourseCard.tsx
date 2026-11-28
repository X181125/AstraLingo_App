import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/typography';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Course } from '../src/types';
import { heading, useAppColors } from '../src/theme';
import { Artwork } from './Artwork';

export function CourseCard({
  course,
  width,
  featured = false,
}: {
  course: Course;
  width: number | `${number}%`;
  featured?: boolean;
}) {
  const c = useAppColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem khóa học ${course.title}`}
      onPress={() => router.push(`/course/${course.id}`)}
      style={({ pressed }) => [
        s.card,
        featured && s.featuredCard,
        { width, borderColor: c.border, backgroundColor: pressed ? c.lavender : c.white },
      ]}
    >
      <View
        style={[s.cover, featured && s.featuredCover, { backgroundColor: course.accent }]}
        pointerEvents="none"
      >
        <Artwork kind={course.illustration} size={featured ? 137 : 77} />
      </View>
      <View style={[s.details, featured && { padding: 15 }]}>
        <View style={s.body}>
          <Text style={[s.category, { color: c.purpleDark }]}>
            {course.category.name} · {course.level}
          </Text>
          <Text style={[s.title, { color: c.ink }]} numberOfLines={2}>
            {course.title}
          </Text>
          <Text style={[s.meta, { color: c.muted }]}>
            {course.lessonsCount} bài · {course.minutes} phút
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.purple} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 96,
    padding: 12,
    gap: 12,
    borderRadius: 19,
    borderWidth: 1,
  },
  featuredCard: { flexDirection: 'column', alignItems: 'stretch', padding: 0, gap: 0, overflow: 'hidden' },
  cover: {
    width: 72,
    height: 72,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  featuredCover: { width: '100%', height: 140, borderRadius: 0 },
  details: { flexDirection: 'row', alignItems: 'center', flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 8 },
  body: { flex: 1, minWidth: 0, gap: 3, paddingVertical: 2 },
  category: { fontSize: 11, fontWeight: '700' },
  title: { fontFamily: heading, fontSize: 17, lineHeight: 21 },
  meta: { fontSize: 12, lineHeight: 16 },
});
