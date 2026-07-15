import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('pp_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiry globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (!path.startsWith('/login') && !path.startsWith('/register')) {
        localStorage.removeItem('pp_token');
        localStorage.removeItem('pp_user');
        window.location.href = '/login?expired=1';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: any) => api.post('/api/auth/register', data),
  login: (email: string, password: string) => api.post('/api/auth/login', { email, password }),
  me: () => api.get('/api/auth/me'),
  changePassword: (data: any) => api.put('/api/auth/change-password', data),
};

// ─── Upload ───────────────────────────────────────────────────────────────────
export const uploadApi = {
  batch: (files: File[], settings?: any, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    files.forEach((f) => form.append('images', f));
    if (settings) {
      if (settings.width) form.append('targetWidth', settings.width);
      if (settings.height) form.append('targetHeight', settings.height);
      if (settings.sizeKb) form.append('targetSizeKb', settings.sizeKb);
    }
    return api.post('/api/upload/batch', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) {
          onProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      },
    });
  },
  jobs: (page = 1) => api.get(`/api/upload/jobs?page=${page}`),
  jobStatus: (id: string) => api.get(`/api/upload/job/${id}`),
  downloadUrl: (id: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('pp_token') : null;
    return `${API_URL}/api/upload/download/${id}${token ? '?token=' + token : ''}`;
  },
  guestUpload: (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.post('/api/upload/guest', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: 'blob',
      timeout: 60000,
    });
  },
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  stats: () => api.get('/api/admin/stats'),
  users: (params?: any) => api.get('/api/admin/users', { params }),
  approveUser: (id: string, data: { quotaLimit: number, sendEmail?: boolean }) => api.patch(`/api/admin/users/${id}/approve`, data),
  suspendUser: (id: string, reason: string) => api.patch(`/api/admin/users/${id}/suspend`, { reason }),
  reactivateUser: (id: string) => api.patch(`/api/admin/users/${id}/reactivate`),
  updateQuota: (id: string, quotaLimit: number) => api.patch(`/api/admin/users/${id}/quota`, { quotaLimit }),
  updateRole: (id: string, role: string) => api.patch(`/api/admin/users/${id}/role`, { role }),
  updatePassword: (id: string, password: string) => api.patch(`/api/admin/users/${id}/password`, { password }),
  jobs: (params?: any) => api.get('/api/admin/jobs', { params }),
};
