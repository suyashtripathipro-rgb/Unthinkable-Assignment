import { createContext, useContext, useEffect, useState } from 'react';
import client from './client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('bts_token');
    const savedUser = localStorage.getItem('bts_user');
    if (token && savedUser) setUser(JSON.parse(savedUser));
    setReady(true);
  }, []);

  async function login(email, password) {
    const { data } = await client.post('/auth/login', { email, password });
    localStorage.setItem('bts_token', data.token);
    localStorage.setItem('bts_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  async function register(payload) {
    const { data } = await client.post('/auth/register', payload);
    localStorage.setItem('bts_token', data.token);
    localStorage.setItem('bts_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('bts_token');
    localStorage.removeItem('bts_user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
