import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInputProps,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors as c, heading, useAppColors } from '../src/theme';

export function Brand({ small = false }: { small?: boolean }) {
  const c = useAppColors();
  return (
    <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center' }}>
      <View
        style={{
          width: small ? 31 : 37,
          height: small ? 31 : 37,
          borderRadius: 12,
          backgroundColor: '#7454D6',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: '-7deg' }],
        }}
      >
        <Ionicons name="sparkles" size={small ? 18 : 22} color="white" />
      </View>
      <Text style={{ fontFamily: heading, fontSize: small ? 23 : 27, color: c.ink, letterSpacing: -0.6 }}>
        astra<Text style={{ color: '#7454D6' }}>lingo</Text>
        <Text style={{ color: '#E6AE5E' }}>.</Text>
      </Text>
    </View>
  );
}
export function Button({
  label,
  onPress,
  loading,
  secondary,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  secondary?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const theme = useAppColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={loading || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && { ...s.secondary, backgroundColor: theme.lavender, borderColor: theme.border },
        (loading || disabled) && { opacity: 0.55 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? theme.purple : 'white'} />
      ) : (
        <>
          <Text style={[s.buttonLabel, secondary && { color: theme.purple }]}>{label}</Text>
          {icon && <Ionicons name={icon} size={18} color={secondary ? theme.purple : 'white'} />}
        </>
      )}
    </Pressable>
  );
}
export function Field({
  label,
  icon,
  password,
  error,
  ...props
}: TextInputProps & {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  password?: boolean;
  error?: string;
}) {
  const [visible, setVisible] = useState(false),
    [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>{label}</Text>
      <View
        style={[
          s.inputWrap,
          focused && { borderColor: c.purple, backgroundColor: '#FDFCFF' },
          !!error && { borderColor: c.error },
        ]}
      >
        <Ionicons name={icon} size={19} color={focused ? c.purple : '#A29AAF'} />
        <TextInput
          {...props}
          accessibilityLabel={label}
          placeholderTextColor="#B0A9BA"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={password && !visible}
          style={[s.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
        />
        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            onPress={() => setVisible(!visible)}
            hitSlop={12}
          >
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.muted} />
          </Pressable>
        )}
      </View>
      {!!error && <Text style={s.errorText}>{error}</Text>}
    </View>
  );
}
export function Notice({ message, success = false }: { message: string; success?: boolean }) {
  if (!message) return null;
  return (
    <View accessibilityLiveRegion="polite" style={[s.notice, success && { backgroundColor: '#EDF5EE' }]}>
      <Ionicons
        name={success ? 'checkmark-circle-outline' : 'alert-circle-outline'}
        size={20}
        color={success ? c.green : c.error}
      />
      <Text style={[s.noticeText, success && { color: c.green }]}>{message}</Text>
    </View>
  );
}
export function AuthShell({
  children,
  title,
  subtitle,
  back,
  kind,
}: React.PropsWithChildren<{ title: string; subtitle: string; kind?: string; back?: () => void }>) {
  const page = !back ? 'Login' : kind === 'reset' ? 'Reset password' : 'Signup';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#272645' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.authBar}>
          {back && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại đăng nhập"
              onPress={back}
              style={s.authBack}
            >
              <Ionicons name="arrow-back" size={22} color="white" />
            </Pressable>
          )}
          <Text accessibilityRole="header" style={s.authLabel}>
            {page}
          </Text>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={s.authBody}
          contentContainerStyle={s.authScroll}
        >
          <View style={s.authForm}>
            {!back && (
              <View style={{ alignItems: 'flex-start', marginBottom: 24 }}>
                <Brand />
              </View>
            )}
            {!!title && <Text style={s.authTitle}>{title}</Text>}
            {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export const s = StyleSheet.create({
  authBar: { height: 96, alignItems: 'center', justifyContent: 'center' },
  authBack: { position: 'absolute', left: 16, padding: 10 },
  authLabel: { color: 'white', fontFamily: heading, fontSize: 23 },
  authBody: { backgroundColor: 'white', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  authScroll: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32 },
  authForm: { width: '100%', maxWidth: 540 },
  authTitle: { color: c.ink, fontFamily: heading, fontSize: 27, textAlign: 'left', marginBottom: 24 },
  subtitle: { color: c.muted, textAlign: 'left', marginTop: 6, marginBottom: 22, fontSize: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#514A64' },
  inputWrap: {
    height: 54,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: '#F5F6F8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 10,
  },
  input: { flex: 1, minWidth: 0, height: '100%', fontSize: 14, color: c.ink },
  button: {
    backgroundColor: c.purple,
    borderRadius: 15,
    minHeight: 54,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  buttonLabel: { color: 'white', fontWeight: '700', fontSize: 15 },
  secondary: { backgroundColor: c.lavender, borderColor: '#E3DBF7', borderWidth: 1 },
  notice: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEEDF0',
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
  },
  noticeText: { color: c.error, fontSize: 13, lineHeight: 20, flex: 1 },
  errorText: { color: c.error, fontSize: 12 },
  back: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0ECF7',
    borderRadius: 13,
  },
  link: { color: c.purple, fontWeight: '600', fontSize: 13 },
  centerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    alignItems: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
});
