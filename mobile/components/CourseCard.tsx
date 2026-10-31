import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Course } from '../src/types';
import { colors as c, heading } from '../src/theme';
import { Artwork } from './Artwork';

export function CourseCard({ course, width }: { course: Course; width: number | `${number}%` }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Xem khóa học ${course.title}`} onPress={() => router.push(`/course/${course.id}`)} style={({ pressed }) => [styles.card, { width }, pressed && { opacity: .85 }]}>
    <View style={[styles.cover, { backgroundColor: course.accent }]}>
      <View style={styles.level}><Text style={styles.levelText}>{course.level} · Tiếng Anh</Text></View>
      <Artwork kind={course.illustration} size={145} />
      <Text style={styles.coverCaption}>{course.category.name.toUpperCase()}</Text>
    </View>
    <View style={styles.body}><View style={styles.meta}><Text style={styles.category}>{course.category.name}</Text><Text style={styles.free}>Miễn phí</Text></View>
      <Text style={styles.title} numberOfLines={2}>{course.title}</Text>
      <Text style={styles.description} numberOfLines={2}>{course.description}</Text>
      <View style={styles.bottom}><View style={styles.info}><Ionicons name="layers-outline" size={13} color={c.muted} /><Text style={styles.detail}>{course.lessonsCount} bài</Text><Text style={styles.dot}>·</Text><Text style={styles.detail}>{course.minutes} phút</Text></View><View style={styles.arrow}><Ionicons name="arrow-forward" size={15} color={c.purple} /></View></View>
    </View>
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: 'white', borderWidth: 1, borderColor: c.border, borderRadius: 22, overflow: 'hidden' },
  cover: { height: 166, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  level: { position: 'absolute', left: 12, top: 12, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, backgroundColor: '#FFFFFFB8', zIndex: 1 },
  levelText: { fontSize: 9, fontWeight: '700', color: '#6D6383' },
  coverCaption: { fontSize: 8, letterSpacing: 2, color: '#756C81', position: 'absolute', bottom: 10 },
  body: { padding: 16, gap: 9 }, meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 },
  category: { fontSize: 10, color: c.muted }, free: { color: c.green, fontSize: 10, fontWeight: '600' },
  title: { fontFamily: heading, fontSize: 19, lineHeight: 25, color: c.ink, minHeight: 49 },
  description: { fontSize: 12, lineHeight: 19, color: c.muted, minHeight: 38 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F0EDF5', paddingTop: 12, marginTop: 3 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 5 }, detail: { fontSize: 10, color: c.muted }, dot: { color: '#CCC5D6', fontSize: 10 },
  arrow: { width: 27, height: 27, borderRadius: 9, backgroundColor: '#F0EBFC', alignItems: 'center', justifyContent: 'center' },
});
