import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { io, Socket } from 'socket.io-client';
import './styles.css';

interface ExamPayload {
  session_id: string;
  deadline_at: string;
  exam: {
    id: string;
    title: string;
    shuffle: boolean;
    questions: Array<{
      id: string;
      ordinal: number;
      prompt: string;
      choices: { id: string; text: string }[];
      points: number;
    }>;
  };
}

interface PersistedAttempt {
  session_id: string;
  exam_id: string;
  deadline_at: string;
  answers: Record<string, string>;
  client_seq: number;
  exam_payload: ExamPayload['exam'];
}

const STORAGE_KEY = 'classroom.student.attempt';
const PENDING_KEY = 'classroom.student.pending';

interface PendingAnswer {
  question_id: string;
  choice_id: string;
  client_seq: number;
  timestamp: number;
}

function loadPersisted(sessionId: string): PersistedAttempt | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedAttempt;
    return p.session_id === sessionId ? p : null;
  } catch {
    return null;
  }
}

function persist(p: PersistedAttempt) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

function clearPersisted() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PENDING_KEY);
}

function loadPendingAnswers(): PendingAnswer[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePendingAnswers(answers: PendingAnswer[]) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(answers));
}

function ExamApp() {
  const [payload, setPayload] = useState<ExamPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [connected, setConnected] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const seqRef = useRef(0);
  const socketRef = useRef<Socket | null>(null);
  const pendingAnswersRef = useRef<PendingAnswer[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load pending answers from storage on mount
  useEffect(() => {
    pendingAnswersRef.current = loadPendingAnswers();
  }, []);

  // Receive payload from main process
  useEffect(() => {
    const off = window.studentApi.onExamStart(async (p: ExamPayload) => {
      setPayload(p);
      const persisted = loadPersisted(p.session_id);
      if (persisted) {
        setAnswers(persisted.answers);
        seqRef.current = persisted.client_seq;
      } else {
        setAnswers({});
        seqRef.current = 0;
      }
      persist({
        session_id: p.session_id,
        exam_id: p.exam.id,
        deadline_at: p.deadline_at,
        answers: persisted?.answers ?? {},
        client_seq: persisted?.client_seq ?? 0,
        exam_payload: p.exam,
      });
    });
    return off;
  }, []);

  // Flush pending answers when connected
  const flushPendingAnswers = useCallback(() => {
    if (!socketRef.current?.connected || !payload) return;
    
    const pending = [...pendingAnswersRef.current];
    if (pending.length === 0) return;
    
    // Sort by timestamp to preserve order
    pending.sort((a, b) => a.timestamp - b.timestamp);
    
    for (const ans of pending) {
      socketRef.current?.emit('answer:upsert', {
        session_id: payload.session_id,
        question_id: ans.question_id,
        choice_id: ans.choice_id,
        client_seq: ans.client_seq,
      });
    }
    
    // Keep only unconfirmed ones in a separate list (server will ack)
    pendingAnswersRef.current = [];
    savePendingAnswers([]);
  }, [payload]);

  // Build socket connection
  useEffect(() => {
    let s: Socket;
    let cancelled = false;
    
    (async () => {
      const session = await window.studentApi.getSession();
      if (!session || cancelled) {
        setError('No session found. Please login again.');
        return;
      }
      
      s = io(session.base_url, {
        path: '/ws',
        transports: ['websocket'],
        auth: { token: session.access_token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10_000,
        reconnectionAttempts: 10,
      });
      socketRef.current = s;
      
      s.on('connect', async () => {
        setConnected(true);
        setError(null);
        
        if (payload) {
          // Resync with server
          s.emit(
            'attempt:resync',
            { session_id: payload.session_id, last_client_seq: seqRef.current },
            (ack: any) => {
              if (ack?.ok) {
                seqRef.current = Math.max(seqRef.current, ack.accepted_seq);
                setAnswers((prev) => ({ ...prev, ...ack.answers }));
                // Flush any pending answers after resync
                flushPendingAnswers();
              }
            },
          );
        }
      });
      
      s.on('connect_error', (err) => {
        setConnected(false);
        setError(`Connection lost: ${err.message}. Reconnecting...`);
      });
      
      s.on('disconnect', (reason) => {
        setConnected(false);
        if (reason !== 'io client disconnect') {
          setError('Disconnected from server. Reconnecting...');
        }
      });
      
      s.on('exam:closed', () => {
        clearPersisted();
        setSubmitted(true);
      });
    })();
    
    return () => {
      cancelled = true;
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
      s?.disconnect();
      socketRef.current = null;
    };
  }, [payload, flushPendingAnswers]);

  // Tick clock every second
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Persist on every answer change
  useEffect(() => {
    if (!payload) return;
    persist({
      session_id: payload.session_id,
      exam_id: payload.exam.id,
      deadline_at: payload.deadline_at,
      answers,
      client_seq: seqRef.current,
      exam_payload: payload.exam,
    });
  }, [answers, payload]);

  const remaining = payload
    ? Math.max(0, new Date(payload.deadline_at).getTime() - now)
    : 0;
  const isExpired = remaining === 0 && payload !== null;

  const orderedQuestions = useMemo(() => {
    if (!payload) return [];
    const questions = [...payload.exam.questions].sort((a, b) => a.ordinal - b.ordinal);
    if (payload.exam.shuffle) {
      return shuffleStable(questions, payload.session_id);
    }
    return questions;
  }, [payload]);

  const pickAnswer = useCallback(
    (questionId: string, choiceId: string) => {
      seqRef.current += 1;
      const seq = seqRef.current;
      setAnswers((prev) => ({ ...prev, [questionId]: choiceId }));
      
      const sock = socketRef.current;
      if (sock?.connected && payload) {
        sock.timeout(3000).emit(
          'answer:upsert',
          {
            session_id: payload.session_id,
            question_id: questionId,
            choice_id: choiceId,
            client_seq: seq,
          },
          (err: any) => {
            if (err) {
              // Queue for later if failed
              pendingAnswersRef.current.push({
                question_id: questionId,
                choice_id: choiceId,
                client_seq: seq,
                timestamp: Date.now(),
              });
              savePendingAnswers(pendingAnswersRef.current);
            }
          },
        );
      } else if (payload) {
        // Queue for when connection is restored
        pendingAnswersRef.current.push({
          question_id: questionId,
          choice_id: choiceId,
          client_seq: seq,
          timestamp: Date.now(),
        });
        savePendingAnswers(pendingAnswersRef.current);
      }
    },
    [payload],
  );

  async function submit() {
    if (!payload || !socketRef.current || isSubmitting) return;
    
    setIsSubmitting(true);
    
    // Final flush of pending answers
    flushPendingAnswers();
    
    // Give a moment for pending answers to be sent
    await new Promise(resolve => setTimeout(resolve, 500));
    
    socketRef.current
      .timeout(10000)
      .emit('exam:submit', { session_id: payload.session_id }, (err: any, ack: any) => {
        if (ack?.ok) {
          clearPersisted();
          setSubmitted(true);
          setScore(ack.score ?? null);
          setTimeout(() => window.studentApi.closeExam(), 3000);
        } else {
          setError(err?.message || 'Submission failed. Please contact your teacher.');
        }
        setIsSubmitting(false);
      });
  }

  // Auto-submit on expiry
  useEffect(() => {
    if (isExpired && !submitted && !isSubmitting && payload) {
      submit();
    }
  }, [isExpired, submitted, isSubmitting, payload]);

  if (error) {
    return (
      <div className="center">
        <div className="card">
          <h1>خطأ</h1>
          <div className="error">{error}</div>
          <button onClick={() => window.location.reload()} style={{ marginTop: 16 }}>
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  if (!payload) {
    return <div className="center"><div className="muted">في انتظار الاختبار...</div></div>;
  }
  
  if (submitted) {
    return (
      <div className="center">
        <div className="card">
          <h1>تم تسليم الاختبار</h1>
          {score != null && <div style={{ fontSize: 24, marginTop: 16 }}>الدرجة: {score}</div>}
          <div className="muted" style={{ marginTop: 16 }}>سيُغلق هذا النافذة تلقائياً.</div>
        </div>
      </div>
    );
  }

  if (orderedQuestions.length === 0) {
    return (
      <div className="center">
        <div className="card">
          <h1>خطأ في الاختبار</h1>
          <div className="error">لا توجد أسئلة في هذا الاختبار.</div>
          <button onClick={() => window.studentApi.closeExam()} style={{ marginTop: 16 }}>
            إغلاق
          </button>
        </div>
      </div>
    );
  }

  const q = orderedQuestions[current];
  const answeredCount = Object.keys(answers).length;
  const progressPercent = (answeredCount / orderedQuestions.length) * 100;

  return (
    <div className="exam">
      <header>
        <strong>{payload.exam.title}</strong>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {!connected && <span className="connection-warn">⚠ انقطع الاتصال</span>}
          <span>المتبقي: <strong>{formatRemaining(remaining)}</strong></span>
        </div>
      </header>
      <div className="stage">
        <div className="progress-bar" style={{ marginBottom: 24 }}>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
            {answeredCount} من {orderedQuestions.length} تمت الإجابة
          </div>
        </div>
        
        <div className="q">
          <div className="prompt">{q.prompt}</div>
          <div className="choices">
            {q.choices.map((c) => (
              <div
                key={c.id}
                className={`choice ${answers[q.id] === c.id ? 'selected' : ''}`}
                onClick={() => pickAnswer(q.id, c.id)}
              >
                {c.text}
              </div>
            ))}
          </div>
        </div>
        
        <div className="q-pager">
          {orderedQuestions.map((qq, i) => (
            <button
              key={qq.id}
              className={`${answers[qq.id] ? 'answered' : ''} ${i === current ? 'current' : ''}`}
              onClick={() => setCurrent(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
      <footer>
        <span className="muted"></span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
          >
            السابق
          </button>
          <button
            onClick={() => setCurrent((c) => Math.min(orderedQuestions.length - 1, c + 1))}
            disabled={current === orderedQuestions.length - 1}
          >
            التالي
          </button>
          <button onClick={submit} disabled={!connected || isSubmitting}>
            {isSubmitting ? 'جاري التسليم...' : 'تسليم نهائي'}
          </button>
        </div>
      </footer>
    </div>
  );
}

function formatRemaining(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function shuffleStable<T extends { id: string }>(items: T[], seedStr: string): T[] {
  let h = 0;
  for (const c of seedStr) h = (h * 31 + c.charCodeAt(0)) | 0;
  const rng = mulberry32(h >>> 0);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(<ExamApp />);