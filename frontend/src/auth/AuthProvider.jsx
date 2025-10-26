// src/auth/AuthProvider.jsx
"use client";

import React, { createContext, useState, useEffect } from "react";
import api from "../api/axios";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("dcfs_token");
    if (storedToken) {
      setToken(storedToken);
      // convenience cookie for SSE in dev
      try {
        document.cookie = `token=${storedToken}; path=/`;
      } catch (e) {}
      (async () => {
        try {
          const res = await api.get("/auth/me");
          setUser(res.data.user || null);
        } catch (e) {
          setUser(null);
        } finally {
          setLoading(false);
        }
      })();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (newToken) => {
    localStorage.setItem("dcfs_token", newToken);
    setToken(newToken);

    try {
      document.cookie = `token=${newToken}; path=/`;
    } catch (e) {}

    try {
      const res = await api.get("/auth/me");
      setUser(res.data.user || {});
    } catch (e) {
      setUser({});
    }
  };

  const logout = () => {
    localStorage.removeItem("dcfs_token");
    setToken(null);
    setUser(null);
    try {
      document.cookie = `token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    } catch (e) {}
    // optionally redirect caller
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
