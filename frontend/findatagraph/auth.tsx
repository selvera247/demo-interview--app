import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, type FdgUser } from "./mockApi";

type AuthCtx = {
  token: string | null;
  user: FdgUser | null;
  booting: boolean;
  login: (email: string, password: string) => Promise<FdgUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx | null>(null);
const STORAGE_KEY = "findatagraph_session_embedded";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<FdgUser | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setBooting(false);
      return;
    }
    try {
      const saved = JSON.parse(raw) as { token: string; user: FdgUser };
      setToken(saved.token);
      setUser(saved.user);
      api("/auth/me", { token: saved.token })
        .then((res) => setUser((res as { user: FdgUser }).user))
        .catch(() => {
          localStorage.removeItem(STORAGE_KEY);
          setToken(null);
          setUser(null);
        })
        .finally(() => setBooting(false));
    } catch {
      setBooting(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = (await api("/auth/login", {
      method: "POST",
      body: { email, password },
    })) as { token: string; user: FdgUser };
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(res));
    return res.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ token, user, booting, login, logout }),
    [token, user, booting, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
