import { useColorScheme } from 'react-native';
import { useAuth } from './auth';

export const colors = { ink: '#24213B', muted: '#6C657A', purple: '#155BC1', purpleDark: '#194AA0', lavender: '#E8F1FF', paper: '#F5F9FF', white: '#FFFFFF', border: '#EAE7F0', green: '#548A71', error: '#BC4359' };
export const heading = 'Fredoka_500Medium';

const dark = {
  ...colors, paper: '#16131F', white: '#241F30', ink: '#F3EEFA', muted: '#BDB2D0',
  lavender: '#322449', border: '#433852', purple: '#BCA5FA', purpleDark: '#D2C2FE', green: '#A0D0B6', error: '#F4A8B5',
};

export function useAppColors() {
  const { user } = useAuth();
  const system = useColorScheme();
  const appearance = user?.preferences?.appearance;
  return appearance === 'dark' || (appearance === 'system' && system === 'dark') ? dark : colors;
}
