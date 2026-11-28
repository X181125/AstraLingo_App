import { Button } from '@/components/UI';
import { router, Redirect, useLocalSearchParams } from 'expo-router';
import { LearningScreen, Panel, Copy, Pending, useFocusedData } from '@/components/Learning';

export default function FlashcardLink() {
  const {
    parts: raw,
    deckId,
    id,
    cardId,
    deckIds,
    total,
  } = useLocalSearchParams<{
    parts: string[] | string;
    deckId?: string;
    id?: string;
    cardId?: string;
    deckIds?: string;
    total?: string;
  }>();
  const parts = Array.isArray(raw) ? raw : raw.split('/');
  const screen = parts[0];
  const lookup = screen === 'edit_flashcard' && !deckId && !!id;
  const cards = useFocusedData<{ id: number; deckId: number }[]>(lookup ? '/flashcards' : null);
  let firstDeck: string | undefined;
  try {
    const list: unknown = JSON.parse(deckIds ?? '[]');
    if (Array.isArray(list) && list.length) firstDeck = String(list[0]);
  } catch {}
  const card = cards.data?.find((c) => String(c.id) === id);
  const key = screen === 'deck' ? parts[1] : (deckId ?? firstDeck ?? (lookup ? card?.deckId.toString() : id));
  const deck = useFocusedData<{ id: string }>(key ? '/learn/decks/' + encodeURIComponent(key) : null);
  if (screen === 'tabs')
    return (
      <Redirect
        href={{
          pathname: '/flashcards',
          params: {
            view: parts[1] === 'explore_tab' ? 'explore' : parts[1] === 'my_lists_tab' ? 'mine' : 'learning',
          },
        }}
      />
    );
  if (screen === 'practice_complete')
    return (
      <LearningScreen title="Session Completed!" back>
        <Panel>
          <Copy>{Number(total) || 0} cards reviewed</Copy>
          <Button label="Back to decks" onPress={() => router.replace('/flashcards')} />
        </Panel>
      </LearningScreen>
    );
  if (lookup && !card)
    return (
      <LearningScreen title="Edit Flashcard" back>
        <Pending {...cards} />
        {cards.data && <Copy>Card not found in your decks.</Copy>}
      </LearningScreen>
    );
  if (!key) return <Redirect href={{ pathname: '/flashcards', params: { action: screen } }} />;
  if (!deck.data)
    return (
      <LearningScreen title="Mở bộ thẻ" back>
        <Pending {...deck} />
      </LearningScreen>
    );
  return (
    <Redirect
      href={{
        pathname: '/flashcards/[id]',
        params: {
          id: deck.data.id,
          deckView: screen,
          cardId: cardId ?? (screen === 'edit_flashcard' ? id : ''),
        },
      }}
    />
  );
}
