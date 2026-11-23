import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Send session cookies on all requests
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If unauthorized, could notify or redirect
    return Promise.reject(error);
  }
);
