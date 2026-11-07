export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export type ApiOptions = { method?: string; body?: unknown; token?: string | null; signal?: AbortSignal };
export function createApiClient(baseUrl: string, requireHttps = false) {
  return async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
    if (!baseUrl || (requireHttps && !/^https:\/\//i.test(baseUrl))) throw new ApiError('Bản ứng dụng chưa được cấu hình địa chỉ API HTTPS. Liên hệ người cung cấp bản cài.', 0);
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort);
    if (options.signal?.aborted) controller.abort();
    const timeout = setTimeout(abort, 15_000);
    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}${path}`, {
        method: options.method ?? 'GET', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
      // Nginx can return HTML for 413/502; preserve the HTTP status.
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const fallback = response.status === 413 ? 'Dữ liệu gửi lên quá lớn.' : response.status === 429 ? 'Bạn thử quá nhiều lần. Vui lòng thử lại sau.' : 'Máy chủ chưa xử lý được yêu cầu. Vui lòng thử lại.';
        throw new ApiError(typeof payload?.error?.message === 'string' ? payload.error.message : fallback, response.status);
      }
      if (!payload || payload.success !== true || !Object.prototype.hasOwnProperty.call(payload, 'data')) throw new ApiError('Phản hồi từ máy chủ không hợp lệ.', response.status);
      return payload.data as T;
    } catch (error) {
      if (error instanceof ApiError || options.signal?.aborted) throw error;
      throw new ApiError('Chưa kết nối được máy chủ. Kiểm tra kết nối mạng rồi thử lại.', 0);
    } finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', abort); }
  };
}
