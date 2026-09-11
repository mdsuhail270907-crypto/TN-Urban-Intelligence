import type { ApiResponse, Bus, Route, Telemetry, AIAnalysis, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const buildUrl = (path: string) => `${API_BASE_URL}${path}`;

const getToken = () => localStorage.getItem('urban-command-center-token');

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const token = getToken();

  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const result = await response.json();

  if (!response.ok) {
    const message = result?.error?.message || 'Request failed';
    throw new Error(message);
  }

  return result as T;
};

export const authApi = {
  login: (email: string, password: string) =>
    request<ApiResponse<{ user: User; token: string }>>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
  me: () => request<ApiResponse<User>>('/api/auth/me')
};

export const busesApi = {
  list: () => request<ApiResponse<{ buses: Bus[]; pagination: any }>>('/api/buses?limit=100'),
  get: (id: string) => request<ApiResponse<Bus>>(`/api/buses/${id}`),
  latestTelemetry: (id: string) => request<ApiResponse<Telemetry>>(`/api/telemetry/bus/${id}/latest`),
  historyTelemetry: (id: string, limit = 50) =>
    request<ApiResponse<{ telemetry: Telemetry[]; pagination: any }>>(`/api/telemetry/bus/${id}?limit=${limit}`)
};

export const routesApi = {
  list: () => request<ApiResponse<{ routes: Route[]; pagination: any }>>('/api/routes?limit=100'),
  get: (id: string) => request<ApiResponse<Route>>(`/api/routes/${id}`)
};

export const aiApi = {
  latest: (busId: string) => request<ApiResponse<AIAnalysis>>(`/api/ai/bus/${busId}`),
  history: (busId: string, limit = 10) =>
    request<ApiResponse<{ analyses: AIAnalysis[]; pagination: any }>>(`/api/ai/bus/${busId}/history?limit=${limit}`),
  analyze: (busId: string) =>
    request<ApiResponse<AIAnalysis>>(`/api/ai/analyze/${busId}`, {
      method: 'POST'
    })
};

export const healthApi = {
  get: () => request<{ success: boolean; data: any }>(`/health`)
};
