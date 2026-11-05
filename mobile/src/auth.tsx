import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api, ApiError } from './api';
import type { User } from './types';

const KEY = 'astralingo.session';
// Browser preview uses sessionStorage (cleared with the tab). Native uses OS SecureStore.
const storage = {
  get: async () => Platform.OS === 'web' ? (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(KEY) : null) : SecureStore.getItemAsync(KEY),
  set: async (value: string) => { if (Platform.OS === 'web') sessionStorage.setItem(KEY, value); else await SecureStore.setItemAsync(KEY, value); },
  remove: async () => { if (Platform.OS === 'web') sessionStorage.removeItem(KEY); else await SecureStore.deleteItemAsync(KEY); },
};
type Context = { user: User | null; token: string | null; loading: boolean; connectionError: string; retry: () => void; login: (email: string, password: string) => Promise<void>; register: (name: string, email: string, password: string) => Promise<void>; logout: () => Promise<void>; expire: (failedToken: string | null) => Promise<void> };
const AuthContext = createContext<Context | null>(null);
export function AuthProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null), [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [connectionError, setConnectionError] = useState(''), [attempt, setAttempt] = useState(0);
  const revision = useRef(0), currentToken = useRef<string | null>(null);
  const storageQueue = useRef<Promise<unknown>>(Promise.resolve());
  function store(task: () => Promise<unknown>) {
    const next = storageQueue.current.then(task);
    storageQueue.current = next.catch(() => {});
    return next;
  }
  async function logout() {
    ++revision.current;
    currentToken.current = null;
    setToken(null); setUser(null); setLoading(false); setConnectionError('');
    await store(() => storage.remove());
  }
  useEffect(() => {
    let active = true;
    const version = revision.current;
    const valid = () => active && version === revision.current;
    setLoading(true); setConnectionError('');
    (async () => {
      try {
        const saved = await store(() => storage.get()) as string | null;
        if (saved) {
          const me = await api<User>('/auth/me', { token: saved });
          if (valid()) { currentToken.current = saved; setToken(saved); setUser(me); }
        }
      } catch (error) {
        if (!valid()) return;
        if (error instanceof ApiError && error.status === 401) {
          currentToken.current = null; setToken(null); setUser(null);
          try { await store(() => storage.remove()); }
          catch { if (valid()) setConnectionError('Không thể xóa phiên cũ trên thiết bị. Hãy thử lại.'); }
        } else setConnectionError(error instanceof Error ? error.message : 'Không thể khôi phục phiên đăng nhập.');
      } finally { if (valid()) setLoading(false); }
    })();
    return () => { active = false; };
  }, [attempt]);
  async function authenticate(path: string, body: unknown) {
    const version = ++revision.current;
    setLoading(false);
    const result = await api<{ user: User; token: string }>(path, { method: 'POST', body });
    if (version !== revision.current) throw new Error('Phiên đã thay đổi. Vui lòng đăng nhập lại.');
    await store(() => version === revision.current ? storage.set(result.token) : Promise.resolve());
    if (version !== revision.current) throw new Error('Phiên đã thay đổi. Vui lòng đăng nhập lại.');
    currentToken.current = result.token; setToken(result.token); setUser(result.user); setConnectionError('');
  }
  return <AuthContext.Provider value={{ user, token, loading, connectionError, retry: () => setAttempt(n => n + 1),
    login: (email, password) => authenticate('/auth/login', { email, password }),
    register: (name, email, password) => authenticate('/auth/register', { name, email, password }),
    logout,
    expire: async failedToken => {
      if (!failedToken || failedToken !== currentToken.current) return;
      try { await logout(); } catch { setConnectionError('Phiên đã hết hạn nhưng chưa xóa được trên thiết bị. Hãy thử lại.'); }
    },
  }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const auth = useContext(AuthContext); if (!auth) throw new Error('AuthProvider missing'); return auth; }
