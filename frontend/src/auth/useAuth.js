// src/auth/useAuth.js
import { useContext } from "react";
import { AuthContext } from "./AuthProvider";

/**
 * Hook wrapper for the AuthContext
 * Usage: const { token, user, login, logout, loading } = useAuth();
 */
export const useAuth = () => {
  return useContext(AuthContext);
};

export default useAuth;
