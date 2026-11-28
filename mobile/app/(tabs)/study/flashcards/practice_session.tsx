import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { LearningScreen, Copy, Panel, ActionNotice, useAction } from '@/components/Learning';
import { Button, Notice } from '@/components/UI';
import { useAuth } from '@/src/auth';
import { api } from '@/src/api';
import type { Card, Deck } from '@/src/learning';

export default function PracticeSession() {
  const { deckIds, deckId, id, mode, shuffle } = useLocalSearchParams<{
    deckIds?: string;
    deckId?: string;
    id?: string;
    mode?: string;
    shuffle?: string;
  }>();
  const { token } = useAuth(),
    action = useAction();
  const [cards, setCards] = useState<Card[]>(),
    [index, setIndex] = useState(0),
    [flipped, flip] = useState(false),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!token) return;
    const ctrl = new AbortController();
    async function load() {
      const keys: unknown = deckIds ? JSON.parse(deckIds) : [deckId ?? id].filter(Boolean);
      if (!Array.isArray(keys) || keys.some((k) => typeof k !== 'string' && typeof k !== 'number'))
        throw Error('Invalid deck selection.');
      const decks = await Promise.all(
        [...new Set(keys.map(String))].map((key) =>
          api<Deck>('/learn/decks/' + encodeURIComponent(key), { token, signal: ctrl.signal }),
        ),
      );
      const due = decks
        .flatMap((d) => d.cards ?? [])
        .filter((c) => !c.reviews.length || Date.parse(c.reviews[0].nextReview) <= Date.now());
      if (shuffle === '1')
        for (let i = due.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [due[i], due[j]] = [due[j], due[i]];
        }
      if (!ctrl.signal.aborted) {
        setCards(due);
        setIndex(0);
        flip(false);
      }
    }
    setError('');
    load().catch((e) => {
      if (!ctrl.signal.aborted) setError(e.message);
    });
    return () => ctrl.abort();
  }, [token, deckIds, deckId, id, shuffle, retry]);
  const card = cards?.[index];
  return (
    <LearningScreen title="Practice Session" back>
      <ActionNotice action={action} />
      {error ? (
        <>
          <Notice message={error} />
          <Button label="Try again" onPress={() => setRetry((n) => n + 1)} />
        </>
      ) : !cards ? (
        <Copy>Loading cards…</Copy>
      ) : card ? (
        <>
          <Copy>
            {index + 1} / {cards.length}
          </Copy>
          <Panel>
            <Copy>{mode === 'back' ? card.back : card.front}</Copy>
            {flipped && <Copy>{mode === 'back' ? card.front : card.back}</Copy>}
          </Panel>
          {!flipped ? (
            <Button label="Show answer" onPress={() => flip(true)} />
          ) : (
            ['again', 'hard', 'good', 'easy'].map((answer) => (
              <Button
                key={answer}
                label={answer}
                secondary
                disabled={action.busy}
                onPress={() =>
                  void action.run(async () => {
                    await api('/learn/cards/' + card.id + '/review', {
                      method: 'POST',
                      token,
                      body: { answer },
                    });
                    if (index + 1 === cards.length)
                      router.replace({
                        pathname: '/study/flashcards/practice_complete',
                        params: { total: String(cards.length) },
                      });
                    else {
                      setIndex((i) => i + 1);
                      flip(false);
                    }
                  })
                }
              />
            ))
          )}
        </>
      ) : (
        <Panel>
          <Copy>No cards due for review.</Copy>
          <Button
            secondary
            label="Choose decks"
            onPress={() => router.replace('/study/flashcards/practice')}
          />
        </Panel>
      )}
    </LearningScreen>
  );
}
