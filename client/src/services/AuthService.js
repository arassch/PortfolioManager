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
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
};

const login = async (email, password) => {
  const session = await request('/api/auth/login', { email, password });
  writeSession({ user: session.user, csrfToken: session.csrfToken });
  return session;
};

const register = async (email, password) => {
  const session = await request('/api/auth/register', { email, password });
  writeSession({ user: session.user, csrfToken: session.csrfToken });
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

const getSession = () => readSession();
const getUser = () => getSession()?.user || null;
const getCsrfToken = () => getSession()?.csrfToken || null;

export default {
  login,
  register,
  refresh,
  logout,
  getSession,
  getUser,
  getCsrfToken
};
