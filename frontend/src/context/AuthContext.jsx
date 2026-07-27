import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('surge_session');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("[AuthContext] Failed to parse auth session from localStorage:", e);
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const login = (user) => {
    if (!user) return;
    
    // Save minimum non-sensitive user details
    const sessionUser = {
      user_id: user.user_id || user.id,
      name: user.name
    };
    
    setCurrentUser(sessionUser);
    localStorage.setItem('surge_session', JSON.stringify(sessionUser));
    
    // Save first name for dashboard UI compatibility
    const firstName = user.name ? user.name.split(' ')[0] : 'Guest';
    localStorage.setItem('firstName', firstName);
    
    console.log("[AuthContext] User session started:", sessionUser);
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('surge_session');
    localStorage.removeItem('firstName');
    console.log("[AuthContext] User session cleared.");
  };

  const isAuthenticated = !!currentUser;

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
