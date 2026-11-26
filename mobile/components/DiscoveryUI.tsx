import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text, TextInput } from "@/components/typography";
import type { Skill } from '../src/learning';
import { heading, useAppColors } from '../src/theme';

export type IconName = keyof typeof Ionicons.glyphMap;
export const skillVisuals = {
  READING: { icon: 'book-outline', background: '#E1F1E7', ink: '#245C48' },
  LISTENING: { icon: 'headset-outline', background: '#FDF0D4', ink: '#815719' },
  SPEAKING: { icon: 'mic-outline', background: '#F9E3E8', ink: '#8A3D5A' },
  WRITING: { icon: 'pencil-outline', background: '#E6ECFA', ink: '#3C548A' },
} satisfies Record<Skill, { icon: IconName; background: string; ink: string }>;

export function IconTile({ icon, background, ink, size = 44 }: { icon: IconName; background?: string; ink?: string; size?: number }) {
  const c = useAppColors();
  return <View style={{ width: size, height: size, borderRadius: Math.round(size * .32), backgroundColor: background ?? c.lavender, alignItems: 'center', justifyContent: 'center' }}>
    <Ionicons name={icon} size={Math.round(size * .5)} color={ink ?? c.purpleDark} />
  </View>;
}

export function SearchBox({ label, submitLabel = 'Tìm kiếm', placeholder, value, onChange, onSubmit, clear }: {
  label: string; submitLabel?: string; placeholder: string; value: string; onChange: (value: string) => void; onSubmit: () => void; clear: () => void;
}) {
  const c = useAppColors();
  const [focused, setFocused] = React.useState(false);
  return <View style={[s.search, { backgroundColor: c.white, borderColor: focused ? c.purple : c.border }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={submitLabel} onPress={onSubmit} style={s.iconButton}>
      <Ionicons name="search-outline" size={21} color={c.purpleDark} />
    </Pressable>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} onSubmitEditing={onSubmit} maxLength={100}
      placeholder={placeholder} placeholderTextColor={c.muted} autoCorrect={false} returnKeyType="search"
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={[s.searchInput, { color: c.ink }, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} />
    {!!value && <Pressable accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm" onPress={clear} style={s.iconButton}>
      <Ionicons name="close-circle" size={19} color={c.muted} />
    </Pressable>}
  </View>;
}

export function Segments<T extends string>({ items, selected, onChange }: {
  items: readonly { id: T; label: string }[]; selected: T; onChange: (item: T) => void;
}) {
  const c = useAppColors();
  return <View style={[s.segments, { backgroundColor: c.lavender, borderColor: c.border }]}>
    {items.map(item => {
      const active = item.id === selected;
      return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: active }}
        onPress={() => onChange(item.id)} style={[s.segment, active && { backgroundColor: c.white }]}>
        <Text style={{ color: active ? c.purpleDark : c.ink, fontSize: 13, fontWeight: active ? '700' : '500', textAlign: 'center' }}>{item.label}</Text>
      </Pressable>;
    })}
  </View>;
}

export function DiscoveryRow({ icon, background, ink, title, caption, detail, onPress }: {
  icon: IconName; background?: string; ink?: string; title: string; caption?: string; detail?: string; onPress: () => void;
}) {
  const c = useAppColors();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
    style={({ pressed }) => [s.row, { borderColor: c.border, backgroundColor: pressed ? c.lavender : c.white }]}>
    <IconTile icon={icon} background={background} ink={ink} />
    <View style={s.rowCopy}>
      {!!caption && <Text style={{ color: c.purpleDark, fontSize: 11, fontWeight: '700' }}>{caption}</Text>}
      <Text style={{ color: c.ink, fontFamily: heading, fontSize: 18, lineHeight: 22 }}>{title}</Text>
      {!!detail && <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12, lineHeight: 17 }}>{detail}</Text>}
    </View>
    <Ionicons name="chevron-forward" size={19} color={c.purple} />
  </Pressable>;
}

const s = StyleSheet.create({
  search: { flex: 1, minWidth: 0, minHeight: 54, borderWidth: 1, borderRadius: 17, flexDirection: 'row', alignItems: 'center', paddingRight: 4 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 50, fontSize: 14, paddingRight: 8 },
  iconButton: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  segments: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 15, borderWidth: 1 },
  segment: { flex: 1, minHeight: 42, paddingHorizontal: 5, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 17, borderWidth: 1, minHeight: 70 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
});
