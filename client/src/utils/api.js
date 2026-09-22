import axios from 'axios';
import { auth } from '../firebase.js';

/**
 * Authenticated Axios instance for KiranaPilot.
 * Automatically attaches Firebase ID token to all requests.
 */
const api = axios.create();

// Request interceptor — attach Firebase token
api.interceptors.request.use(
  async (config) => {
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('[api] Could not get Firebase token:', err.message);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — Firebase will auto-refresh, but if
      // the user is truly logged out, the AuthContext will handle redirect.
      console.warn('[api] Received 401 — authentication required.');
    }
    return Promise.reject(error);
  }
);

export default api;
