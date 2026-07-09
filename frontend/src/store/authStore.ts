'use client';
import { create } from 'zustand';
import { authApi } from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  status: string;
  schoolName?: string;
  quotaLimit: number;
  imagesProcessed: number;
  totalJobs?: number;
  totalProcessed?: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isHydrated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isHydrated: false,

  hydrate: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('pp_token');
    const userStr = localStorage.getItem('pp_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ token, user, isHydrated: true });
      } catch {
        localStorage.removeItem('pp_token');
        localStorage.removeItem('pp_user');
        set({ isHydrated: true });
      }
    } else {
      set({ isHydrated: true });
    }
  },

  login: (token: string, user: User) => {
    localStorage.setItem('pp_token', token);
    localStorage.setItem('pp_user', JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem('pp_token');
    localStorage.removeItem('pp_user');
    set({ token: null, user: null });
  },

  refreshUser: async () => {
    try {
      const res = await authApi.me();
      const user = res.data;
      localStorage.setItem('pp_user', JSON.stringify(user));
      set({ user });
    } catch {
      get().logout();
    }
  },
}));
