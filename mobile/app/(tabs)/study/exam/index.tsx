import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusedData } from '@/components/Learning';
import { SearchBox, Segments } from '@/components/DiscoveryUI';
import ExamHeader from '@/components/ExamHeader';
import { Text } from '@/components/typography';
import { createExamApi, type ExamSummary, type HistoryItem } from '@/src/exams';

const examApi = createExamApi(null);

export default function ExamCatalog() {
  const { mini } = useLocalSearchParams<{ mini?: string }>();
  const isQuiz = mini === '1';
  const [items, setItems] = useState<ExamSummary[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    examApi
      .list()
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const [query, setQuery] = useState('');

  const [filter, setFilter] = useState<'all' | 'completed'>('all');
  const [category, setCategory] = useState<'SAT' | 'All' | 'Skills'>('All');
  const history = useFocusedData<HistoryItem[]>(!isQuiz && filter === 'completed' ? '/exams/history' : null);
  const visible = items
    .filter((row) => (isQuiz || category === 'Skills' ? !row.paper : category === 'SAT' ? !!row.paper : true))
    .filter(
      (row) =>
        isQuiz ||
        filter === 'all' ||
        history.data?.some((run) => run.examId === row.id && run.correct !== null),
    )
    .filter((row) => row.title.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.page}>
        {isQuiz ? (
          <>
            <ExamHeader title="Mini Quiz" onBack={() => router.replace('/study')} />
            <View style={[styles.hero, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
              <Feather name="zap" size={30} color="#FFD875" />
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={styles.title}>Choose your skill</Text>
                <Text style={styles.subtitle}>Take a short English quiz and review your score.</Text>
              </View>
            </View>
            <View style={styles.line}>
              <Text accessibilityRole="header" style={styles.name}>
                Practice topics
              </Text>
              <Text
                accessibilityRole="button"
                style={styles.link}
                onPress={() => router.push('/study/exam/history')}
              >
                My results ›
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text accessibilityRole="header" style={[styles.name, { fontSize: 24 }]}>
              Online Exam
            </Text>
            <Text style={styles.meta}>Choose a SAT Reading and Writing paper or a short skills drill.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/study/exam/history')}
              style={[styles.card, styles.line]}
            >
              <Feather name="award" color="#167F71" size={24} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>Your account</Text>
                <Text style={styles.meta}>Review scores and resume attempts.</Text>
              </View>
              <Text style={styles.link}>History ›</Text>
            </Pressable>
            <Segments
              items={[
                { id: 'All', label: 'All' },
                { id: 'SAT', label: 'SAT' },
                { id: 'Skills', label: 'English skills' },
              ]}
              selected={category}
              onChange={setCategory}
            />
            <SearchBox
              label="Search exams"
              placeholder="Search exams…"
              value={query}
              onChange={setQuery}
              clear={() => setQuery('')}
              onSubmit={() => {}}
            />
            <Segments
              items={[
                { id: 'all', label: 'All' },
                { id: 'completed', label: 'Completed' },
              ]}
              selected={filter}
              onChange={setFilter}
            />
            <Text accessibilityRole="header" style={styles.name}>
              All Tests
            </Text>
          </>
        )}
        {error ? (
          <Text accessibilityRole="button" onPress={() => setRetry((n) => n + 1)}>
            Could not load questions. Try again.
          </Text>
        ) : (
          !items.length && <Text>Loading questions...</Text>
        )}
        {!!items.length && !visible.length && <Text>No matching exams.</Text>}
        <View style={isQuiz ? styles.list : styles.grid}>
          {visible.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/study/exam/[id]',
                  params: { id: item.id, ...(!item.paper && { mini: '1' }) },
                })
              }
              style={[styles.card, !isQuiz && styles.examCard]}
            >
              <View style={styles.icon}>
                <Feather name={item.paper ? 'file-text' : 'edit-3'} size={22} color="#1252B6" />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.name}>{item.title}</Text>
                <Text style={styles.meta}>
                  {item.questions} questions | {item.durationMin} min |{' '}
                  {item.paper ? 'College Board' : item.tags[0]}
                </Text>
              </View>
              <Text style={styles.link}>{isQuiz ? 'Start quiz' : 'Open paper'} ›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F9FF' },
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, gap: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  list: { gap: 12 },
  examCard: { width: '48%' },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  link: { fontWeight: '600', color: '#0961F5' },
  hero: { backgroundColor: '#1249B0', borderRadius: 20, padding: 20, gap: 8 },
  title: { fontSize: 24, fontWeight: '700', color: 'white' },
  subtitle: { fontSize: 15, color: '#E6F0FF' },
  card: {
    backgroundColor: 'white',
    padding: 16,
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DFE9F7',
    alignItems: 'flex-start',
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E8F1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 17, fontWeight: '600', color: '#202244' },
  meta: { color: '#53637C' },
});
