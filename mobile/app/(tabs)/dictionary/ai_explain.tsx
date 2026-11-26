import { useState } from 'react';
import { LearningScreen, Input, Copy, Panel, Pending, ActionNotice, useFocusedData, useAction } from '@/components/Learning';
import { Button } from '@/components/UI';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';

export default function Explain() {
  const { token } = useAuth();
  const available = useFocusedData<{ gemini: boolean }>('/learn/ai/capabilities');
  const action = useAction();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<{ word: string; meaning: string }>();
  return <LearningScreen title="Giải thích tiếng Anh" subtitle="Nhập một từ hoặc câu để xem nghĩa trong ngữ cảnh." back>
    <Pending {...available} /><ActionNotice action={action} />
    <Input label="Từ hoặc câu tiếng Anh" multiline value={input} maxLength={1500} onChangeText={setInput} />
    {available.data && !available.data.gemini && <Copy>Chức năng giải thích cần khóa Gemini trên máy chủ. Bạn vẫn có thể tra từ trong English Explorer.</Copy>}
    <Button label="Giải thích" icon="sparkles-outline" disabled={!available.data?.gemini || !input.trim()} loading={action.busy} onPress={() => void action.run(async () => {
      const word = input.trim();
      const response = await api<{text:string}>('/learn/ai', {token,method:'POST',body:{task:'explain',text:word},timeoutMs:55000});
      setResult({word,meaning:response.text});
    })} />
    {result && <Panel><Copy selectable>{result.meaning}</Copy>
      <Button secondary label="Lưu giải thích" disabled={action.busy} onPress={() => void action.run(async () => {
        await api('/study/words',{token,method:'PUT',body:{word:result.word.slice(0,120),meaning:result.meaning.slice(0,500)}});
        action.setSuccess('Đã lưu vào từ vựng cá nhân.');
      })} />
    </Panel>}
  </LearningScreen>;
}
