import { useState } from 'react';
import { LearningScreen, Copy, Panel, Choice } from '@/components/Learning';
const entries = [
  ['Where are my scores?', 'Open Exam history in Online Exam to see submitted papers and quizzes.'],
  [
    'How do I review a word?',
    'Save a word in Dictionary or add it to a Flashcard deck. Open the deck to review due cards.',
  ],
  [
    'How can I reset my password?',
    'On the login screen, choose Forgot password and enter your registered email.',
  ],
];
export default function FAQ() {
  const [open, setOpen] = useState(-1);
  return (
    <LearningScreen title="FAQ" back>
      {entries.map(([question, answer], i) => (
        <Panel key={question}>
          <Choice label={question} selected={open === i} onPress={() => setOpen(open === i ? -1 : i)} />
          {open === i && <Copy>{answer}</Copy>}
        </Panel>
      ))}
    </LearningScreen>
  );
}
