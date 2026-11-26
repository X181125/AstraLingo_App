import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/auth';
import { colors, useAppColors } from '../src/theme';

function AppStack() {
  const theme = useAppColors();
  return <><StatusBar style={theme === colors ? 'dark' : 'light'} />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.paper }, animation: 'fade' }} /></>;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({ Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold });
  if (!loaded && !error) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FCFBF8' }}><ActivityIndicator color="#7454D6" /></View>;
  return <SafeAreaProvider><AuthProvider><AppStack /></AuthProvider></SafeAreaProvider>;
}
