import axios from 'axios';
import { supabase } from './supabase';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

apiClient.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) config.headers.Authorization = `Bearer ${session.access_token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => { if (error.response?.status === 401) window.location.href = '/login'; return Promise.reject(error); }
);

export default apiClient;