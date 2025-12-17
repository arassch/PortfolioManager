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
      if (nextSession?.user) {
        setSession({ user: nextSession.user, csrfToken: nextSession.csrfToken });
      } else {
        setSession(null);
      }
      return nextSession;
    } catch (err) {
      setSession(null);
      setError(err.message || 'Authentication failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const login = (email, password) => perform(AuthService.login, email, password);
  const register = (email, password) => perform(AuthService.register, email, password);

  const requestPasswordReset = async (email) => {
    setIsLoading(true);
    setError(null);
    try {
      return await AuthService.requestPasswordReset(email);
    } catch (err) {
      setError(err.message || 'Request failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const confirmPasswordReset = async (token, password) => {
    setIsLoading(true);
    setError(null);
    try {
      return await AuthService.confirmPasswordReset(token, password);
    } catch (err) {
      setError(err.message || 'Reset failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAccount = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await AuthService.deleteAccount();
      setSession(null);
    } catch (err) {
      setError(err.message || 'Delete failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await AuthService.logout();
    setSession(null);
  };
  const verifyEmail = async (token) => {
    setIsLoading(true);
    setError(null);
    try {
      const sessionData = await AuthService.verifyEmail(token);
      setSession({ user: sessionData.user, csrfToken: sessionData.csrfToken });
      return sessionData;
    } catch (err) {
      setError(err.message || 'Verification failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerification = async (email) => {
    setIsLoading(true);
    setError(null);
    try {
      return await AuthService.resendVerification(email);
    } catch (err) {
      setError(err.message || 'Request failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    user: session?.user || null,
    csrfToken: session?.csrfToken || null,
    error,
    isLoading,
    login,
    register,
    requestPasswordReset,
    confirmPasswordReset,
    deleteAccount,
    logout,
    verifyEmail,
    resendVerification
  };
}
