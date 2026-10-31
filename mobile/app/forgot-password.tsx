import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AuthShell, Button, Field, Notice, s } from '../components/UI';
import { api } from '../src/api';
import { colors as c } from '../src/theme';

export default function ForgotPassword() {
  const [email, setEmail] = useState(''), [code, setCode] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [sent, setSent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  async function send() {
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Bạn nhập email hợp lệ nhé.'); return; }
    setBusy(true); setError('');
    try { const result = await api<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email: email.trim() } }); setSent(true); setMessage(result.message); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function reset() {
    if (busy) return;
    if (!/^\d{6}$/.test(code) || password.length < 8) { setError('Nhập mã 6 chữ số và mật khẩu mới có ít nhất 8 ký tự.'); return; }
    if (password !== confirm) { setError('Hai mật khẩu chưa khớp.'); return; }
    setBusy(true); setError('');
    try { await api('/auth/reset-password', { method: 'POST', body: { email: email.trim(), code, password } }); router.replace('/login?reset=success'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <AuthShell title={sent ? 'Đặt mật khẩu mới' : 'Quên mật khẩu?'} subtitle={sent ? 'Nhập mã trong email và tạo một mật khẩu mới cho tài khoản của bạn.' : 'Không sao cả! Nhập email đã đăng ký, chúng mình sẽ gửi mã để bạn bắt đầu lại.'} kind="mail" back={() => router.replace('/login')}>
    <View style={{ gap: 17 }}>
      <Field label="Email đã đăng ký" icon="mail-outline" placeholder="ban@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!sent && !busy} />
      {sent && <><Notice message={message} success /><Field label="Mã xác nhận" icon="key-outline" placeholder="6 chữ số trong email" value={code} onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} editable={!busy} /><Field label="Mật khẩu mới" icon="lock-closed-outline" placeholder="Ít nhất 8 ký tự" password value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="new-password" editable={!busy} /><Field label="Nhập lại mật khẩu mới" icon="shield-checkmark-outline" placeholder="Nhập lại mật khẩu" password value={confirm} onChangeText={setConfirm} autoCapitalize="none" autoComplete="new-password" editable={!busy} onSubmitEditing={reset} /></>}
      <Notice message={error} /><Button label={sent ? 'Lưu mật khẩu mới' : 'Gửi mã xác nhận'} icon="arrow-forward" loading={busy} onPress={sent ? reset : send} />
      {sent && <View style={{ gap: 14, alignItems: 'center' }}><Pressable disabled={busy} accessibilityRole="button" onPress={send}><Text style={s.link}>Gửi lại mã (sau ít nhất 60 giây)</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { setSent(false); setMessage(''); setError(''); setCode(''); }}><Text style={{ color: c.muted, fontSize: 12 }}>Dùng email khác</Text></Pressable></View>}
      {__DEV__ && <Text style={{ color: c.muted, fontSize: 11, lineHeight: 18 }}>Chạy local: xem mã trong terminal backend hoặc file backend/.local/mailbox.jsonl. Khi cấu hình SMTP, mã sẽ được gửi qua email.</Text>}
    </View>
  </AuthShell>;
}
