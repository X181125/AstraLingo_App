import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActionNotice,
  Choice,
  Copy,
  Input,
  LearningScreen,
  Panel,
  Pending,
  Section,
  useAction,
  useFocusedData,
} from '../../components/Learning';
import { Button } from '../../components/UI';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import type { Card, CardInput, Deck } from '../../src/learning';

const ratings = [
  { id: 'again', label: 'Quên · ôn lại ngay' },
  { id: 'hard', label: 'Khó · 1 ngày' },
  { id: 'good', label: 'Nhớ được' },
  { id: 'easy', label: 'Dễ' },
];

export default function DeckScreen() {
  const {
    id,
    deckView: screen,
    cardId,
  } = useLocalSearchParams<{ id: string; deckView?: string; cardId?: string }>();
  const heading = (
    {
      practice: 'Practice',
      practice_session: 'Practice Session',
      practice_complete: 'Session Completed!',
      edit_deck: 'Edit Deck',
      edit_flashcard: 'Edit Flashcard',
      generate_from_text: 'Smart Create',
    } as Record<string, string>
  )[screen ?? ''];
  const path = id ? `/learn/decks/${encodeURIComponent(id)}` : null;
  const deck = useFocusedData<Deck>(path);
  return (
    <LearningScreen
      title={heading ?? deck.data?.title ?? 'Flashcards'}
      subtitle={heading && deck.data?.title}
      back
    >
      <Pending {...deck} />
      {deck.data && path && (
        <DeckContent
          key={[id, screen, cardId].join('/')}
          screen={screen}
          cardId={cardId}
          deck={deck.data}
          path={path}
          reload={deck.reload}
        />
      )}
    </LearningScreen>
  );
}

