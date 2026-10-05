import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  // If a token was saved earlier, fetch the logged-in user
  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const handleAuth = ({ token, user }) => {
    setToken(token);
    setUser(user);
    return user;
  };

  const value = {
    user,
    loading,
    login: (email, password) => api('/auth/login', { method: 'POST', body: { email, password } }).then(handleAuth),
    register: (data) => api('/auth/register', { method: 'POST', body: data }).then(handleAuth),
    logout: () => { setToken(null); setUser(null); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
