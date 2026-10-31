import Constants from 'expo-constants';
import { Platform } from 'react-native';

const host = Constants.expoConfig?.hostUri?.split(':')[0];
const webHost = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : null;
export const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || `http://${webHost || host || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost')}:4000/api`;
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function api<T>(path: string, options: { method?: string; body?: unknown; token?: string | null; signal?: AbortSignal } = {}): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  if (options.signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 15_000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    const payload = await response.json();
    if (!response.ok) throw new ApiError(payload.error?.message || 'Yêu cầu chưa thực hiện được.', response.status);
    return payload.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (options.signal?.aborted) throw error;
    throw new ApiError('Chưa kết nối được máy chủ. Kiểm tra Wi-Fi và backend rồi thử lại.', 0);
  } finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', abort); }
}
