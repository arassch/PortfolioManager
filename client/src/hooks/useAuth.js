import { useEffect, useState } from 'react';
import AuthService from '../services/AuthService';

export function useAuth() {
  const [session, setSession] = useState(() => AuthService.getSession());
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Keep session in sync (e.g., across tabs)
    const handler = () => setSession(AuthService.getSession());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const perform = async (fn, email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const nextSession = await fn(email, password);
      setSession({ user: nextSession.user, csrfToken: nextSession.csrfToken });
      return nextSession;
    } catch (err) {
      setError(err.message || 'Authentication failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const login = (email, password) => perform(AuthService.login, email, password);
  const register = (email, password) => perform(AuthService.register, email, password);
  const logout = async () => {
    await AuthService.logout();
    setSession(null);
  };

  return {
    user: session?.user || null,
    csrfToken: session?.csrfToken || null,
    error,
    isLoading,
    login,
    register,
    logout
  };
}
