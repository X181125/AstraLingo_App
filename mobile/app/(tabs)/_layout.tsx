import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth';
import { Button, Notice } from '../../components/UI';
import { useLearningColors } from '../../components/Learning';
import type { IconName } from '../../components/DiscoveryUI';

const tabs = [
  { name: 'home', title: 'Home', selected: 'home', icon: 'home-outline' },
  { name: 'study', title: 'Study', selected: 'book', icon: 'book-outline' },
  { name: 'dictionary', title: 'Dictionary', selected: 'search', icon: 'search-outline' },
  { name: 'profile', title: 'Profile', selected: 'person', icon: 'person-outline' },
] as const satisfies readonly { name: string; title: string; selected: IconName; icon: IconName }[];

export default function TabLayout() {
  const auth = useAuth();
  const c = useLearningColors();
  if (auth.loading)
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={c.purple} />
      </View>
    );
  if (auth.connectionError)
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 16 }}>
        <Notice message={auth.connectionError} />
        <Button label="Thử lại" onPress={auth.retry} />
      </View>
    );
  if (!auth.user) return <Redirect href="/login" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.purpleDark,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: { borderTopColor: c.border, backgroundColor: c.white, minHeight: 55 },
        tabBarLabelStyle: { fontSize: 11, fontFamily: 'Fredoka_600SemiBold', marginTop: 3 },
        sceneStyle: { backgroundColor: c.paper },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ color, focused }) => (
              <View
                style={{
                  width: 50,
                  height: 29,
                  borderRadius: 15,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: 'transparent',
                }}
              >
                <Ionicons name={focused ? tab.selected : tab.icon} size={20} color={color} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
