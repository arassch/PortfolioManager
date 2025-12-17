const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const STORAGE_KEY = 'pm_auth_session';

const readSession = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('Failed to parse auth session', err);
    return null;
  }
};

const writeSession = (session) => {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

const request = async (path, body) => {
  const csrf = getCsrfToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrf ? { 'x-csrf-token': csrf } : {})
    },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.data = data;
    throw err;
  }
  return data;
};

const requestWithAutoRefresh = async (path, body) => {
  try {
    return await request(path, body);
  } catch (err) {
    // If unauthorized, attempt refresh once and retry
    if (err.message && err.message.toLowerCase().includes('unauthorized')) {
      try {
        await refresh();
        return await request(path, body);
      } catch (inner) {
        throw inner;
      }
    }
    throw err;
  }
};

const login = async (email, password) => {
  const session = await request('/api/auth/login', { email, password });
  writeSession({ user: session.user, csrfToken: session.csrfToken });
  return session;
};

const register = async (email, password) => {
  const session = await request('/api/auth/register', { email, password });
  if (session.user) {
    writeSession({ user: session.user, csrfToken: session.csrfToken });
  } else {
    writeSession(null);
  }
  return session;
};

const refresh = async () => {
  const session = await request('/api/auth/refresh', {});
  writeSession({ user: session.user, csrfToken: session.csrfToken });
  return session;
};

const logout = async () => {
  try {
    await request('/api/auth/logout', {});
  } catch (err) {
    // ignore client-side logout failures
  }
  writeSession(null);
};

const requestPasswordReset = async (email) => {
  return request('/api/auth/reset/request', { email });
};

const confirmPasswordReset = async (token, password) => {
  return request('/api/auth/reset/confirm', { token, password });
};

const deleteAccount = async () => {
  const csrf = getCsrfToken();
  const res = await fetch(`${API_URL}/api/user`, {
    method: 'DELETE',
    headers: {
      ...(csrf ? { 'x-csrf-token': csrf } : {})
    },
    credentials: 'include'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete account');
  }
  writeSession(null);
  return data;
};

const getSession = () => readSession();
const getUser = () => getSession()?.user || null;
const getCsrfToken = () => getSession()?.csrfToken || null;

const verifyEmail = async (token) => {
  const session = await request('/api/auth/verify', { token });
  writeSession({ user: session.user, csrfToken: session.csrfToken });
  return session;
};

const resendVerification = async (email) => {
  return request('/api/auth/verify/resend', { email });
};

export default {
  requestWithAutoRefresh,
  login,
  register,
  refresh,
  logout,
  requestPasswordReset,
  confirmPasswordReset,
  deleteAccount,
  verifyEmail,
  resendVerification,
  getSession,
  getUser,
  getCsrfToken
};
