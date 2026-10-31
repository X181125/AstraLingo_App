import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { AuthShell, Button, Field, Notice, s } from '../components/UI';
import { useAuth } from '../src/auth';
import { colors as c } from '../src/theme';

export default function Login() {
  const auth = useAuth(), params = useLocalSearchParams<{ reset?: string }>();
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (auth.user) return <Redirect href="/(tabs)/home" />;
  async function submit() {
    if (busy) return;
    if (!email.trim() || !password) { setError('Nhập email và mật khẩu để tiếp tục nhé.'); return; }
    setBusy(true); setError('');
    try { await auth.login(email.trim(), password); router.replace('/(tabs)/home'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <AuthShell title="Chào bạn trở lại!" subtitle="Một hành trình mới đang chờ. Cùng học thêm một chút hôm nay nhé.">
    <View style={{ gap: 19 }}>
      {params.reset === 'success' && <Notice success message="Mật khẩu đã được đổi. Đăng nhập để tiếp tục nhé." />}
      <Field label="Email" icon="mail-outline" placeholder="ban@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!busy} />
      <Field label="Mật khẩu" icon="lock-closed-outline" placeholder="Nhập mật khẩu của bạn" password value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="current-password" onSubmitEditing={submit} editable={!busy} />
      <Pressable accessibilityRole="link" onPress={() => router.push('/forgot-password')} style={{ alignSelf: 'flex-end', paddingVertical: 3 }}><Text style={s.link}>Quên mật khẩu?</Text></Pressable>
      <Notice message={error} /><Button label="Đăng nhập" icon="arrow-forward" loading={busy} onPress={submit} />
    </View>
    <View style={s.centerRow}><Text style={{ color: c.muted, fontSize: 13 }}>Chưa có tài khoản?</Text><Pressable accessibilityRole="link" onPress={() => router.push('/register')}><Text style={s.link}>Đăng ký ngay</Text></Pressable></View>
    {__DEV__ && <View style={{ marginTop: 24, padding: 13, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#DAD2EB', gap: 5 }}><Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: c.muted }}>TÀI KHOẢN CHẠY THỬ</Text><Text selectable style={{ fontSize: 12, color: '#766C88' }}>demo@astralingo.app · Astra@12345</Text><Pressable accessibilityRole="button" onPress={() => { setEmail('demo@astralingo.app'); setPassword('Astra@12345'); }}><Text style={[s.link, { marginTop: 3, fontSize: 12 }]}>Điền tài khoản mẫu ↗</Text></Pressable></View>}
  </AuthShell>;
}
