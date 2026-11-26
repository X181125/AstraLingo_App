import { Brand } from '@/components/UI';
import { Artwork } from '@/components/Artwork';
import React from 'react';
import { Redirect, router } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/auth';
import { Button, Notice } from '../components/UI';

export default function Index() {
  const auth = useAuth();
  if (auth.loading)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#7454D6" />
      </View>
    );
  if (auth.connectionError)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: 30,
          gap: 16,
          maxWidth: 500,
          alignSelf: 'center',
        }}
      >
        <Notice message={auth.connectionError} />
        <Button label="Thử kết nối lại" onPress={auth.retry} />
        <Button
          label="Về đăng nhập"
          secondary
          onPress={() => {
            void auth.logout();
          }}
        />
      </View>
    );
  if (auth.user) return <Redirect href="/home" />;
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F9FF',
        padding: 24,
        gap: 24,
      }}
    >
      <Artwork kind="planet" size={164} />
      <Brand />
      <Button label="Get started" onPress={() => router.push('/welcome')} />
      <Button label="Log in" secondary onPress={() => router.push('/login')} />
    </View>
  );
}
