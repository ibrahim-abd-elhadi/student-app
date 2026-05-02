import axios, { AxiosInstance, AxiosError } from 'axios';
import { io, Socket } from 'socket.io-client';

const STORAGE_KEY = 'classroom.tutor.session';

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

  constructor(public baseUrl: string) {
    this.rest = axios.create({ baseURL: `${baseUrl}/api/v1` });
    this.rest.interceptors.request.use((cfg) => {
      const s = this.session;
      if (s) cfg.headers.Authorization = `Bearer ${s.access_token}`;
      return cfg;
    });
    this.rest.interceptors.response.use(
      (r) => r,
      async (err: AxiosError) => {
        if (err.response?.status === 401 && this.session) {
          try {
            await this.refresh();
            const cfg = err.config!;
            cfg.headers!.Authorization = `Bearer ${this.session!.access_token}`;
            return this.rest.request(cfg);
          } catch {
            this.logout();
          }
        }
        throw err;
      },
    );
  }

  get session(): StoredSession | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  }

  private setSession(s: StoredSession | null) {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  }

  async login(username: string, password: string): Promise<StoredSession> {
    const { data } = await this.rest.post('/auth/login', { username, password });
    this.setSession(data);
    return data;
  }

  async refresh(): Promise<void> {
    const s = this.session;
    if (!s) throw new Error('no_session');
    const { data } = await axios.post(`${this.baseUrl}/api/v1/auth/refresh`, {
      refresh_token: s.refresh_token,
    });
    this.setSession(data);
  }

  logout(): void {
    const s = this.session;
    if (s) {
      axios
        .post(`${this.baseUrl}/api/v1/auth/logout`, { refresh_token: s.refresh_token })
        .catch(() => undefined);
    }
    this.setSession(null);
    this.socket?.disconnect();
    this.socket = null;
  }

  /* ----- Domain ----- */
  listStudents(classroomId: string) {
    return this.rest.get(`/classrooms/${classroomId}/students`).then((r) => r.data);
  }
  listExams() { return this.rest.get('/exams').then((r) => r.data); }
  getExam(id: string) { return this.rest.get(`/exams/${id}`).then((r) => r.data); }
  createSession(body: { exam_id: string; student_ids: string[]; duration_minutes: number }) {
    return this.rest.post('/sessions', body).then((r) => r.data);
  }
  startSession(id: string) { return this.rest.post(`/sessions/${id}/start`).then((r) => r.data); }
  stopSession(id: string) { return this.rest.post(`/sessions/${id}/stop`).then((r) => r.data); }
  getSession(id: string) { return this.rest.get(`/sessions/${id}`).then((r) => r.data); }
  getReport(id: string) { return this.rest.get(`/sessions/${id}/report.json`).then((r) => r.data); }
  getReportHtml(id: string) {
    return this.rest.get(`/sessions/${id}/report.html`, { responseType: 'text' }).then((r) => r.data as string);
  }

  /* ----- Realtime ----- */
  connectSocket(): Socket {
    const s = this.session;
    if (!s) throw new Error('no_session');
    if (this.socket?.connected) return this.socket;
    this.socket = io(this.baseUrl, {
      namespace: '/ws',
      transports: ['websocket'],
      auth: { token: s.access_token },
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
    });
    this.socket.on('connect', () => console.debug('[tutor] socket connected'));
    this.socket.on('disconnect', (reason) => console.warn('[tutor] socket disconnected', reason));
    this.socket.on('connect_error', (err) => console.error('[tutor] socket connect_error', err));
    return this.socket;
  }
}

export const api = new ApiClient(
  (import.meta as any).env?.VITE_BACKEND_URL ?? 'http://127.0.0.1:8080',
);
