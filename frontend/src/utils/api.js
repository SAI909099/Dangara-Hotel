import axios from "axios";

/**
 * Markaziy API client.
 * - baseURL: REACT_APP_BACKEND_URL + /api (masalan: http://localhost:8000/api)
 * - Token: localStorage key = "token" -> Authorization: Bearer <token>
 * - 401 bo‘lsa token o‘chiriladi va /login ga yo‘naltiriladi.
 *
 * MUHIM:
 * - Agar .env da REACT_APP_BACKEND_URL ni xato qilib ".../api" qilib qo‘ysangiz ham,
 *   bu fayl avtomatik to‘g‘rilaydi ("/api/api" bo‘lib ketmaydi).
 */

// 1) read backend
const rawBackend = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

// 2) normalize (remove trailing slashes)
let backend = String(rawBackend).trim().replace(/\/+$/, "");

// 3) if user mistakenly already included /api at end, remove it
backend = backend.replace(/\/api$/i, "");

// 4) final baseURL is always ".../api"
const baseURL = `${backend}/api`;

const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor: token qo‘shish
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: 401 bo‘lsa login sahifaga qaytarish
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;

    if (status === 401) {
      localStorage.removeItem("token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(err);
  }
);

export default api;
