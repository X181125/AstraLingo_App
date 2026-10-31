import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { Artwork } from './Artwork';
import { Button } from './UI';
import { colors as c, heading } from '../src/theme';
export function ComingSoon({ title, description, kind }: { title: string; description: string; kind: string }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 15, maxWidth: 460, width: '100%', alignSelf: 'center' }}><Artwork kind={kind} size={180} /><Text style={{ color: c.purple, fontSize: 10, letterSpacing: 1.6, fontWeight: '700' }}>TRONG CHẶNG TIẾP THEO</Text><Text style={{ fontFamily: heading, color: c.ink, fontSize: 28 }}>{title}</Text><Text style={{ color: c.muted, lineHeight: 23, textAlign: 'center', marginBottom: 16 }}>{description}</Text><Button label="Khám phá khóa học trước" onPress={() => router.push('/(tabs)/home')} secondary /></View>;
}
