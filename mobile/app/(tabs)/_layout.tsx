import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth';
import { colors as c } from '../../src/theme';
import { Button, Notice } from '../../components/UI';

export default function TabLayout() {
  const auth = useAuth();
  if (auth.loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={c.purple} /></View>;
  if (auth.connectionError) return <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 16 }}><Notice message={auth.connectionError} /><Button label="Thử lại" onPress={auth.retry} /></View>;
  if (!auth.user) return <Redirect href="/login" />;
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: c.purple, tabBarInactiveTintColor: '#A6A0B3', tabBarStyle: { borderTopColor: c.border, backgroundColor: '#FFFFFF', paddingTop: 7, height: 68, paddingBottom: 9 }, tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 3 }, sceneStyle: { backgroundColor: c.paper } }}>
    <Tabs.Screen name="home" options={{ title: 'Trang chủ', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={21} color={color} /> }} />
    <Tabs.Screen name="study" options={{ title: 'Học tập', tabBarIcon: ({ color }) => <Ionicons name="albums-outline" size={21} color={color} /> }} />
    <Tabs.Screen name="dictionary" options={{ title: 'Từ điển', tabBarIcon: ({ color }) => <Ionicons name="book-outline" size={21} color={color} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'Cá nhân', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={21} color={color} /> }} />
  </Tabs>;
}
