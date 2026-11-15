import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError } from '../lib/api';
import {
  clearStoredAuth,
  getStoredAuth,
  setStoredAuth,
} from '../lib/storage';
import type { PublicUser } from '../types';

interface AuthContextValue {
  user: PublicUser | null;
  token: string | null;
  ready: boolean;
  isGuest: boolean;
  login: (email: string, password: string) => Promise<PublicUser>;
  register: (name: string, email: string, password: string) => Promise<PublicUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [stored] = useState(() => getStoredAuth());
  const [user, setUser] = useState<PublicUser | null>(stored?.user ?? null);
  const [token, setToken] = useState<string | null>(stored?.token ?? null);
  const [ready, setReady] = useState(!stored);

  useEffect(() => {
    if (!stored?.token) return;
    const controller = new AbortController();
    let active = true;

    api
      .me(controller.signal)
      .then(({ user: freshUser }) => {
        if (!active) return;
        setUser(freshUser);
        setStoredAuth({ token: stored.token, user: freshUser });
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          clearStoredAuth();
          setUser(null);
          setToken(null);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // Session verification should only run once on app boot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login({ email, password });
    setStoredAuth(response);
    setUser(response.user);
    setToken(response.token);
    return response.user;
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const response = await api.register({ name, email, password });
      setStoredAuth(response);
      setUser(response.user);
      setToken(response.token);
      return response.user;
    },
    [],
  );

  const logout = useCallback(() => {
    clearStoredAuth();
    setUser(null);
    setToken(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      ready,
      isGuest: !user,
      login,
      register,
      logout,
    }),
    [user, token, ready, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
