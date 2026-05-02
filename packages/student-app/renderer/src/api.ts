import axios from 'axios';
import type { StudentAttemptSummary } from '@classroom/shared';

export async function login(baseUrl: string, username: string, password: string) {
  const { data } = await axios.post(`${baseUrl}/api/v1/auth/login`, { username, password });
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
