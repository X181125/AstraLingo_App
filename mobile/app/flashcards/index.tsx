import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActionNotice, Choices, Copy, Input, LearningScreen, Panel, Pending, Section, useAction, useFocusedData } from '../../components/Learning';
import { Button } from '../../components/UI';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import type { Deck, Page } from '../../src/learning';

export default function Flashcards() {
  const { token } = useAuth();
  const action = useAction();
  const params = useLocalSearchParams<{view?:string}>();
  const [view, setView] = useState<'mine' | 'explore'>(params.view === 'explore' ? 'explore' : 'mine');
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const decks = useFocusedData<Page<Deck>>(`/learn/decks?view=${view}&page=${page}&q=${encodeURIComponent(query)}`);
  return <LearningScreen title="Flashcards" subtitle="Tạo bộ thẻ và ôn những thẻ đã đến hạn." back>
    <Choices values={['mine', 'explore'] as const} value={view} label={item => item === 'mine' ? 'Bộ thẻ của tôi' : 'Khám phá cộng đồng'}
      onChange={item => { setView(item); setPage(1); }} />
    {view === 'mine' ? <Section title="Tạo bộ thẻ">
      <Input label="Tên bộ thẻ" value={title} onChangeText={setTitle} maxLength={100} />
      <Button label="Tạo bộ thẻ" loading={action.busy} disabled={title.trim().length < 2} onPress={() => void action.run(async () => {
        const deck = await api<Deck>('/learn/decks', { token, method: 'POST', body: { title } });
        setTitle(''); router.push({ pathname: '/flashcards/[id]', params: { id: deck.id } });
      })} />
    </Section> : <>
      <Input label="Tìm bộ thẻ công khai" value={q} onChangeText={setQ} maxLength={100} onSubmitEditing={() => { setQuery(q.trim()); setPage(1); }} />
      <Button label="Tìm kiếm" secondary onPress={() => { setQuery(q.trim()); setPage(1); }} />
    </>}
    <ActionNotice action={action} />
    <Pending {...decks} />
    {!decks.loading && decks.data?.items.length === 0 && <Copy>Chưa tìm thấy bộ thẻ.</Copy>}
    {!decks.loading && decks.data?.items.map(item => <Panel key={item.id}>
      <Copy>{item.title} · {item._count?.cards ?? 0} thẻ</Copy>
      <Copy>{item.isPublic ? 'Công khai' : 'Riêng tư'}</Copy>
      <Button label="Mở bộ thẻ" secondary onPress={() => router.push({ pathname: '/flashcards/[id]', params: { id: item.id } })} />
    </Panel>)}
    {page > 1 && <Button label="Trang trước" secondary onPress={() => setPage(old => old - 1)} />}
    {decks.data?.hasMore && <Button label="Trang sau" secondary onPress={() => setPage(old => old + 1)} />}
  </LearningScreen>;
}
