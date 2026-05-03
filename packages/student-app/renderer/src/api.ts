import axios from 'axios';
import type { StudentAttemptSummary, StudentExamPayload } from '@classroom/shared';

const STORAGE_KEY = 'classroom.tutor.session';

// Local type to avoid dependency issues
interface StoredSession {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    role: string;
    classroom_id: string;
  };
}

export class ApiClient {
  private rest: AxiosInstance;
  socket: Socket | null = null;

export async function markOnline(baseUrl: string, accessToken: string) {
  const { data } = await axios.post(
    `${baseUrl}/api/v1/me/online`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function getActiveExam(
  baseUrl: string,
  accessToken: string,
): Promise<{
  session_id: string;
  deadline_at: string;
  exam: StudentExamPayload;
} | null> {
  const { data } = await axios.get(`${baseUrl}/api/v1/me/active-exam`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function submitAttempt(
  baseUrl: string,
  accessToken: string,
  sessionId: string,
  answers: Record<string, string>,
): Promise<{ score: number | null }> {
  const { data } = await axios.post(
    `${baseUrl}/api/v1/me/attempts/${sessionId}/submit`,
    { answers },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
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
  }
}
