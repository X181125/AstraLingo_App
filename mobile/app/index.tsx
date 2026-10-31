import React from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/auth';
import { Button, Notice } from '../components/UI';

export default function Index() {
  const auth = useAuth();
  if (auth.loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color="#7454D6" /></View>;
  if (auth.connectionError) return <View style={{ flex: 1, justifyContent: 'center', padding: 30, gap: 16, maxWidth: 500, alignSelf: 'center' }}><Notice message={auth.connectionError} /><Button label="Thử kết nối lại" onPress={auth.retry} /><Button label="Về đăng nhập" secondary onPress={() => { void auth.logout(); }} /></View>;
  return <Redirect href={auth.user ? '/(tabs)/home' : '/login'} />;
}
