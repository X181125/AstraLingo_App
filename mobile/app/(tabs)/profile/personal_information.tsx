import { router } from 'expo-router';
import { LearningScreen, Copy, Section, Panel } from '@/components/Learning';
import { Button } from '@/components/UI';
import { useAuth } from '@/src/auth';
export default function Information() {
  const { user } = useAuth();
  return (
    <LearningScreen title="Personal Information" back>
      <Section title="Account">
        <Panel>
          <Copy>{user?.name}</Copy>
          <Copy>{user?.email}</Copy>
        </Panel>
      </Section>
      <Section title="Learning profile">
        <Panel>
          <Copy>English · {user?.level}</Copy>
        </Panel>
      </Section>
      <Button label="Edit profile" onPress={() => router.push('/settings')} />
    </LearningScreen>
  );
}
