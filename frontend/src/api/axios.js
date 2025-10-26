// src/api/axios.js
import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE || "http://localhost:4000/api/v1";

const instance = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true, // required if you rely on cookie-based token for SSE or auth
});

instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("dcfs_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("dcfs_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default instance;
