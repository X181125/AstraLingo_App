import { Redirect } from 'expo-router';
import { useAuth } from '@/src/auth';
export default function SetupComplete() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Redirect href={user?.onboardedAt ? '/onboarding?page=done' : '/onboarding'} />;
}
