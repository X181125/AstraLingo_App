import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInputProps,
} from 'react-native';
import { Text, TextInput } from '@/components/typography';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router, useFocusEffect, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth';
import { api } from '../src/api';
import { colors, heading, useAppColors as useLearningColors } from '../src/theme';
import type { AnswerResult, Question } from '../src/learning';
import { Button, Notice } from './UI';

export { useLearningColors };

export function LearningScreen({
  title,
  subtitle,
  back = false,
  children,
}: React.PropsWithChildren<{ title: string; subtitle?: string; back?: boolean }>) {
  const auth = useAuth();
  const route = useSegments()[0] as string;
  const c = useLearningColors();
  if (auth.loading) return <ActivityIndicator color={c.purple} style={{ flex: 1 }} />;
  if (!auth.user) return <Redirect href={auth.connectionError ? '/' : '/login'} />;
  return (
    <SafeAreaView
      edges={['top', ...(back ? ['bottom' as const] : [])]}
      style={{ flex: 1, backgroundColor: c.paper }}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.screen}>
        {!!title && (
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 8 }}>
              {back && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quay lại"
                  hitSlop={8}
                  onPress={() => (router.canGoBack() ? router.back() : router.replace('/study'))}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="chevron-back" size={24} color={c.ink} />
                </Pressable>
              )}
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: heading,
                  fontSize: back ? 22 : 28,
                  color: c.ink,
                  flex: 1,
                  textAlign: back ? 'center' : 'left',
                }}
              >
                {title}
              </Text>
              {back && <View style={{ width: 40 }} />}
            </View>
            {!!subtitle && <Text style={{ color: c.muted, fontSize: 15, lineHeight: 21 }}>{subtitle}</Text>}
          </View>
        )}
        {children}
      </ScrollView>
      {['flashcards', 'practice', 'settings', 'course'].includes(route) && (
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: c.white,
            borderTopWidth: 1,
            borderColor: c.border,
            minHeight: 53,
          }}
        >
          {(['home', 'study', 'dictionary', 'profile'] as const).map((tab, i) => {
            const active = tab === (route === 'settings' ? 'profile' : route === 'course' ? 'home' : 'study');
            const color = active ? c.purple : c.muted;
            return (
              <Pressable
                key={tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => router.navigate('/' + tab)}
                style={{ flex: 1, gap: 2, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons
                  name={(['home-outline', 'book-outline', 'search-outline', 'person-outline'] as const)[i]}
                  size={20}
                  color={color}
                />
                <Text style={{ fontSize: 11, color }}>{tab[0].toUpperCase() + tab.slice(1)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

export function Section({ title, children }: React.PropsWithChildren<{ title: string }>) {
  const c = useLearningColors();
  return (
    <View style={{ gap: 10 }}>
      <Text accessibilityRole="header" style={{ fontFamily: heading, color: c.ink, fontSize: 20 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function Copy({ children, selectable }: { children: React.ReactNode; selectable?: boolean }) {
  const c = useLearningColors();
  return (
    <Text selectable={selectable} style={{ color: c.ink, fontSize: 15, lineHeight: 24 }}>
      {children}
    </Text>
  );
}

export function Panel({ children }: React.PropsWithChildren) {
  const c = useLearningColors();
  return <View style={[styles.panel, { backgroundColor: c.white, borderColor: c.border }]}>{children}</View>;
}

export function Input({ label, multiline, ...props }: TextInputProps & { label: string }) {
  const c = useLearningColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.ink, fontWeight: '600' }}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        multiline={multiline}
        style={[
          styles.input,
          { color: c.ink, backgroundColor: c.white, borderColor: c.border },
          multiline && { minHeight: 110, textAlignVertical: 'top' },
        ]}
      />
    </View>
  );
}

export function Choice({
  label,
  children,
  selected,
  onPress,
}: React.PropsWithChildren<{ label: string; selected?: boolean; onPress: () => void }>) {
  const c = useLearningColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.choice,
        { borderColor: selected ? c.purple : c.border, backgroundColor: selected ? c.lavender : c.white },
      ]}
    >
      <Text style={{ color: selected ? c.purpleDark : c.ink, fontWeight: selected ? '700' : '500' }}>
        {children ?? label}
      </Text>
    </Pressable>
  );
}

export function Highlighted({ text, quotes }: { text: string; quotes: string[] }) {
  const ranges = quotes
    .filter(Boolean)
    .flatMap((quote) => {
      const start = text.indexOf(quote);
      return start < 0 ? [] : [{ start, end: start + quote.length }];
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const segments: React.ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    segments.push(
      text.slice(cursor, range.start),
      <Text key={range.start} style={{ backgroundColor: '#F9DE8B', color: '#24213B' }}>
        {text.slice(range.start, range.end)}
      </Text>,
    );
    cursor = range.end;
  }
  return (
    <>
      {segments}
      {text.slice(cursor)}
    </>
  );
}

export function Choices<T extends string | number>({
  values,
  value,
  label,
  onChange,
}: {
  values: readonly T[];
  value: T;
  label?: (item: T) => string;
  onChange: (item: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {values.map((item) => (
        <Choice
          key={item}
          label={label?.(item) ?? String(item)}
          selected={item === value}
          onPress={() => onChange(item)}
        />
      ))}
    </View>
  );
}

export function Questions({
  questions,
  selections,
  onChange,
}: {
  questions: Question[];
  selections: number[];
  onChange: (next: number[]) => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      {questions.map((item, i) => (
        <Panel key={i}>
          <Copy>
            {i + 1}. {item.prompt}
          </Copy>
          {item.options.map((option, index) => (
            <Choice
              key={index}
              label={option}
              selected={index === selections[i]}
              onPress={() => onChange(questions.map((_, k) => (k === i ? index : (selections[k] ?? -1))))}
            />
          ))}
        </Panel>
      ))}
    </View>
  );
}

export function Answers({ result }: { result: AnswerResult }) {
  return (
    <Section title={`${result.score}/100 · ${result.correct}/${result.total} câu đúng`}>
      {result.details.map((item, i) => (
        <Panel key={i}>
          <Copy>
            {i + 1}. {item.prompt}
          </Copy>
          <Copy>
            Bạn chọn {item.selected >= 0 ? item.options[item.selected] : 'Chưa trả lời'}
            {item.correct ? ' ✓' : ''}
          </Copy>
          {!item.correct && <Copy>Đáp án {item.options[item.answer]}</Copy>}
          {!!item.explanation && <Copy>{item.explanation}</Copy>}
        </Panel>
      ))}
    </Section>
  );
}

export function Pending({
  loading,
  error,
  reload,
}: {
  loading?: boolean;
  error?: string;
  reload?: () => void;
}) {
  if (loading) return <ActivityIndicator color={colors.purple} />;
  if (!error) return null;
  return (
    <>
      <Notice message={error} />
      {reload && <Button label="Thử lại" secondary onPress={reload} />}
    </>
  );
}

export function useFocusedData<T>(path: string | null) {
  const { token } = useAuth();
  const [result, setResult] = useState<{ path: string; data: T }>();
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!path || !token) return;
      const controller = new AbortController();
      setLoading(true);
      setError('');
      api<T>(path, { token, signal: controller.signal })
        .then((value) => {
          if (!controller.signal.aborted) setResult({ path, data: value });
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setResult(undefined);
            setError(e.message);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
      return () => controller.abort();
    }, [token, path, version]),
  );
  return {
    data: result?.path === path ? result.data : undefined,
    loading,
    error,
    reload: () => setVersion((v) => v + 1),
  };
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const active = React.useRef(false);
  async function run(task: () => Promise<void>) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  return { busy, error, success, setSuccess, run };
}

export function ActionNotice({ action }: { action: ReturnType<typeof useAction> }) {
  return (
    <>
      <Notice message={action.error} />
      <Notice success message={action.success} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { width: '100%', maxWidth: 920, alignSelf: 'center', padding: 20, paddingBottom: 40, gap: 18 },
  panel: { borderWidth: 1, borderRadius: 16, padding: 15, gap: 10 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 46, fontSize: 15 },
  choice: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    minHeight: 44,
  },
});
