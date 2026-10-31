import React, { createContext, useContext, useEffect, useState } from 'react';
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
type Context = { user: User | null; token: string | null; loading: boolean; connectionError: string; retry: () => void; login: (email: string, password: string) => Promise<void>; register: (name: string, email: string, password: string) => Promise<void>; logout: () => Promise<void> };
const AuthContext = createContext<Context | null>(null);
export function AuthProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null), [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [connectionError, setConnectionError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setConnectionError('');
    (async () => {
      try {
        const saved = await storage.get();
        if (saved) {
          const me = await api<User>('/auth/me', { token: saved });
          if (active) { setToken(saved); setUser(me); }
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) await storage.remove();
        else if (active) setConnectionError(error instanceof Error ? error.message : 'Không thể khôi phục phiên đăng nhập.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [attempt]);
  async function authenticate(path: string, body: unknown) {
    const result = await api<{ user: User; token: string }>(path, { method: 'POST', body });
    await storage.set(result.token); setToken(result.token); setUser(result.user); setConnectionError('');
  }
  return <AuthContext.Provider value={{ user, token, loading, connectionError, retry: () => setAttempt(n => n + 1),
    login: (email, password) => authenticate('/auth/login', { email, password }),
    register: (name, email, password) => authenticate('/auth/register', { name, email, password }),
    logout: async () => { await storage.remove(); setToken(null); setUser(null); setConnectionError(''); },
  }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const auth = useContext(AuthContext); if (!auth) throw new Error('AuthProvider missing'); return auth; }
