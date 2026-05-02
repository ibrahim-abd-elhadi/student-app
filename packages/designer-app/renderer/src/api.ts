import axios, { AxiosInstance } from 'axios';

const STORAGE_KEY = 'classroom.designer.session';

interface StoredSession {
  base_url: string;
  access_token: string;
  refresh_token: string;
  user: { id: string; display_name: string; classroom_id: string; role: string };
}

export class ApiClient {
  rest!: AxiosInstance;

  get session(): StoredSession | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  }
  setSession(s: StoredSession | null) {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
    this.bind();
  }

  bind() {
    const s = this.session;
    this.rest = axios.create({
      baseURL: `${s?.base_url ?? 'http://127.0.0.1:8080'}/api/v1`,
      headers: s ? { Authorization: `Bearer ${s.access_token}` } : {},
    });
  }

  constructor() { this.bind(); }

  async login(baseUrl: string, username: string, password: string) {
    const { data } = await axios.post(`${baseUrl}/api/v1/auth/login`, { username, password });
    this.setSession({ base_url: baseUrl, ...data });
    return data;
  }
  logout() { this.setSession(null); }

  listExams() { return this.rest.get('/exams').then((r) => r.data); }
  getExam(id: string) { return this.rest.get(`/exams/${id}`).then((r) => r.data); }
  createExam(body: any) { return this.rest.post('/exams', body).then((r) => r.data); }
  updateExam(id: string, body: any) { return this.rest.put(`/exams/${id}`, body).then((r) => r.data); }
  deleteExam(id: string) { return this.rest.delete(`/exams/${id}`).then((r) => r.data); }
  replaceQuestions(id: string, questions: any[]) {
    return this.rest.put(`/exams/${id}/questions`, { questions }).then((r) => r.data);
  }
}

export const api = new ApiClient();
