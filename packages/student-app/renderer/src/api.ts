import axios, { AxiosInstance, AxiosError } from 'axios';
import { io, Socket } from 'socket.io-client';

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
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      return null;
    }
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
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Domain methods
  listStudents(classroomId: string) {
    return this.rest.get(`/classrooms/${classroomId}/students`).then((r) => r.data);
  }
  listExams() { return this.rest.get('/exams').then((r) => r.data); }
  getExam(id: string) { return this.rest.get(`/exams/${id}`).then((r) => r.data); }
  createSession(body: { exam_id: string; student_ids: string