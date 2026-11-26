import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ApiError, createApiClient, type ApiOptions } from './api-client';
export { ApiError } from './api-client';

const host = Constants.expoConfig?.hostUri?.split(':')[0];
const webHost = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : null;
const developmentUrl = `http://${webHost || host || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost')}:4000/api`;
export const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || (__DEV__ ? developmentUrl : Platform.OS === 'web' ? '/api' : '');
export const directApi = createApiClient(API_URL, !__DEV__ && Platform.OS !== 'web');
let refresh: ((token: string) => Promise<string | null>) | undefined;
export function useSessionRefresh(handler: typeof refresh) {
  refresh = handler;
  return () => { if (refresh === handler) refresh = undefined; };
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  try {
    return await directApi<T>(path, options);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !options.token || options.signal?.aborted || !refresh) throw error;
    const renewed = await refresh(options.token);
    if (!renewed || options.signal?.aborted) throw error;
    return directApi<T>(path, { ...options, token: renewed });
  }
}
