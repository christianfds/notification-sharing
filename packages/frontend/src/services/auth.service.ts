import api, { setAccessToken } from './api';
import type { LoginRequest, LoginResponse } from '../types';

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', credentials);
  setAccessToken(data.accessToken);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

export async function refresh(): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/refresh');
  setAccessToken(data.accessToken);
  return data;
}
