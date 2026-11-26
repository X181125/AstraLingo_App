import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const key = 'astralingo.social';
type Origin = { id: string; proof: string };

export async function saveOrigin(origin: Origin) {
  const serialized = JSON.stringify(origin);
  if (Platform.OS === 'web') sessionStorage.setItem(key, serialized);
  else await SecureStore.setItemAsync(key, serialized);
}

export async function readOrigin(): Promise<Origin | null> {
  const serialized = Platform.OS === 'web' ? sessionStorage.getItem(key) : await SecureStore.getItemAsync(key);
  return serialized ? JSON.parse(serialized) as Origin : null;
}

export async function removeOrigin() {
  if (Platform.OS === 'web') sessionStorage.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}
