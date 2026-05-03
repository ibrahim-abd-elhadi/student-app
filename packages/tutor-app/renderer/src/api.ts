import axios from 'axios';

// Local type definitions to avoid @classroom/shared dependency
export interface StudentAttemptSummary {
  attempt_id: string;
  exam_id: string;
  exam_title: string;
  state: 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED' | 'CANCELLED';
  score: number | null;
  total_points: number | null;
  started_at: string | null;
  submitted_at: string | null;
  created_at: string;
}

export type AttemptState = StudentAttemptSummary['state'];

    this.socket = io(this.baseUrl, {
      path: '/ws',
      transports: ['websocket'],
      auth: { token: s.access_token },
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
    });

    // Log success or failure
    this.socket.on('connect', () => {
      console.log('✅ Tutor socket connected');
    });

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