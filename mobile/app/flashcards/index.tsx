import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActionNotice,
  Choices,
  Copy,
  Input,
  LearningScreen,
  Panel,
  Pending,
  Section,
  useAction,
  useFocusedData,
} from '../../components/Learning';
import { View } from 'react-native';
import { DiscoveryRow, Segments } from '@/components/DiscoveryUI';
import { Button } from '../../components/UI';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import type { Deck, Page } from '../../src/learning';

export default function Flashcards() {
  const { token } = useAuth();
  const action = useAction();
  const params = useLocalSearchParams<{ view?: string; action?: string }>();
  const [view, setView] = useState<'mine' | 'explore' | 'learning'>(
    params.view === 'explore' ? 'explore' : params.view === 'mine' ? 'mine' : 'learning',
  );
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState('');
  const [publicDeck, setPublicDeck] = useState(false);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const decks = useFocusedData<Page<Deck>>(
    `/learn/decks?view=${view === 'explore' ? 'explore' : 'mine'}&page=${page}&q=${encodeURIComponent(query)}`,
  );
  const stats = useFocusedData<{ dueToday: number; remembered: number; totalCards: number }>(
    '/flashcards/stats',
  );
  const progress = useFocusedData<{ streak: number }>('/account/progress');
  const creating = params.action === 'create',
    choosing = !!params.action && !creating;
  return (
    <LearningScreen title={creating ? 'Create Word List' : choosing ? 'Choose a deck' : 'Flashcards'} back>
      {!creating && !choosing && (
        <>
          <Segments
            items={[
              { id: 'mine', label: 'My Lists' },
              { id: 'learning', label: 'Learning' },
              { id: 'explore', label: 'Explore' },
            ]}
            selected={view}
            onChange={(item) => {
              setView(item);
              setPage(1);
            }}
          />
          {view === 'learning' && (
            <Panel>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                {[
                  [progress.data?.streak, 'Day Streak'],
                  [stats.data?.dueToday, 'To Review'],
                  [stats.data?.remembered, 'Mastered'],
                ].map(([v, label]) => (
                  <View key={label} style={{ alignItems: 'center' }}>
                    <Copy>{v ?? '…'}</Copy>
                    <Copy>{label}</Copy>
                  </View>
                ))}
              </View>
            </Panel>
          )}
          {view === 'mine' && (
            <>
              <DiscoveryRow
                title="Create Word List"
                detail="Start a new English vocabulary deck"
                icon="add-circle-outline"
                onPress={() => router.push('/study/flashcards/create_list')}
              />
              <DiscoveryRow
                title="Practice"
                detail="Choose a deck to review"
                icon="play-circle-outline"
                onPress={() => router.push('/study/flashcards/practice')}
              />
              <DiscoveryRow
                title="Smart Create"
                detail="Generate flashcards from text"
                icon="sparkles-outline"
                onPress={() => router.push('/flashcards?action=generate_from_text')}
              />
            </>
          )}
        </>
      )}
      {creating ? (
        <Section title="Word list">
          <Input label="Tên bộ thẻ" value={title} onChangeText={setTitle} maxLength={100} />
          <Copy>Learning language · English</Copy>
          <Segments
            items={[
              { id: 'private', label: 'Private' },
              { id: 'public', label: 'Public' },
            ]}
            selected={publicDeck ? 'public' : 'private'}
            onChange={(visibility) => setPublicDeck(visibility === 'public')}
          />
          <Button
            label="Tạo bộ thẻ"
            loading={action.busy}
            disabled={title.trim().length < 2}
            onPress={() =>
              void action.run(async () => {
                const deck = await api<Deck>('/learn/decks', {
                  token,
                  method: 'POST',
                  body: { title, isPublic: publicDeck },
                });
                setTitle('');
                router.push({ pathname: '/flashcards/[id]', params: { id: deck.id } });
              })
            }
          />
        </Section>
      ) : view === 'explore' ? (
        <>
          <Input
            label="Tìm bộ thẻ công khai"
            value={q}
            onChangeText={setQ}
            maxLength={100}
            onSubmitEditing={() => {
              setQuery(q.trim());
              setPage(1);
            }}
          />
          <Button
            label="Tìm kiếm"
            secondary
            onPress={() => {
              setQuery(q.trim());
              setPage(1);
            }}
          />
        </>
      ) : null}
      {view === 'learning' && !creating && !choosing && (
        <Section title="Learning">
          <Copy>Review words that are due today.</Copy>
        </Section>
      )}
      <ActionNotice action={action} />
      <Pending {...decks} />
      {!creating && !decks.loading && decks.data?.items.length === 0 && <Copy>Chưa tìm thấy bộ thẻ.</Copy>}
      {!creating &&
        !decks.loading &&
        decks.data?.items.map((item) => (
          <Panel key={item.id}>
            <Copy>
              {item.title} · {item._count?.cards ?? 0} thẻ
            </Copy>
            <Copy>{item.isPublic ? 'Công khai' : 'Riêng tư'}</Copy>
            <Button
              label="Mở bộ thẻ"
              secondary
              onPress={() =>
                router.push({
                  pathname: '/flashcards/[id]',
                  params: { id: item.id, ...(choosing && { deckView: params.action }) },
                })
              }
            />
          </Panel>
        ))}
      {page > 1 && <Button label="Trang trước" secondary onPress={() => setPage((old) => old - 1)} />}
      {decks.data?.hasMore && (
        <Button label="Trang sau" secondary onPress={() => setPage((old) => old + 1)} />
      )}
    </LearningScreen>
  );
}
