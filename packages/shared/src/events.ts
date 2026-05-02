import type {
  AttemptState,
  PresenceEntry,
  SessionState,
  StudentExamPayload,
} from './types';

/* ---------- Tutor → Server ---------- */
export interface ClientToServerTutorEvents {
  'session:start': (
    p: { session_id: string },
    ack: (r: AckOk<{ started_at: string; deadline_at: string }> | AckErr) => void,
  ) => void;
  'session:stop': (
    p: { session_id: string },
    ack: (r: AckOk | AckErr) => void,
  ) => void;
  'student:lock': (
    p: { student_ids: string[]; message?: string },
    ack: (r: AckOk<{ dispatched: number }> | AckErr) => void,
  ) => void;
  'student:unlock': (
    p: { student_ids: string[] },
    ack: (r: AckOk<{ dispatched: number }> | AckErr) => void,
  ) => void;
}

/* ---------- Student → Server ---------- */
export interface ClientToServerStudentEvents {
  'exam:started': (
    p: { session_id: string },
    ack: (r: AckOk | AckErr) => void,
  ) => void;
  'answer:upsert': (
    p: {
      session_id: string;
      question_id: string;
      choice_id: string;
      client_seq: number;
    },
    ack: (
      r: AckOk<{ server_seq: number; answered_count: number }> | AckErr,
    ) => void,
  ) => void;
  'exam:submit': (
    p: { session_id: string },
    ack: (r: AckOk<{ score: number | null }> | AckErr) => void,
  ) => void;
  'attempt:resync': (
    p: { session_id: string; last_client_seq: number },
    ack: (
      r:
        | AckOk<{
            state: AttemptState;
            accepted_seq: number;
            deadline_at: string | null;
            answers: Record<string, string>;
          }>
        | AckErr,
    ) => void,
  ) => void;
  'state:report': (
    p: { active_window?: string; locked: boolean; suspicious?: boolean },
    ack: (r: AckOk | AckErr) => void,
  ) => void;
}

/* ---------- Server → Tutor ---------- */
export interface ServerToTutorEvents {
  'presence:update': (p: PresenceEntry) => void;
  'attempt:progress': (p: {
    session_id: string;
    student_id: string;
    answered_count: number;
  }) => void;
  'attempt:submitted': (p: {
    session_id: string;
    student_id: string;
    score: number | null;
    submitted_at: string;
  }) => void;
  'session:closed': (p: {
    session_id: string;
    reason: 'TUTOR_STOP' | 'DEADLINE' | 'ALL_SUBMITTED';
    state: SessionState;
  }) => void;
  'student:state': (p: {
    student_id: string;
    locked: boolean;
    active_window?: string;
    suspicious?: boolean;
  }) => void;
}

/* ---------- Server → Student ---------- */
export interface ServerToStudentEvents {
  'lock:apply': (p: { message?: string }) => void;
  'lock:release': (p: Record<string, never>) => void;
  'exam:assigned': (p: {
    session_id: string;
    exam: StudentExamPayload;
    deadline_at: string;
  }) => void;
  'exam:cancelled': (p: { session_id: string; reason: string }) => void;
  'exam:closed': (p: { session_id: string; reason: string }) => void;
}

export type AckOk<T = Record<string, never>> = { ok: true } & T;
export type AckErr = { ok: false; error: string };
