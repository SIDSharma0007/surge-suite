import axios from 'axios';

// Get the base API URL from environment variables, defaulting to local Django API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

// Helper to retrieve the auth token (returns null for now, change this line to add auth token later)
const getAuthToken = () => null; // e.g., () => localStorage.getItem('token');

// Create a configured axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

/**
 * Request Interceptor
 * 
 * Automatically attaches the Auth token if it exists.
 * When authentication is added to the application, you only need to modify 
 * the getAuthToken helper function above.
 */
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 * 
 * Centralized error handling (e.g., redirect on 401 Unauthorized, log errors).
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle specific global response errors here
    if (error.response) {
      if (error.response.status === 401) {
        // Future Auth cleanup: e.g., redirect to login, clear token
        console.warn('Unauthorized request - redirecting or clearing auth status');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
