import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { AuthShell, Button, Field, Notice, s } from '../components/UI';
import { useAuth } from '../src/auth';
import { colors as c } from '../src/theme';

export default function Register() {
  const auth = useAuth();
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (auth.user) return <Redirect href="/(tabs)/home" />;
  async function submit() {
    if (busy) return;
    if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length < 8) { setError('Nhập tên, email hợp lệ và mật khẩu có ít nhất 8 ký tự.'); return; }
    if (confirm !== password) { setError('Hai mật khẩu chưa khớp. Bạn kiểm tra lại nhé.'); return; }
    setBusy(true); setError('');
    try { await auth.register(name.trim(), email.trim(), password); router.replace('/(tabs)/home'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <AuthShell title="Bắt đầu hành trình" subtitle="Tạo tài khoản của bạn. Mỗi bước nhỏ hôm nay mở ra một thế giới mới." back={() => router.replace('/login')}>
    <View style={{ gap: 17 }}>
      <Field label="Tên của bạn" icon="person-outline" placeholder="Mình nên gọi bạn là gì?" value={name} onChangeText={setName} autoComplete="name" maxLength={60} editable={!busy} />
      <Field label="Email" icon="mail-outline" placeholder="ban@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!busy} />
      <Field label="Mật khẩu" icon="lock-closed-outline" placeholder="Ít nhất 8 ký tự" password value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="new-password" editable={!busy} />
      <Field label="Nhập lại mật khẩu" icon="shield-checkmark-outline" placeholder="Nhập lại mật khẩu của bạn" password value={confirm} onChangeText={setConfirm} autoCapitalize="none" autoComplete="new-password" onSubmitEditing={submit} editable={!busy} />
      <Notice message={error} /><Button label="Tạo tài khoản" icon="arrow-forward" loading={busy} onPress={submit} />
    </View>
    <View style={s.centerRow}><Text style={{ color: c.muted, fontSize: 13 }}>Đã có tài khoản?</Text><Pressable accessibilityRole="link" onPress={() => router.replace('/login')}><Text style={s.link}>Đăng nhập</Text></Pressable></View>
  </AuthShell>;
}
