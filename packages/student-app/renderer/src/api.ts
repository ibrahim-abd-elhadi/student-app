import axios from 'axios';
import type { StudentAttemptSummary } from '@classroom/shared';

export async function login(baseUrl: string, username: string, password: string) {
  const { data } = await axios.post(`${baseUrl}/api/v1/auth/login`, { username, password });
  return data;
}

export async function refreshToken(baseUrl: string, refresh_token: string) {
  const { data } = await axios.post(`${baseUrl}/api/v1/auth/refresh`, { refresh_token });
  return data;
}

export async function listMyAttempts(
  baseUrl: string,
  accessToken: string,
): Promise<StudentAttemptSummary[]> {
  const { data } = await axios.get(`${baseUrl}/api/v1/me/attempts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export function decodeJwt(token: string): { exp?: number } | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}