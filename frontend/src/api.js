import axios from 'axios';

const api = axios.create({
  baseURL: 'https://sanfelipe-profiling-system-production.up.railway.app', // Your FastAPI URL
});

api.interceptors.request.use(
  (config) => {
    // 1. Grab token from storage
    const token = localStorage.getItem('token');
    
    // 2. If token exists, attach it to the header
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// INTERCEPTOR: Runs when we get a response
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the backend says "401 Unauthorized" (Token expired or fake)
    if (error.response && error.response.status === 401) {
      localStorage.clear(); // Delete the bad token
      window.location.href = '/login'; // Force them back to login
    }
    return Promise.reject(error);
  }
);

export default api;