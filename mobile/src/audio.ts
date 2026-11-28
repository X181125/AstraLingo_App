import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { api } from './api';

export type Recording = { mimeType: string; data: string };
const maxBytes = 4 * 1024 * 1024;

export async function readRecording(uri: string, preferredMimeType?: string): Promise<Recording> {
  if (Platform.OS !== 'web') {
    const file = new File(uri);
    if (file.size > maxBytes) throw new Error('Bản ghi dài quá. Hãy ghi lại đoạn ngắn hơn.');
    return { mimeType: preferredMimeType ?? 'audio/mp4', data: await file.base64() };
  }
  const blob = await (await fetch(uri)).blob();
  if (blob.size > maxBytes) throw new Error('Bản ghi dài quá. Hãy ghi lại đoạn ngắn hơn.');
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const mimeType = (preferredMimeType || blob.type || 'audio/webm').split(';')[0].replace(/^video\/webm$/, 'audio/webm').replace(/^video\/mp4$/, 'audio/mp4');
  return { mimeType, data };
}

export async function uploadRecording(token: string | null, recording: Recording) {
  const result = await api<{ id: string }>('/study/audio', { token, method: 'POST', body: recording, timeoutMs: 45_000 });
  return result.id;
}

export async function getPlayback(token: string | null, id: string) {
  const result = await api<{ url?: string; mimeType: string; data?: string }>(`/study/audio/${encodeURIComponent(id)}`, { token, timeoutMs: 45_000 });
  if (result.url) return { uri: result.url, expiresAt: Date.now() + 240_000, cleanup: () => {} };
  if (!result.data) throw new Error('Tệp âm thanh không có dữ liệu.');
  if (Platform.OS === 'web') return { uri: `data:${result.mimeType};base64,${result.data}`, cleanup: () => {} };
  const extension = ({ 'audio/mp4': 'm4a', 'audio/m4a': 'm4a', 'audio/x-m4a': 'm4a', 'audio/mpeg': 'mp3',
    'audio/webm': 'webm', 'audio/wav': 'wav', 'audio/ogg': 'ogg' } as Record<string, string>)[result.mimeType] ?? 'm4a';
  const file = new File(Paths.cache, `practice-audio-${id}-${Date.now()}.${extension}`);
  file.create();
  file.write(result.data, { encoding: 'base64' });
  return { uri: file.uri, cleanup: () => { if (file.exists) file.delete(); } };
}