function DeckContent({
  deck,
  path,
  reload,
  screen,
  cardId,
}: {
  screen?: string;
  cardId?: string;
  deck: Deck;
  path: string;
  reload: () => void;
}) {
  const { token, user } = useAuth();
  const action = useAction();
  const ai = useFocusedData<{ gemini: boolean }>('/learn/ai/capabilities');
  const [title, setTitle] = useState(deck.title);
  const [isPublic, setPublic] = useState(deck.isPublic);
  const original = deck.cards?.find((c) => c.id === cardId || String(c.publicId) === cardId);
  const [front, setFront] = useState(original?.front ?? '');
  const [back, setBack] = useState(original?.back ?? '');
  const [batch, setBatch] = useState('');
  const [topic, setTopic] = useState('');
  const [generated, setGenerated] = useState<CardInput[]>([]);
  const [editing, setEditing] = useState<string | undefined>(original?.id);
  const [side, setSide] = useState(false);
  const [reviewing, setReviewing] = useState(screen === 'practice_session');
  const [pendingReview, setPendingReview] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const mine = user?.id === deck.ownerId;
  const cards = deck.cards ?? [];
  const due = cards.filter(
    (card) => !card.reviews.length || Date.parse(card.reviews[0].nextReview) <= Date.now(),
  );
  const next = due.find((card) => card.id !== pendingReview) ?? due[0];

  async function add(list: CardInput[]) {
    await api(path + '/cards', { token, method: 'POST', body: { cards: list } });
    reload();
    action.setSuccess(`Đã thêm ${list.length} thẻ.`);
  }
  function edit(card: Card) {
    setEditing(card.id);
    setFront(card.front);
    setBack(card.back);
  }
  function resetCard() {
    setEditing(undefined);
    setFront('');
    setBack('');
  }

  if (!mine)
    return (
      <>
        <ActionNotice action={action} />
        <Button
          label="Sao chép vào bộ thẻ của tôi"
          loading={action.busy}
          onPress={() =>
            void action.run(async () => {
              const copy = await api<Deck>(path + '/clone', { token, method: 'POST' });
              router.replace({ pathname: '/flashcards/[id]', params: { id: copy.id } });
            })
          }
        />
        {cards.map((card) => (
          <Panel key={card.id}>
            <Copy>{card.front}</Copy>
            <Copy>{card.back}</Copy>
          </Panel>
        ))}
      </>
    );

  const full = !screen || screen === 'deck';
  if (screen === 'practice_complete')
    return (
      <Panel>
        <Copy>{cards.filter((c) => c.reviews.length).length} cards reviewed</Copy>
        <Button label="Back to decks" onPress={() => router.replace('/flashcards')} />
      </Panel>
    );
  return (
    <>
      <ActionNotice action={action} />
      {(full || screen === 'practice' || screen === 'practice_session') && (
        <Section title="Ôn tập">
          <Copy>
            {due.length} thẻ đến hạn · {cards.filter((card) => card.reviews.length).length}/{cards.length} thẻ
            đã ôn
          </Copy>
          <Button
            label={reviewing ? 'Kết thúc ôn tập' : 'Ôn thẻ đến hạn'}
            secondary={reviewing}
            disabled={!reviewing && !due.length}
            onPress={() => {
              setReviewing((value) => !value);
              setSide(false);
              setPendingReview('');
            }}
          />
          {reviewing &&
            (next ? (
              <Panel>
                <Copy>{next.front}</Copy>
                {side && <Copy>{next.back}</Copy>}
                <Button
                  label={side ? 'Ẩn đáp án' : 'Lật thẻ'}
                  secondary
                  onPress={() => setSide((value) => !value)}
                />
                {side &&
                  ratings.map((item) => (
                    <Choice
                      key={item.id}
                      label={item.label}
                      onPress={() =>
                        void action.run(async () => {
                          await api(`/learn/cards/${next.id}/review`, {
                            token,
                            method: 'POST',
                            body: { answer: item.id },
                          });
                          setSide(false);
                          setPendingReview(next.id);
                          reload();
                          action.setSuccess('Đã lưu lịch ôn tiếp theo.');
                        })
                      }
                    />
                  ))}
              </Panel>
            ) : (
              <Copy>Bạn đã ôn hết thẻ đến hạn.</Copy>
            ))}
        </Section>
      )}
      {!reviewing && (
        <>
          {(full || screen === 'edit_deck') && (
            <Section title="Cài đặt bộ thẻ">
              <Input label="Tên bộ thẻ" value={title} onChangeText={setTitle} maxLength={100} />
              <Choice
                label={isPublic ? 'Công khai cho cộng đồng' : 'Riêng tư'}
                selected={isPublic}
                onPress={() => setPublic((value) => !value)}
              />
              <Button
                label="Lưu cài đặt"
                secondary
                disabled={title.trim().length < 2 || action.busy}
                onPress={() =>
                  void action.run(async () => {
                    await api(path, { token, method: 'PATCH', body: { title, isPublic } });
                    reload();
                    action.setSuccess('Đã lưu bộ thẻ.');
                  })
                }
              />
            </Section>
          )}
          {(full || screen === 'edit_flashcard' || screen === 'generate_from_text') && (
            <Section
              title={
                screen === 'generate_from_text' ? 'Smart Create' : editing ? 'Chỉnh sửa thẻ' : 'Thêm thẻ'
              }
            >
              {screen !== 'generate_from_text' && (
                <>
                  <Input label="Mặt trước" value={front} onChangeText={setFront} maxLength={180} />
                  <Input label="Mặt sau" value={back} onChangeText={setBack} maxLength={500} />
                  <Button
                    label={editing ? 'Lưu chỉnh sửa' : 'Thêm thẻ'}
                    disabled={action.busy || !front.trim() || !back.trim()}
                    onPress={() =>
                      void action.run(async () => {
                        if (editing) {
                          await api(`/learn/cards/${editing}`, {
                            token,
                            method: 'PUT',
                            body: { front, back },
                          });
                          reload();
                          action.setSuccess('Đã sửa thẻ.');
                        } else await add([{ front, back }]);
                        resetCard();
                      })
                    }
                  />
                  {editing && <Button label="Hủy chỉnh sửa" secondary onPress={resetCard} />}
                  <Input
                    label="Thêm hàng loạt (mỗi dòng: từ | nghĩa)"
                    multiline
                    value={batch}
                    onChangeText={setBatch}
                    maxLength={10_000}
                  />
                  <Button
                    label="Thêm thẻ hàng loạt"
                    secondary
                    disabled={!batch.trim() || action.busy}
                    onPress={() =>
                      void action.run(async () => {
                        const list = batch
                          .split('\n')
                          .filter((line) => line.trim())
                          .map((line) => {
                            const split = line.indexOf('|');
                            if (split < 0) throw new Error('Mỗi dòng cần một dấu | ngăn cách hai mặt thẻ.');
                            return { front: line.slice(0, split).trim(), back: line.slice(split + 1).trim() };
                          });
                        if (list.length > 40) throw new Error('Mỗi lần thêm tối đa 40 thẻ.');
                        await add(list);
                        setBatch('');
                      })
                    }
                  />
                </>
              )}
              {screen === 'generate_from_text' && ai.data && !ai.data.gemini && (
                <Copy>Configure Gemini on the server to generate cards.</Copy>
              )}
              {ai.data?.gemini && (
                <>
                  <Input
                    label="Chủ đề hoặc đoạn văn để sinh thẻ"
                    multiline
                    value={topic}
                    onChangeText={setTopic}
                    maxLength={10_000}
                  />
                  <Button
                    label="Sinh thẻ bằng Gemini"
                    secondary
                    disabled={!topic.trim() || action.busy}
                    onPress={() =>
                      void action.run(async () => {
                        const { cards: result } = await api<{ cards: CardInput[] }>('/learn/ai', {
                          token,
                          method: 'POST',
                          timeoutMs: 55_000,
                          body: { task: 'flashcards', text: topic },
                        });
                        setGenerated(result);
                      })
                    }
                  />
                  {generated.length > 0 && (
                    <Panel>
                      {generated.map((item, index) => (
                        <Copy key={index}>
                          {item.front} · {item.back}
                        </Copy>
                      ))}
                      <Button
                        label="Lưu các thẻ đã sinh"
                        disabled={action.busy}
                        onPress={() =>
                          void action.run(async () => {
                            await add(generated);
                            setGenerated([]);
                          })
                        }
                      />
                    </Panel>
                  )}
                </>
              )}
            </Section>
          )}
          {(full || screen === 'edit_flashcard') && (
            <Section title="Danh sách thẻ">
              {!cards.length && <Copy>Bộ thẻ chưa có nội dung.</Copy>}
              {cards.map((card) => (
                <Panel key={card.id}>
                  <Copy>
                    {card.front} · {card.back}
                  </Copy>
                  <Copy>
                    {card.reviews[0]
                      ? `Hộp ${card.reviews[0].box} · ôn lại ${new Date(card.reviews[0].nextReview).toLocaleDateString('vi-VN')}`
                      : 'Chưa ôn'}
                  </Copy>
                  <Button label="Chỉnh sửa thẻ" secondary onPress={() => edit(card)} />
                  <Button
                    label="Xóa thẻ"
                    secondary
                    disabled={action.busy}
                    onPress={() =>
                      void action.run(async () => {
                        await api(`/learn/cards/${card.id}`, { token, method: 'DELETE' });
                        if (editing === card.id) resetCard();
                        reload();
                      })
                    }
                  />
                </Panel>
              ))}
              {deleteConfirm && <Copy>Xóa bộ thẻ sẽ xóa các thẻ và lịch ôn của bộ này.</Copy>}
              <Button
                label={deleteConfirm ? 'Xác nhận xóa bộ thẻ' : 'Xóa bộ thẻ'}
                secondary
                disabled={action.busy}
                onPress={() => {
                  if (!deleteConfirm) {
                    setDeleteConfirm(true);
                    return;
                  }
                  void action.run(async () => {
                    await api(path, { token, method: 'DELETE' });
                    router.back();
                  });
                }}
              />
              {deleteConfirm && (
                <Button label="Giữ bộ thẻ" secondary onPress={() => setDeleteConfirm(false)} />
              )}
            </Section>
          )}
        </>
      )}
      <ActionNotice action={action} />
    </>
  );
}
