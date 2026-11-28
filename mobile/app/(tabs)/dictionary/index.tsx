import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/typography';
import * as ImagePicker from 'expo-image-picker';
import {
  ActionNotice,
  Copy,
  LearningScreen,
  Panel,
  Pending,
  Section,
  useAction,
  useFocusedData,
} from '../../../components/Learning';
import { DiscoveryRow, IconTile, SearchBox } from '../../../components/DiscoveryUI';
import { Button } from '../../../components/UI';
import { api } from '../../../src/api';
import { useAuth } from '../../../src/auth';
import type { CardInput, Word } from '../../../src/learning';
import { useAppColors } from '../../../src/theme';

type Mode = 'lookup' | 'image' | 'saved';

export default function Dictionary() {
  const c = useAppColors();
  const { token } = useAuth();
  const action = useAction();
  const { mode: selectedMode, q: initialQuery } = useLocalSearchParams<{ mode?: string; q?: string }>();
  const mode: Mode = selectedMode === 'image' || selectedMode === 'saved' ? selectedMode : 'lookup';
  const [page, setPage] = useState(1);
  const [input, setInput] = useState(initialQuery ?? '');
  const [query, setQuery] = useState(initialQuery ?? '');
  const [imageWords, setImageWords] = useState<CardInput[]>([]);
  const glossary = useFocusedData<{ items: Word[]; total: number; hasMore: boolean }>(
    mode === 'lookup' ? '/learn/dictionary?page=' + page + '&q=' + encodeURIComponent(query) : null,
  );
  const saved = useFocusedData<Word[]>('/study/words');
  const ai = useFocusedData<{ gemini: boolean }>('/learn/ai/capabilities');

  async function save(word: string, meaning: string) {
    await api('/study/words', {
      token,
      method: 'PUT',
      body: { word: word.slice(0, 120), meaning: meaning.slice(0, 500) },
    });
    saved.reload();
    action.setSuccess(`Đã lưu “${word}”.`);
  }

  async function inspectImage(camera: boolean) {
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error('Hãy cấp quyền camera để chụp ảnh.');
    }
    const options: ImagePicker.ImagePickerOptions = {
      base64: true,
      quality: 0.45,
      mediaTypes: ['images'],
      exif: false,
    };
    const result = camera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    const data = result.assets[0]?.base64;
    if (!data || data.length > 4_194_304) throw new Error('Chọn ảnh nhỏ hơn 3 MB.');
    const analyzed = await api<{ words: CardInput[] }>('/learn/ai', {
      token,
      method: 'POST',
      timeoutMs: 55_000,
      body: { task: 'image-vocabulary', mimeType: 'image/jpeg', data },
    });
    setImageWords(analyzed.words);
    if (!analyzed.words.length) action.setSuccess('Ảnh này chưa nhận diện được từ vựng.');
  }

  const explorer = selectedMode === 'lookup';
  const home = !selectedMode;
  const search = () => {
    setPage(1);
    setQuery(input.trim());
  };
  return (
    <LearningScreen
      title={
        home
          ? 'English Dictionary'
          : explorer
            ? 'English Explorer'
            : mode === 'image'
              ? 'Visual Vocabulary'
              : 'Saved words'
      }
      back={!home}
    >
      <ActionNotice action={action} />
      {mode === 'lookup' && (
        <View style={{ backgroundColor: c.lavender, padding: 16, borderRadius: 18, gap: 12 }}>
          <Section title={explorer ? 'Search English words' : 'Look up a word'}>
            <SearchBox
              label="Từ hoặc câu tiếng Anh"
              placeholder="Enter an English word"
              submitLabel="Tìm trong từ điển"
              value={input}
              onChange={setInput}
              onSubmit={search}
              clear={() => {
                setPage(1);
                setInput('');
                setQuery('');
              }}
            />
          </Section>
          {home && (
            <View style={{ alignSelf: 'flex-start' }}>
              <Button
                label="Browse all words"
                icon="arrow-forward"
                onPress={() => router.push('/dictionary/explorer')}
              />
            </View>
          )}
        </View>
      )}
      {home && (
        <Section title="Vocabulary tools">
          <DiscoveryRow
            title="Smart Insight"
            detail="Explore a word in context"
            icon="sparkles-outline"
            onPress={() => router.push('/dictionary/ai_explain')}
          />
          <DiscoveryRow
            title="Visual Vocabulary"
            detail="Find words in a photo"
            icon="camera-outline"
            onPress={() => router.push('/dictionary/visual_search')}
          />
          <DiscoveryRow
            title="Từ đã lưu"
            detail="Your saved vocabulary"
            icon="bookmark-outline"
            onPress={() => router.push('/dictionary?mode=saved')}
          />
        </Section>
      )}
      {mode === 'lookup' && (explorer || !!query) && (
        <Section title="Results">
          <Pending {...glossary} />
          {glossary.data && (
            <Copy>
              {glossary.data.total
                ? `${glossary.data.total.toLocaleString('vi-VN')} mục từ · Trang ${page}`
                : 'Không tìm thấy mục từ. Thử một cách viết khác.'}
            </Copy>
          )}
          {glossary.data?.items.map((item) => (
            <Panel key={item.word}>
              <WordDetails word={item.word} meaning={item.meaning} example={item.example} />
              <Button
                label="Lưu từ"
                icon="bookmark-outline"
                secondary
                disabled={action.busy}
                onPress={() => void action.run(() => save(item.word, item.meaning))}
              />
            </Panel>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            {page > 1 && <Button label="Trang trước" secondary onPress={() => setPage(page - 1)} />}
            {glossary.data?.hasMore && (
              <Button label="Trang sau" secondary onPress={() => setPage(page + 1)} />
            )}
          </View>
        </Section>
      )}
      {mode === 'image' && (
        <View style={{ alignItems: 'stretch', gap: 16, paddingVertical: 24 }}>
          <View style={{ alignItems: 'center', gap: 12 }}>
            <IconTile icon="camera-outline" size={68} />
            <Text style={{ fontSize: 21, fontWeight: '600', color: c.ink }}>Take or pick a photo</Text>
            <Copy>Extract English vocabulary from a picture.</Copy>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
            <Button
              label="Gallery"
              icon="image-outline"
              disabled={!ai.data?.gemini}
              loading={action.busy}
              onPress={() => void action.run(() => inspectImage(false))}
            />
            <Button
              label="Camera"
              icon="camera-outline"
              secondary
              disabled={!ai.data?.gemini || action.busy}
              onPress={() => void action.run(() => inspectImage(true))}
            />
          </View>
          {!ai.data?.gemini && <Copy>Máy chủ cần cấu hình Gemini để tra từ qua ảnh.</Copy>}
          {imageWords.map((item, i) => (
            <Panel key={i}>
              <WordDetails word={item.front} meaning={item.back} />
              <Button
                label="Lưu từ"
                secondary
                disabled={action.busy}
                onPress={() => void action.run(() => save(item.front, item.back))}
              />
            </Panel>
          ))}
        </View>
      )}
      {mode === 'saved' && (
        <Section title="Từ vựng cá nhân">
          <Pending {...saved} />
          {saved.data?.length === 0 && (
            <Panel>
              <WordDetails word="Bạn chưa lưu từ nào." />
            </Panel>
          )}
          {saved.data?.map((item) => (
            <Panel key={item.word}>
              <WordDetails word={item.word} meaning={item.meaning} />
              <Button
                label="Bỏ lưu"
                secondary
                disabled={action.busy}
                onPress={() =>
                  void action.run(async () => {
                    await api('/study/words?word=' + encodeURIComponent(item.word), {
                      token,
                      method: 'DELETE',
                    });
                    saved.reload();
                  })
                }
              />
            </Panel>
          ))}
        </Section>
      )}
    </LearningScreen>
  );
}

function WordDetails({
  word,
  meaning,
  example,
}: {
  word: string;
  meaning?: string | null;
  example?: string | null;
}) {
  const c = useAppColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <IconTile icon="book-outline" size={40} />
      <View style={{ flex: 1, minWidth: 0, gap: 3, paddingVertical: 2 }}>
        <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700', lineHeight: 23 }}>
          {word}
          {meaning ? ` · ${meaning}` : ''}
        </Text>
        {!!example && <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>{example}</Text>}
      </View>
    </View>
  );
}
