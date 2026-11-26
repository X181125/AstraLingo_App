import { useState } from 'react';
import { ActionNotice, Choice, Copy, Panel, Section, useAction } from './Learning';
import { Button } from './UI';
import { api } from '../src/api';
import { useAuth } from '../src/auth';
import { View } from 'react-native';

const writing = [
  ['brainstorm', 'Tìm ý'],
  ['outline', 'Lập dàn ý'],
  ['analyze', 'Phân tích đề'],
  ['vocab-pack', 'Từ theo chủ đề'],
  ['translate', 'Dịch đề'],
  ['simplify', 'Đơn giản hóa'],
  ['thesis', 'Luận điểm'],
  ['topic-sentences', 'Câu chủ đề'],
  ['examples', 'Ví dụ'],
  ['phrase-bank', 'Cụm từ'],
  ['checklist', 'Kiểm tra bài'],
] as const;
const listening = [
  ['pre-listening/generate', 'Trước khi nghe'],
  ['transcript/summarize', 'Tóm tắt'],
  ['transcript/translate', 'Dịch transcript'],
  ['transcript/explain', 'Giải thích'],
  ['transcript/vocabulary-extract', 'Từ vựng'],
  ['discussion-questions/generate', 'Thảo luận'],
  ['shadowing-script/generate', 'Luyện nhại'],
  ['pronunciation-focus/generate', 'Trọng âm'],
  ['post-listening/generate', 'Sau khi nghe'],
] as const;
export function LanguageCoach({ kind, id }: { kind: 'listening' | 'writing'; id: number }) {
  const options = kind === 'writing' ? writing : listening;
  const { token } = useAuth();
  const [selected, setSelected] = useState<string>(options[0][0]);
  const [response, setResponse] = useState<{ label: string; text: string }>();
  const action = useAction();
  return (
    <Section title={kind === 'writing' ? 'Trợ lý viết' : 'Trợ lý nghe'}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map(([key, label]) => (
          <Choice key={key} label={label} selected={selected === key} onPress={() => setSelected(key)} />
        ))}
      </View>
      <ActionNotice action={action} />
      <Button
        label="Nhận hướng dẫn"
        loading={action.busy}
        icon="sparkles-outline"
        onPress={() =>
          void action.run(async () => {
            const base = kind === 'writing' ? '/writing-prompts/' + id + '/ai/' : '/listening-audios/' + id + '/';
            const result = await api<{ text: string }>(base + selected, {
              token,
              method: 'POST',
              body: {},
              timeoutMs: 55000,
            });
            setResponse({ label: options.find((o) => o[0] === selected)![1], text: result.text });
          })
        }
      />
      {response && (
        <Panel>
          <Copy>{response.label}</Copy>
          <Copy selectable>{response.text}</Copy>
        </Panel>
      )}
    </Section>
  );
}
