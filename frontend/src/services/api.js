import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_URL
});

api.interceptors.request.use((config) => {
  try {
    const stored = localStorage.getItem("token");
    const token = stored && stored !== "undefined" ? stored : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // Ignore
  }
  return config;
});

export default api;