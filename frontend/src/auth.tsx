import {createContext, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
import {isRole, type Role} from './permissions';

type User = {id: string; email: string; name?: string; role: Role};
type AuthState = {status: 'loading' | 'authenticated' | 'unavailable'; user: User | null; source: 'api' | 'demo' | null};

const AuthContext = createContext<AuthState>({status: 'loading', user: null, source: null});

export function AuthProvider({children}: {children: ReactNode}) {
  const [state, setState] = useState<AuthState>({status: 'loading', user: null, source: null});

  useEffect(() => {
    const demoRole = import.meta.env.DEV && isRole(import.meta.env.VITE_DEMO_ROLE) ? import.meta.env.VITE_DEMO_ROLE : null;
    if (demoRole) {
      setState({status: 'authenticated', user: {id: 'local-demo', email: 'local@example.invalid', name: 'Local demo', role: demoRole}, source: 'demo'});
      return;
    }

    const controller = new AbortController();
    fetch('/api/auth/me', {credentials: 'include', signal: controller.signal})
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        const user = payload?.data;
        if (!response.ok || !user || !isRole(user.role)) throw new Error('Authentication is not available.');
        setState({status: 'authenticated', user, source: 'api'});
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({status: 'unavailable', user: null, source: null});
      });
    return () => controller.abort();
  }, []);

  const value = useMemo(() => state, [state]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
