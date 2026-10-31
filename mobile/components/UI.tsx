import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputProps, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors as c, heading } from '../src/theme';
import { Artwork } from './Artwork';

export function Brand({ small = false }: { small?: boolean }) {
  return <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center' }}>
    <View style={{ width: small ? 31 : 37, height: small ? 31 : 37, borderRadius: 12, backgroundColor: c.purple, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }] }}><Ionicons name="sparkles" size={small ? 18 : 22} color="white" /></View>
    <Text style={{ fontFamily: heading, fontSize: small ? 23 : 27, color: c.ink, letterSpacing: -.6 }}>astra<Text style={{ color: c.purple }}>lingo</Text><Text style={{ color: '#E6AE5E' }}>.</Text></Text>
  </View>;
}
export function Button({ label, onPress, loading, secondary, disabled, icon }: { label: string; onPress: () => void; loading?: boolean; secondary?: boolean; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={loading || disabled} onPress={onPress}
    style={({ pressed }) => [s.button, secondary && s.secondary, (loading || disabled) && { opacity: .55 }, pressed && { opacity: .85, transform: [{ scale: .99 }] }]}>
    {loading ? <ActivityIndicator color={secondary ? c.purple : 'white'} /> : <><Text style={[s.buttonLabel, secondary && { color: c.purple }]}>{label}</Text>{icon && <Ionicons name={icon} size={18} color={secondary ? c.purple : 'white'} />}</>}
  </Pressable>;
}
export function Field({ label, icon, password, error, ...props }: TextInputProps & { label: string; icon: keyof typeof Ionicons.glyphMap; password?: boolean; error?: string }) {
  const [visible, setVisible] = useState(false), [focused, setFocused] = useState(false);
  return <View style={{ gap: 8 }}>
    <Text style={s.label}>{label}</Text>
    <View style={[s.inputWrap, focused && { borderColor: c.purple, backgroundColor: '#FDFCFF' }, !!error && { borderColor: c.error }]}>
      <Ionicons name={icon} size={19} color={focused ? c.purple : '#A29AAF'} />
      <TextInput {...props} accessibilityLabel={label} placeholderTextColor="#B0A9BA" onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} secureTextEntry={password && !visible} style={[s.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} />
      {password && <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={() => setVisible(!visible)} hitSlop={12}><Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} /></Pressable>}
    </View>
    {!!error && <Text style={s.errorText}>{error}</Text>}
  </View>;
}
export function Notice({ message, success = false }: { message: string; success?: boolean }) {
  if (!message) return null;
  return <View accessibilityLiveRegion="polite" style={[s.notice, success && { backgroundColor: '#EDF5EE' }]}><Ionicons name={success ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={20} color={success ? c.green : c.error} /><Text style={[s.noticeText, success && { color: c.green }]}>{message}</Text></View>;
}
export function AuthShell({ children, title, subtitle, kind = 'planet', back }: React.PropsWithChildren<{ title: string; subtitle: string; kind?: string; back?: () => void }>) {
  const wide = useWindowDimensions().width >= 900;
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.authScroll, wide && { justifyContent: 'center' }]}>
        <View style={[s.authCard, wide && { flexDirection: 'row', maxWidth: 1020, borderWidth: 1, borderColor: c.border, borderRadius: 32, overflow: 'hidden', backgroundColor: 'white' }]}>
          {wide && <LinearGradient colors={['#F0EBFB', '#E9E1F6', '#F7F0E4']} style={s.sidePanel}>
            <Brand /><View style={{ alignItems: 'center', marginVertical: 34 }}><Artwork size={270} kind={kind} /></View>
            <Text style={s.sideEyebrow}>MỖI NGÀY, MỘT CHÚT TIẾN BỘ</Text><Text style={s.sideTitle}>Thêm một ngôn ngữ.{'\n'}Thêm một thế giới.</Text>
            <Text style={s.sideText}>Bắt đầu từ những điều nhỏ. Cùng AstraLingo khám phá niềm vui học ngôn ngữ mỗi ngày.</Text>
            <View style={s.sideBadge}><Ionicons name="leaf-outline" size={17} color={c.green} /><Text style={{ color: c.green, fontSize: 13 }}>Học theo nhịp của riêng bạn</Text></View>
          </LinearGradient>}
          <View style={[s.authForm, wide && { padding: 44, flex: 1 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              {!wide ? <Brand /> : <Text style={s.eyebrow}>CHÀO MỪNG ĐẾN ASTRALINGO</Text>}
              {back && <Pressable accessibilityRole="button" accessibilityLabel="Quay lại đăng nhập" onPress={back} style={s.back}><Ionicons name="arrow-back" size={20} color={c.ink} /></Pressable>}
            </View>
            {!wide && <View style={{ alignItems: 'center', marginTop: 14, marginBottom: 2 }}><Artwork kind={kind} size={145} /></View>}
            <View style={{ marginTop: wide ? 30 : 9, marginBottom: 27 }}><Text style={s.authTitle}>{title}</Text><Text style={s.subtitle}>{subtitle}</Text></View>
            {children}
          </View>
        </View>
        <Text style={s.footer}>A little progress, every day. ✦</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export const s = StyleSheet.create({
  authScroll: { flexGrow: 1, alignItems: 'center', padding: 22, paddingTop: 28 },
  authCard: { width: '100%', maxWidth: 430 }, authForm: { width: '100%' },
  sidePanel: { width: '46%', padding: 36 }, sideEyebrow: { fontSize: 10, letterSpacing: 1.4, color: '#7D6D98', fontWeight: '700' },
  sideTitle: { fontFamily: heading, fontSize: 35, lineHeight: 44, color: c.ink, marginTop: 15 },
  sideText: { fontSize: 14, color: '#7B718A', lineHeight: 24, marginTop: 16 },
  sideBadge: { marginTop: 26, flexDirection: 'row', alignItems: 'center', gap: 7 },
  eyebrow: { color: c.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  authTitle: { fontFamily: heading, fontSize: 31, color: c.ink, lineHeight: 39 },
  subtitle: { color: c.muted, fontSize: 14, lineHeight: 23, marginTop: 8 },
  footer: { fontSize: 11, color: '#A19AAA', marginTop: 27, marginBottom: 12, letterSpacing: .4 },
  label: { fontSize: 13, fontWeight: '600', color: '#514A64' },
  inputWrap: { height: 54, borderWidth: 1, borderColor: c.border, borderRadius: 14, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 10 },
  input: { flex: 1, minWidth: 0, height: '100%', fontSize: 14, color: c.ink },
  button: { backgroundColor: c.purple, borderRadius: 15, minHeight: 54, padding: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12 },
  buttonLabel: { color: 'white', fontWeight: '700', fontSize: 15 },
  secondary: { backgroundColor: c.lavender, borderColor: '#E3DBF7', borderWidth: 1 },
  notice: { padding: 12, borderRadius: 12, backgroundColor: '#FEEDF0', flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  noticeText: { color: c.error, fontSize: 13, lineHeight: 20, flex: 1 }, errorText: { color: c.error, fontSize: 12 },
  back: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0ECF7', borderRadius: 13 },
  link: { color: c.purple, fontWeight: '600', fontSize: 13 },
  centerRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, alignItems: 'center', marginTop: 24, flexWrap: 'wrap' },
});
