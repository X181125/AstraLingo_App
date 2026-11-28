import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/typography';
import { Redirect, router } from 'expo-router';
import { AuthShell, Button, Field, Notice, s } from '../components/UI';
import { useAuth } from '../src/auth';
import { colors as c } from '../src/theme';

export default function Register() {
  const auth = useAuth();
  const [first, setFirst] = useState(''),
    [last, setLast] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (auth.user) return <Redirect href="/onboarding" />;
  async function submit() {
    if (busy) return;
    const name = [first.trim(), last.trim()].filter(Boolean).join(' ');
    if (
      name.length > 60 ||
      name.trim().length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      password.length < 8
    ) {
      setError('Nhập tên, email hợp lệ và mật khẩu có ít nhất 8 ký tự.');
      return;
    }
    if (confirm !== password) {
      setError('Hai mật khẩu chưa khớp. Bạn kiểm tra lại nhé.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await auth.register(name.trim(), email.trim(), password);
      router.replace('/onboarding');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthShell title="" subtitle="" back={() => router.replace('/login')}>
      <View style={{ gap: 17 }}>
        <Field
          label="First Name"
          icon="person-outline"
          placeholder="Enter your first name"
          value={first}
          onChangeText={setFirst}
          autoComplete="given-name"
          maxLength={60}
          editable={!busy}
        />
        <Field
          label="Last Name"
          icon="person-outline"
          placeholder="Enter your last name"
          value={last}
          onChangeText={setLast}
          autoComplete="family-name"
          maxLength={60}
          editable={!busy}
        />
        <Field
          label="Email"
          icon="mail-outline"
          placeholder="ban@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          editable={!busy}
        />
        <Field
          label="Mật khẩu"
          icon="lock-closed-outline"
          placeholder="Ít nhất 8 ký tự"
          password
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoComplete="new-password"
          editable={!busy}
        />
        <Field
          label="Nhập lại mật khẩu"
          icon="shield-checkmark-outline"
          placeholder="Nhập lại mật khẩu của bạn"
          password
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="none"
          autoComplete="new-password"
          onSubmitEditing={submit}
          editable={!busy}
        />
        <Notice message={error} />
        <Button label="Tạo tài khoản" icon="arrow-forward" loading={busy} onPress={submit} />
      </View>
      <View style={s.centerRow}>
        <Text style={{ color: c.muted, fontSize: 13 }}>Đã có tài khoản?</Text>
        <Pressable accessibilityRole="link" onPress={() => router.replace('/login')}>
          <Text style={s.link}>Đăng nhập</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}
