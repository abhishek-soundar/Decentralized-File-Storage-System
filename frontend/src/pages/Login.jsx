// src/pages/Login.jsx
"use client";

import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import axios from "../api/axios";
import Card from "../components/Card";

export default function Login({ onNavigate }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      const payload = isLogin ? { email, password } : { name, email, password };

      const response = await axios.post(endpoint, payload);
      // support different response shapes
      const token =
        response?.data?.token ||
        response?.data?.data?.token ||
        response?.data?.accessToken ||
        response?.data?.result?.token;

      if (token) {
        await login(token);
        // navigate to dashboard (parent handler)
        onNavigate && onNavigate("dashboard");
      } else {
        setError("No token received from server");
      }
    } catch (err) {
      // resilient extraction of server message
      const status = err?.response?.status;
      const body = err?.response?.data;

      const serverMsg =
        body?.error?.message ||
        body?.error ||
        body?.message ||
        (typeof body === "string" ? body : null);

      if (status === 409) {
        // user already exists — show message and switch to login tab
        setError(serverMsg || "An account with that email already exists. Please login.");
        setIsLogin(true);
      } else {
        setError(serverMsg || err.message || "Authentication failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <h1 className="app-card-header text-2xl font-bold mb-1">Welcome</h1>
        <p className="app-card-subtitle text-sm text-gray-500 mb-6">Sign in or create your account</p>

        <div className="flex gap-3 mb-8">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError("");
            }}
            className={`tab-button ${isLogin ? "active" : "inactive"} px-4 py-2 rounded-lg`}
          >
            👤 Login
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError("");
            }}
            className={`tab-button ${!isLogin ? "active" : "inactive"} px-4 py-2 rounded-lg`}
          >
            👥 Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="app-input w-full rounded-lg border px-3 py-2"
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="app-input w-full rounded-lg border px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="app-input w-full rounded-lg border px-3 py-2"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed py-3"
          >
            {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>
      </Card>
    </div>
  );
}
