import { router } from 'expo-router';
import { LearningScreen } from '@/components/Learning';
import { StudyProgress } from '@/components/StudyProgress';
import { Button } from '@/components/UI';
export default function Plan() {
  return (
    <LearningScreen title="Study Plan" back>
      <StudyProgress />
      <Button label="Learning goals" onPress={() => router.push('/onboarding')} />
    </LearningScreen>
  );
}
