import { api } from './api';
import type { User, ApiResponse } from '../types/auth';

export const authService = {
  async login(email: string, password: string): Promise<User> {
    const res = await api.post<ApiResponse<{ user: User }>>('/auth/login', { email, password });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Login failed');
    }
    return res.data.data.user;
  },

  async logout(): Promise<void> {
    await api.post<ApiResponse<{ message: string }>>('/auth/logout');
  },

  async getMe(): Promise<User> {
    const res = await api.get<ApiResponse<{ user: User }>>('/auth/me');
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.error?.message || 'Failed to fetch session');
    }
    return res.data.data.user;
  },
};
