import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('nbi_token') || null);
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('nbi_user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = (newToken, newUser) => {
    localStorage.setItem('nbi_token', newToken);
    localStorage.setItem('nbi_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('nbi_token');
    localStorage.removeItem('nbi_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}