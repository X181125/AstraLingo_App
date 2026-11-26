import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/typography";
import { heading, useAppColors } from '../src/theme';
import type { Category } from '../src/types';
import { skillVisuals, type IconName } from './DiscoveryUI';

const mentors = [
  { name: 'Linh', initials: 'LN', categoryId: 'speaking', ...skillVisuals.SPEAKING },
  { name: 'Maya', initials: 'MY', categoryId: 'reading', ...skillVisuals.READING },
  { name: 'Daniel', initials: 'DL', categoryId: 'listening', ...skillVisuals.LISTENING },
  { name: 'An', initials: 'AN', categoryId: 'writing', ...skillVisuals.WRITING },
] satisfies { name: string; initials: string; categoryId: string; icon: IconName; ink: string; background: string }[];

export function HomeMentors({ categories, onChoose }: { categories: Category[]; onChoose: (id: string) => void }) {
  const c = useAppColors();
  const available = mentors.flatMap(mentor => {
    const category = categories.find(item => item.id === mentor.categoryId && item._count?.courses !== 0);
    return category ? [{ ...mentor, category }] : [];
  });
  if (!available.length) return null;

  return <View style={s.section}>
    <View style={s.header}>
      <Text accessibilityRole="header" style={{ fontFamily: heading, fontSize: 23, lineHeight: 28, color: c.ink }}>Top Mentor</Text>
      <Text style={{ color: c.muted, fontSize: 12 }}>Hồ sơ minh họa</Text>
    </View>
    <View style={s.cards}>
      {available.map(({ name, initials, category, icon, ink, background }) => <Pressable key={category.id}
        accessibilityRole="button" accessibilityLabel={`${name} · Xem khóa học ${category.name}`} onPress={() => onChoose(category.id)}
        style={({ pressed }) => [s.card, { backgroundColor: pressed ? c.lavender : c.white, borderColor: c.border }]}>
        <View style={[s.avatar, { backgroundColor: background }]}>
          <Text style={{ color: ink, fontFamily: heading, fontSize: 18 }}>{initials}</Text>
          <View style={[s.skillIcon, { backgroundColor: c.white, borderColor: c.border }]}>
            <Ionicons name={icon} size={10} color={c.purpleDark} />
          </View>
        </View>
        <Text style={[s.name, { color: c.ink }]}>{name}</Text>
        <Text style={[s.skill, { color: c.muted }]}>{category.name}</Text>
      </Pressable>)}
    </View>
  </View>;
}

const s = StyleSheet.create({
  section: { gap: 12 },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  cards: { flexDirection: 'row', gap: 8 },
  card: { flex: 1, minWidth: 0, maxWidth: 154, alignItems: 'center', borderWidth: 1, borderRadius: 17, paddingVertical: 11, paddingHorizontal: 3, gap: 5 },
  avatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  skillIcon: { position: 'absolute', right: -3, bottom: -1, width: 17, height: 17, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: heading, fontSize: 15 },
  skill: { fontSize: 10, lineHeight: 14, textAlign: 'center' },
});
