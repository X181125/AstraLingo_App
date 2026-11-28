import { useState } from 'react';
import { View } from 'react-native';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';
import type { AnswerResult, CardInput, Deck, EditableQuestion, Page } from '@/src/learning';
import {
  ActionNotice,
  Answers,
  Choice,
  Copy,
  Input,
  Panel,
  Pending,
  Questions,
  Section,
  useAction,
  useFocusedData,
} from './Learning';
import { Button } from './UI';

const draftTools = [
  ['grammar-check', 'Kiểm tra ngữ pháp'],
  ['spell-check', 'Kiểm tra chính tả'],
  ['coherence-check', 'Xem độ mạch lạc'],
  ['task-response-check', 'Kiểm tra đáp ứng đề'],
  ['lexical-upgrade', 'Nâng cấp từ vựng'],
  ['improve', 'Gợi ý viết lại'],
  ['change-tone', 'Đổi giọng văn'],
  ['coach-chat', 'Hỏi trợ lý'],
] as const;

export function WritingDraftTools({ promptId, draft }: { promptId: number; draft: string }) {
  const { token } = useAuth();
  const action = useAction();
  const [tool, setTool] = useState<(typeof draftTools)[number][0]>('grammar-check');
  const [context, setContext] = useState('');
  const [feedback, setFeedback] = useState<{ label: string; text: string; draft: string }>();
  const hasContext = tool === 'coach-chat' || tool === 'change-tone';
  return (
    <Section title="Góp ý cho bản nháp">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {draftTools.map(([id, label]) => (
          <Choice
            key={id}
            label={label}
            selected={id === tool}
            onPress={() => {
              setTool(id);
              setContext('');
            }}
          />
        ))}
      </View>
      {hasContext && (
        <Input
          label={tool === 'coach-chat' ? 'Câu hỏi cho trợ lý' : 'Giọng văn bạn muốn'}
          value={context}
          onChangeText={setContext}
          maxLength={1500}
        />
      )}
      <Button
        label="Nhận góp ý bản nháp"
        secondary
        loading={action.busy}
        disabled={!draft.trim() || (hasContext && !context.trim())}
        onPress={() =>
          void action.run(async () => {
            const result = await api<{ text: string }>(`/writing-prompts/${promptId}/ai/draft/${tool}`, {
              token,
              method: 'POST',
              body: { text: draft, ...(hasContext && { context }) },
              timeoutMs: 55_000,
            });
            setFeedback({ label: draftTools.find(([id]) => id === tool)![1], text: result.text, draft });
          })
        }
      />
      <ActionNotice action={action} />
      {feedback && (
        <Panel>
          <Copy>{feedback.label}</Copy>
          {feedback.draft !== draft && <Copy>Kết quả này dựa trên bản nháp ở lần gửi trước.</Copy>}
          <Copy selectable>{feedback.text}</Copy>
        </Panel>
      )}
    </Section>
  );
}

type WritingAnalysis =
  | { overallBand: number; cefrLevel: string; rationale: string; confidence: string }
  | { errors: { type: string; original: string; suggestion: string; explanation: string }[] }
  | { improvedText: string };
const analyses = [
  ['band-estimate', 'Ước lượng band'],
  ['error-map', 'Xem lỗi và cách sửa'],
  ['improved-version', 'Xem bản gợi ý'],
] as const;

export function WritingResultTools({ submissionId }: { submissionId: number }) {
  const { token } = useAuth();
  const action = useAction();
  const [analysis, setAnalysis] = useState<{ label: string; value: WritingAnalysis }>();
  return (
    <Section title="Phân tích bài viết">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {analyses.map(([id, label]) => (
          <Button
            key={id}
            label={label}
            secondary
            disabled={action.busy}
            onPress={() =>
              void action.run(async () => {
                const result = await api<WritingAnalysis>(`/writing-submissions/${submissionId}/ai/${id}`, {
                  token,
                  timeoutMs: 55_000,
                });
                setAnalysis({ label, value: result });
              })
            }
          />
        ))}
      </View>
      <ActionNotice action={action} />
      {analysis && (
        <Panel>
          <Copy>{analysis.label}</Copy>
          <AnalysisResult value={analysis.value} />
        </Panel>
      )}
    </Section>
  );
}

