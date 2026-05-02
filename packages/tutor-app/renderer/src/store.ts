import { create } from 'zustand';
import type { ExamSummary, SessionDto, AttemptDto } from '@classroom/shared';

export interface RosterStudent {
  id: string;
  username: string;
  display_name: string;
  online: boolean;
  last_seen_at: string | null;
  locked?: boolean;
  suspicious?: boolean;
}

export type View = 'login' | 'dashboard' | 'launch' | 'monitor' | 'report';

interface AppState {
  view: View;
  user: { id: string; display_name: string; classroom_id: string } | null;

  roster: RosterStudent[];
  selectedStudentIds: Set<string>;

  exams: ExamSummary[];
  activeSession: SessionDto | null;
  activeExam: ExamSummary | null;
  attempts: Record<string, AttemptDto>; // keyed by student_id
  totalQuestions: number;

  setView: (v: View) => void;
  setUser: (u: AppState['user']) => void;
  setRoster: (r: RosterStudent[]) => void;
  toggleStudent: (id: string) => void;
  clearSelection: () => void;
  selectAllOnline: () => void;
  upsertPresence: (id: string, online: boolean, last_seen_at: string | null) => void;
  upsertStudentState: (id: string, patch: Partial<RosterStudent>) => void;

  setExams: (e: ExamSummary[]) => void;
  startActive: (s: SessionDto, exam: ExamSummary, attempts: AttemptDto[], total: number) => void;
  applyProgress: (student_id: string, answered_count: number) => void;
  applySubmitted: (student_id: string, score: number | null, submitted_at: string) => void;
  closeActive: () => void;
}

export const useApp = create<AppState>((set, get) => ({
  view: 'login',
  user: null,
  roster: [],
  selectedStudentIds: new Set(),
  exams: [],
  activeSession: null,
  activeExam: null,
  attempts: {},
  totalQuestions: 0,

  setView: (v) => set({ view: v }),
  setUser: (u) => set({ user: u }),
  setRoster: (r) => set({ roster: r }),

  toggleStudent: (id) => {
    const next = new Set(get().selectedStudentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ selectedStudentIds: next });
  },
  clearSelection: () => set({ selectedStudentIds: new Set() }),
  selectAllOnline: () =>
    set({
      selectedStudentIds: new Set(
        get().roster.filter((s) => s.online).map((s) => s.id),
      ),
    }),

  upsertPresence: (id, online, last_seen_at) =>
    set({
      roster: get().roster.map((s) =>
        s.id === id ? { ...s, online, last_seen_at } : s,
      ),
    }),

  upsertStudentState: (id, patch) =>
    set({
      roster: get().roster.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }),

  setExams: (e) => set({ exams: e }),

  startActive: (s, exam, attempts, total) =>
    set({
      activeSession: s,
      activeExam: exam,
      attempts: Object.fromEntries(attempts.map((a) => [a.student_id, a])),
      totalQuestions: total,
      view: 'monitor',
    }),

  applyProgress: (student_id, answered_count) => {
    const next = { ...get().attempts };
    if (next[student_id]) {
      next[student_id] = {
        ...next[student_id],
        answered_count,
        state:
          next[student_id].state === 'ASSIGNED' ? 'IN_PROGRESS' : next[student_id].state,
      };
    }
    set({ attempts: next });
  },

  applySubmitted: (student_id, score, submitted_at) => {
    const next = { ...get().attempts };
    if (next[student_id]) {
      next[student_id] = {
        ...next[student_id],
        score,
        submitted_at,
        state: 'SUBMITTED',
      };
    }
    set({ attempts: next });
  },

  closeActive: () => {
    const s = get().activeSession;
    if (!s) return;
    set({
      activeSession: { ...s, state: 'CLOSED', closed_at: new Date().toISOString() },
      view: 'report',
    });
  },
}));
