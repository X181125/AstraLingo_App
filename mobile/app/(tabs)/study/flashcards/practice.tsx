import { useState } from 'react';
import { router } from 'expo-router';
import {
  Choice,
  Choices,
  Copy,
  LearningScreen,
  Panel,
  Pending,
  Section,
  useFocusedData,
} from '@/components/Learning';
import { Button } from '@/components/UI';
import type { Deck, Page } from '@/src/learning';

export default function PracticeSetup() {
  const decks = useFocusedData<Page<Deck>>('/learn/decks?view=mine&limit=100');
  const [selected, select] = useState<string[]>([]),
    [mode, setMode] = useState<'front' | 'back'>('front'),
    [shuffle, setShuffle] = useState(false);
  return (
    <LearningScreen title="Practice" back>
      <Section title="Choose mode">
        <Choices
          values={['front', 'back'] as const}
          value={mode}
          onChange={setMode}
          label={(m) => (m === 'front' ? 'Word first' : 'Meaning first')}
        />
      </Section>
      <Section title="Choose decks">
        <Pending {...decks} />
        {decks.data?.items.map((d) => (
          <Choice
            key={d.id}
            label={d.title}
            selected={selected.includes(d.id)}
            onPress={() =>
              select((ids) => (ids.includes(d.id) ? ids.filter((id) => id !== d.id) : [...ids, d.id]))
            }
          />
        ))}
        {decks.data?.items.length === 0 && (
          <Panel>
            <Copy>Create a word list to start practising.</Copy>
            <Button
              secondary
              label="Create Word List"
              onPress={() => router.push('/study/flashcards/create_list')}
            />
          </Panel>
        )}
      </Section>
      <Section title="Session settings">
        <Choice label="Shuffle cards" selected={shuffle} onPress={() => setShuffle((v) => !v)} />
      </Section>
      <Button
        label="Start Practice"
        disabled={!selected.length}
        onPress={() =>
          router.push({
            pathname: '/study/flashcards/practice_session',
            params: { deckIds: JSON.stringify(selected), mode, shuffle: shuffle ? '1' : '0' },
          })
        }
      />
    </LearningScreen>
  );
}