export function WritingStudyAids({ submissionId }: { submissionId: number }) {
  const { token } = useAuth();
  const action = useAction();
  const [cards, setCards] = useState<CardInput[]>([]);
  const [deckId, setDeckId] = useState('');
  const [deckPage, setDeckPage] = useState(1);
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [grade, setGrade] = useState<AnswerResult>();
  const decks = useFocusedData<Page<Deck>>(cards.length ? '/learn/decks?view=mine&page=' + deckPage : null);
  const endpoint = `/writing-submissions/${submissionId}/ai/`;
  return (
    <Section title="Luyện thêm từ bài viết">
      <Button
        label="Sinh bài luyện"
        secondary
        loading={action.busy}
        onPress={() =>
          void action.run(async () => {
            const result = await api<{ questions: EditableQuestion[] }>(endpoint + 'generate-practice', {
              token,
              method: 'POST',
              timeoutMs: 55_000,
            });
            setQuestions(result.questions);
            setAnswers([]);
            setGrade(undefined);
          })
        }
      />
      {grade ? (
        <Answers result={grade} />
      ) : (
        !!questions.length && (
          <>
            <Questions questions={questions} selections={answers} onChange={setAnswers} />
            <Button
              label="Xem điểm bài luyện"
              onPress={() => {
                const details = questions.map((question, i) => ({
                  ...question,
                  selected: answers[i] ?? -1,
                  correct: answers[i] === question.answer,
                }));
                const correct = details.filter((detail) => detail.correct).length;
                setGrade({
                  details,
                  correct,
                  total: details.length,
                  score: Math.round((correct * 100) / details.length),
                });
              }}
            />
          </>
        )
      )}
      <Button
        label="Tạo Flashcard từ bài viết"
        secondary
        loading={action.busy}
        onPress={() =>
          void action.run(async () => {
            const result = await api<{ cards: CardInput[] }>(endpoint + 'create-flashcards', {
              token,
              method: 'POST',
              timeoutMs: 55_000,
            });
            setCards(result.cards);
            setDeckPage(1);
            setDeckId('');
          })
        }
      />
      {!!cards.length && (
        <Panel>
          {cards.map((card, index) => (
            <Copy key={index}>
              {card.front} · {card.back}
            </Copy>
          ))}
          <Pending {...decks} />
          {decks.data?.items.length === 0 && <Copy>Tạo bộ thẻ trong Flashcards rồi quay lại để lưu.</Copy>}
          {decks.data?.items.map((deck) => (
            <Choice
              key={deck.id}
              selected={deck.id === deckId}
              label={deck.title}
              onPress={() => setDeckId(deck.id)}
            />
          ))}
          {deckPage > 1 && (
            <Button secondary label="Bộ thẻ trang trước" onPress={() => setDeckPage((page) => page - 1)} />
          )}
          {decks.data?.hasMore && (
            <Button secondary label="Bộ thẻ trang sau" onPress={() => setDeckPage((page) => page + 1)} />
          )}
          <Button
            label="Lưu vào bộ thẻ đã chọn"
            disabled={!deckId}
            loading={action.busy}
            onPress={() =>
              void action.run(async () => {
                await api(`/learn/decks/${deckId}/cards`, { token, method: 'POST', body: { cards } });
                action.setSuccess('Đã thêm từ vựng vào bộ thẻ.');
                setCards([]);
              })
            }
          />
        </Panel>
      )}
      <ActionNotice action={action} />
    </Section>
  );
}

function AnalysisResult({ value }: { value: WritingAnalysis }) {
  if ('overallBand' in value)
    return (
      <>
        <Copy>
          {value.overallBand}/9 · {value.cefrLevel} · Độ tin cậy {value.confidence}
        </Copy>
        <Copy selectable>{value.rationale}</Copy>
      </>
    );
  if ('improvedText' in value) return <Copy selectable>{value.improvedText}</Copy>;
  if (!value.errors.length) return <Copy>Chưa tìm thấy lỗi cần sửa.</Copy>;
  return (
    <>
      {value.errors.map((error, index) => (
        <View key={index} style={{ gap: 4 }}>
          <Copy>
            {error.type} · {error.original} → {error.suggestion}
          </Copy>
          <Copy selectable>{error.explanation}</Copy>
        </View>
      ))}
    </>
  );
}
