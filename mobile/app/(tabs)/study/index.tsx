import { router, useLocalSearchParams } from 'expo-router';
import { DiscoveryRow, type IconName } from '@/components/DiscoveryUI';
import { LearningScreen, Section } from '@/components/Learning';
import { LessonLibrary } from '@/components/LessonLibrary';
import { skills, type Skill } from '@/src/learning';

type Item = [title: string, detail: string, icon: IconName, path: string];
const sections: { title: string; items: Item[] }[] = [
  {
    title: 'Content',
    items: [
      [
        'Explore',
        'Discover English lessons from the community.',
        'compass-outline',
        '/study/content/explore',
      ],
      [
        'My Content',
        'Manage your drafts and published lessons.',
        'folder-open-outline',
        '/study/content/mine',
      ],
    ],
  },
  {
    title: 'Core',
    items: [
      ['Online Exam', 'Sit a timed SAT paper and review your score.', 'document-text-outline', '/study/exam'],
      ['Flashcards', 'Review vocabulary due today.', 'layers-outline', '/flashcards'],
      ['Mini Quiz', 'Take a short quiz by topic.', 'flash-outline', '/study/quiz'],
    ],
  },
  {
    title: 'Skills Practice',
    items: [
      [
        'Listening Practice',
        'Listen to audio and follow the transcript.',
        'headset-outline',
        '/study/listening',
      ],
      ['Reading Practice', 'Read a passage and answer questions.', 'book-outline', '/study/reading'],
      ['Speaking Practice', 'Record and review a response.', 'mic-outline', '/study/speaking'],
      ['Writing Practice', 'Draft, revise and submit your writing.', 'pencil-outline', '/study/writing'],
    ],
  },
  {
    title: 'Tools',
    items: [
      ['Vocabulary Builder', 'Find and save English words.', 'library-outline', '/dictionary/explorer'],
      ['Grammar Practice', 'Practise with English grammar quizzes.', 'create-outline', '/study/grammar'],
      ['Pronunciation', 'Practise speaking aloud.', 'volume-high-outline', '/study/speaking'],
      ['Study Plan', 'View your goals and progress.', 'calendar-outline', '/study/plan'],
    ],
  },
];
export default function Study() {
  const { skill, view } = useLocalSearchParams<{ skill?: Skill; view?: string }>();
  if (view || (skill && skills.includes(skill)))
    return <LessonLibrary initialSkill={skill} mine={view === 'mine'} />;
  return (
    <LearningScreen title="Study" subtitle="Pick a mode and start learning.">
      {sections.map((section) => (
        <Section key={section.title} title={section.title}>
          {section.items.map(([title, detail, icon, path]) => (
            <DiscoveryRow key={path} {...{ title, detail, icon }} onPress={() => router.push(path)} />
          ))}
        </Section>
      ))}
    </LearningScreen>
  );
}
