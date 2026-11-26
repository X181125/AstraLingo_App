import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from "react-native";
import { Text } from "@/components/typography";
import * as ImagePicker from 'expo-image-picker';
import { ActionNotice, Copy, LearningScreen, Panel, Pending, Section, useAction, useFocusedData } from '../../../components/Learning';
import { IconTile, SearchBox, Segments } from '../../../components/DiscoveryUI';
import { Button } from '../../../components/UI';
import { api } from '../../../src/api';
import { useAuth } from '../../../src/auth';
import type { CardInput, Word } from '../../../src/learning';
import { useAppColors } from '../../../src/theme';

const modes = [{ id: 'lookup', label: 'Tra từ' }, { id: 'image', label: 'Tra qua ảnh' }, { id: 'saved', label: 'Từ đã lưu' }] as const;
type Mode = typeof modes[number]['id'];

export default function Dictionary() {
  const { token } = useAuth();
  const action = useAction();
  const { mode: selectedMode } = useLocalSearchParams<{ mode?: string }>();
  const mode: Mode = selectedMode === 'image' || selectedMode === 'saved' ? selectedMode : 'lookup';
  const [page, setPage] = useState(1);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [imageWords, setImageWords] = useState<CardInput[]>([]);
  const glossary = useFocusedData<{ items: Word[]; total: number; hasMore: boolean }>(mode === 'lookup' ? '/learn/dictionary?page=' + page + '&q=' + encodeURIComponent(query) : null);
  const saved = useFocusedData<Word[]>('/study/words');
  const ai = useFocusedData<{ gemini: boolean }>('/learn/ai/capabilities');

  async function save(word: string, meaning: string) {
    await api('/study/words', { token, method: 'PUT', body: { word: word.slice(0, 120), meaning: meaning.slice(0, 500) } });
    saved.reload(); action.setSuccess(`Đã lưu “${word}”.`);
  }

  async function inspectImage(camera: boolean) {
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error('Hãy cấp quyền camera để chụp ảnh.');
    }
    const options: ImagePicker.ImagePickerOptions = { base64: true, quality: 0.45, mediaTypes: ['images'], exif: false };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    const data = result.assets[0]?.base64;
    if (!data || data.length > 4_194_304) throw new Error('Chọn ảnh nhỏ hơn 3 MB.');
    const analyzed = await api<{ words: CardInput[] }>('/learn/ai', {
      token, method: 'POST', timeoutMs: 55_000, body: { task: 'image-vocabulary', mimeType: 'image/jpeg', data },
    });
    setImageWords(analyzed.words);
    if (!analyzed.words.length) action.setSuccess('Ảnh này chưa nhận diện được từ vựng.');
  }

  return <LearningScreen title="Từ điển" subtitle="Tra từ, đọc ví dụ và lưu lại từ vựng của bạn.">
    <Segments items={modes} selected={mode} onChange={value => router.setParams({ mode: value })} />
    <ActionNotice action={action} />
    {mode === 'lookup' && ai.data?.gemini && <Button label="Giải thích từ hoặc câu" secondary icon="sparkles-outline" onPress={() => router.push('/dictionary/ai_explain')} />}
    {mode === 'lookup' && <Section title="Từ điển tiếng Anh">
      <SearchBox label="Từ hoặc câu tiếng Anh" placeholder="Nhập từ hoặc câu tiếng Anh…" submitLabel="Tìm trong từ điển"
        value={input} onChange={setInput} onSubmit={() => { setPage(1); setQuery(input.trim()); }} clear={() => { setPage(1); setInput(''); setQuery(''); }} />
      <Pending {...glossary} />
      {glossary.data && <Copy>{glossary.data.total ? `${glossary.data.total.toLocaleString('vi-VN')} mục từ · Trang ${page}` : 'Không tìm thấy mục từ. Thử một cách viết khác.'}</Copy>}
      {glossary.data?.items.map(item => <Panel key={item.word}>
        <WordDetails word={item.word} meaning={item.meaning} example={item.example} />
        <Button label="Lưu từ" icon="bookmark-outline" secondary disabled={action.busy} onPress={() => void action.run(() => save(item.word, item.meaning))} />
      </Panel>)}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        {page > 1 && <Button label="Trang trước" secondary onPress={() => setPage(page - 1)} />}
        {glossary.data?.hasMore && <Button label="Trang sau" secondary onPress={() => setPage(page + 1)} />}
      </View>
    </Section>}
    {mode === 'image' && <Section title="Visual Vocabulary">
      {ai.data?.gemini ? <>
        <Copy>Chọn hoặc chụp ảnh để Gemini nhận diện từ vựng.</Copy>
        <Button label="Chọn ảnh" icon="image-outline" loading={action.busy} onPress={() => void action.run(() => inspectImage(false))} />
        <Button label="Chụp ảnh" icon="camera-outline" secondary disabled={action.busy} onPress={() => void action.run(() => inspectImage(true))} />
        {imageWords.map((item, i) => <Panel key={i}><WordDetails word={item.front} meaning={item.back} />
          <Button label="Lưu từ" secondary disabled={action.busy} onPress={() => void action.run(() => save(item.front, item.back))} />
        </Panel>)}
      </> : <Copy>Máy chủ cần cấu hình Gemini để tra từ qua ảnh.</Copy>}
    </Section>}
    {mode === 'saved' && <Section title="Từ vựng cá nhân">
      <Pending {...saved} />
      {saved.data?.length === 0 && <Panel><WordDetails word="Bạn chưa lưu từ nào." /></Panel>}
      {saved.data?.map(item => <Panel key={item.word}>
        <WordDetails word={item.word} meaning={item.meaning} />
        <Button label="Bỏ lưu" secondary disabled={action.busy} onPress={() => void action.run(async () => {
          await api('/study/words?word=' + encodeURIComponent(item.word), { token, method: 'DELETE' }); saved.reload();
        })} />
      </Panel>)}
    </Section>}
  </LearningScreen>;
}

function WordDetails({ word, meaning, example }: { word: string; meaning?: string | null; example?: string | null }) {
  const c = useAppColors();
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
    <IconTile icon="book-outline" size={40} />
    <View style={{ flex: 1, minWidth: 0, gap: 3, paddingVertical: 2 }}>
      <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700', lineHeight: 23 }}>{word}{meaning ? ` · ${meaning}` : ''}</Text>
      {!!example && <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>{example}</Text>}
    </View>
  </View>;
}
