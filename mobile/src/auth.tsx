import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { directApi, ApiError, useSessionRefresh } from './api';
import type { User } from './types';

const KEY = 'astralingo.session';
// Browser preview uses sessionStorage (cleared with the tab). Native uses OS SecureStore.
const storage = {
  get: async () => Platform.OS === 'web' ? (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(KEY) : null) : SecureStore.getItemAsync(KEY),
  set: async (value: string) => { if (Platform.OS === 'web') sessionStorage.setItem(KEY, value); else await SecureStore.setItemAsync(KEY, value); },
  remove: async () => {
    try {
      if (Platform.OS === 'web') sessionStorage.removeItem(KEY);
      else await SecureStore.deleteItemAsync(KEY);
    } catch {
      // A blank value cannot be restored as a token if deletion fails.
      await storage.set('');
    }
  },
};
type Tokens = { token: string; refreshToken?: string };
type Session = Tokens & { user: User };
type Context = { user: User | null; token: string | null; loading: boolean; connectionError: string; retry: () => void; login: (email: string, password: string) => Promise<void>; register: (name: string, email: string, password: string) => Promise<void>; logout: () => Promise<void>; expire: (failedToken: string | null) => Promise<void>; updateUser: (user: User) => void; finishSocial: (id: string, proof: string, ticket: string) => Promise<User> };
const AuthContext = createContext<Context | null>(null);
export function AuthProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null), [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [connectionError, setConnectionError] = useState(''), [attempt, setAttempt] = useState(0);
  const revision = useRef(0), currentToken = useRef<string | null>(null);
  const currentRefresh = useRef<string | undefined>(undefined);
  const refreshing = useRef<{ token: string; promise: Promise<string | null> } | undefined>(undefined);
  const storageClearPending = useRef(false);
  const storageQueue = useRef<Promise<unknown>>(Promise.resolve());
  function store(task: () => Promise<unknown>) {
    const next = storageQueue.current.then(task);
    storageQueue.current = next.catch(() => {});
    return next;
  }
  async function logout() {
    const version = ++revision.current;
    storageClearPending.current = true;
    currentToken.current = null;
    const refreshToken = currentRefresh.current;
    currentRefresh.current = undefined;
    setToken(null); setUser(null); setLoading(true); setConnectionError('');
    try {
      await store(() => storage.remove());
      if (version === revision.current) storageClearPending.current = false;
    } catch {
      if (version === revision.current) setConnectionError('Không thể xóa phiên đăng nhập trên thiết bị. Hãy thử lại.');
    } finally {
      if (version === revision.current) setLoading(false);
    }
    if (refreshToken) void directApi('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => undefined);
  }
  async function saveSession(result: Session, version: number) {
    if (version !== revision.current) return false;
    const { token, refreshToken } = result;
    await store(() => version === revision.current ? storage.set(JSON.stringify({ token, refreshToken })) : Promise.resolve());
    if (version !== revision.current) return false;
    storageClearPending.current = false;
    currentToken.current = token;
    currentRefresh.current = refreshToken;
    setToken(token); setUser(result.user); setConnectionError('');
    return true;
  }
  useEffect(() => useSessionRefresh(async failedToken => {
    if (currentToken.current !== failedToken) return null;
    if (refreshing.current?.token === failedToken) return refreshing.current.promise;
    const refreshToken = currentRefresh.current;
    if (!refreshToken) return null;
    const version = revision.current;
    const promise = (async () => {
      try {
        const session = await directApi<Session>('/auth/refresh', { method: 'POST', body: { refreshToken } });
        if (await saveSession(session, version)) return session.token;
        if (session.refreshToken) void directApi('/auth/logout', { method: 'POST', body: { refreshToken: session.refreshToken } }).catch(() => undefined);
        return null;
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        if (version === revision.current) await logout();
        return null;
      } finally {
        if (refreshing.current?.token === failedToken) refreshing.current = undefined;
      }
    })();
    refreshing.current = { token: failedToken, promise };
    return promise;
  }), []);
  useEffect(() => {
    if (storageClearPending.current) {
      void logout();
      return;
    }
    let active = true;
    const version = revision.current;
    const valid = () => active && version === revision.current;
    setLoading(true); setConnectionError('');
    (async () => {
      try {
        const saved = await store(() => storage.get()) as string | null;
        if (saved) {
          // Versions before refresh tokens stored only the JWT.
          const pair: Tokens = saved.startsWith('{') ? JSON.parse(saved) : { token: saved };
          try {
            const me = await directApi<User>('/auth/me', { token: pair.token });
            if (valid()) {
              currentToken.current = pair.token; currentRefresh.current = pair.refreshToken;
              setToken(pair.token); setUser(me);
            }
          } catch (error) {
            if (!(error instanceof ApiError) || error.status !== 401 || !pair.refreshToken || !valid()) throw error;
            const session = await directApi<Session>('/auth/refresh', { method: 'POST', body: { refreshToken: pair.refreshToken } });
            if (valid()) await saveSession(session, version);
          }
        }
      } catch (error) {
        if (!valid()) return;
        if (error instanceof ApiError && error.status === 401) {
          currentToken.current = null; currentRefresh.current = undefined; setToken(null); setUser(null);
          try { await store(() => storage.remove()); }
          catch {
            if (valid()) {
              storageClearPending.current = true;
              setConnectionError('Không thể xóa phiên cũ trên thiết bị. Hãy thử lại.');
            }
          }
        } else setConnectionError(error instanceof Error ? error.message : 'Không thể khôi phục phiên đăng nhập.');
      } finally { if (valid()) setLoading(false); }
    })();
    return () => { active = false; };
  }, [attempt]);
  async function authenticate(path: string, body: unknown) {
    const version = ++revision.current;
    setLoading(false);
    const result = await directApi<Session>(path, { method: 'POST', body });
    if (!await saveSession(result, version)) throw new Error('Phiên đã thay đổi. Vui lòng đăng nhập lại.');
  }
  return <AuthContext.Provider value={{ user, token, loading, connectionError, retry: () => setAttempt(n => n + 1),
    login: (email, password) => authenticate('/auth/login', { email, password, supportsRefresh: true }),
    register: (name, email, password) => authenticate('/auth/register', { name, email, password, supportsRefresh: true }),
    logout,
    updateUser: edited => setUser(current => current?.id === edited.id ? edited : current),
    finishSocial: async (id, proof, ticket) => {
      const version = ++revision.current;
      const result = await directApi<Session>('/auth/social/complete', { method: 'POST', body: { id, proof, ticket } });
      if (!await saveSession(result, version)) throw new Error('Phiên đã thay đổi. Vui lòng đăng nhập lại.');
      return result.user;
    },
    expire: async failedToken => {
      if (!failedToken || failedToken !== currentToken.current) return;
      await logout();
    },
  }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const auth = useContext(AuthContext); if (!auth) throw new Error('AuthProvider missing'); return auth; }
