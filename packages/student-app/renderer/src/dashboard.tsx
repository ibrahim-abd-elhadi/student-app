import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { getActiveExam, listMyAttempts, markOnline } from './api';
import { startHost } from './host';
import type { StudentAttemptSummary, AttemptState } from '@classroom/shared';
import './styles.css';

interface Session {
  base_url: string;
  access_token: string;
  refresh_token: string;
  user: { id: string; display_name: string; classroom_id: string };
}

const STATE_LABEL: Record<AttemptState, string> = {
  ASSIGNED: 'لم يبدأ',
  IN_PROGRESS: 'جارٍ',
  SUBMITTED: 'مُسلَّم',
  EXPIRED: 'منتهٍ',
  CANCELLED: 'ملغى',
};

function pct(score: number | null, total: number | null): string {
  if (score == null || total == null || total === 0) return '—';
  return `${Math.round((score / total) * 100)}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ar');
  } catch {
    return iso;
  }
}

function Stats({ rows }: { rows: StudentAttemptSummary[] }) {
  const submitted = rows.filter((r) => r.state === 'SUBMITTED');
  const totalTaken = submitted.length;
  const ratios = submitted
    .map((r) =>
      r.score != null && r.total_points && r.total_points > 0
        ? r.score / r.total_points
        : null,
    )
    .filter((x): x is number => x != null);
  const avg =
    ratios.length === 0
      ? null
      : ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const best = ratios.length === 0 ? null : Math.max(...ratios);

  return (
    <div className="stats">
      <div className="stat">
        <div className="stat-value">{totalTaken}</div>
        <div className="stat-label">اختبارات مُسلَّمة</div>
      </div>
      <div className="stat">
        <div className="stat-value">
          {avg == null ? '—' : `${Math.round(avg * 100)}%`}
        </div>
        <div className="stat-label">المتوسط</div>
      </div>
      <div className="stat">
        <div className="stat-value">
          {best == null ? '—' : `${Math.round(best * 100)}%`}
        </div>
        <div className="stat-label">أعلى نتيجة</div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [rows, setRows] = useState<StudentAttemptSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [readying, setReadying] = useState(false);
  const [onlineRequested, setOnlineRequested] = useState(false);
  const [online, setOnline] = useState(false);
  const onlineHeartbeatRef = useRef<number | null>(null);
  const examPollRef = useRef<number | null>(null);
  const openedExamRef = useRef<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const s = (await window.studentApi.getSession()) as Session | null;
        if (!s) {
          setErr('لا توجد جلسة. الرجاء تسجيل الدخول مجدداً.');
          return;
        }
        setSession(s);
        const list = await listMyAttempts(s.base_url, s.access_token);
        setRows(list);
      } catch (e: any) {
        setErr(e?.response?.data?.message ?? e?.message ?? 'فشل التحميل');
      }
    })();
  }, []);

  useEffect(() => {
    return window.studentApi.onOnlineReady(() => {
      setOnline(true);
      setReadying(false);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (onlineHeartbeatRef.current != null) {
        window.clearInterval(onlineHeartbeatRef.current);
      }
      if (examPollRef.current != null) {
        window.clearInterval(examPollRef.current);
      }
    };
  }, []);

  const recent = useMemo(() => (rows ?? []).slice(0, 10), [rows]);

  async function ready() {
    if (!session) return;
    setReadying(true);
    try {
      setOnlineRequested(true);
      await markOnline(session.base_url, session.access_token);
      setOnline(true);
      if (onlineHeartbeatRef.current != null) {
        window.clearInterval(onlineHeartbeatRef.current);
      }
      onlineHeartbeatRef.current = window.setInterval(() => {
        void markOnline(session.base_url, session.access_token).catch((e) => {
          console.warn('online heartbeat failed:', e);
        });
      }, 15_000);
      await checkForActiveExam(session);
      if (examPollRef.current != null) {
        window.clearInterval(examPollRef.current);
      }
      examPollRef.current = window.setInterval(() => {
        void checkForActiveExam(session);
      }, 5_000);
      await startHost();
    } finally {
      setReadying(false);
    }
  }

  async function checkForActiveExam(s: Session) {
    try {
      const active = await getActiveExam(s.base_url, s.access_token);
      if (!active || openedExamRef.current === active.session_id) return;
      openedExamRef.current = active.session_id;
      await window.studentApi.openExam(active);
    } catch (e) {
      console.warn('active exam poll failed:', e);
    }
  }

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>أهلاً، {session?.user.display_name ?? '...'}</h1>
          <div className="muted">لوحة الطالب</div>
        </div>
        <button onClick={ready} disabled={readying || onlineRequested}>
          {online ? 'أونلاين' : readying || onlineRequested ? 'جاري الاتصال' : 'ظهور أونلاين'}
        </button>
      </header>

      {err && <div className="error">{err}</div>}

      {rows != null && <Stats rows={rows} />}

      <section className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>آخر المحاولات</h2>
        {rows == null && !err && <div className="muted">جارٍ التحميل…</div>}
        {rows != null && rows.length === 0 && (
          <div className="muted">لا توجد محاولات بعد.</div>
        )}
        {recent.length > 0 && (
          <table className="dash-table">
            <thead>
              <tr>
                <th>الاختبار</th>
                <th>التاريخ</th>
                <th>الحالة</th>
                <th>النتيجة</th>
                <th>النسبة</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.attempt_id}>
                  <td>{r.exam_title}</td>
                  <td>{fmtDate(r.submitted_at ?? r.started_at ?? r.created_at)}</td>
                  <td>{STATE_LABEL[r.state]}</td>
                  <td>
                    {r.score == null
                      ? '—'
                      : `${r.score}${r.total_points != null ? ` / ${r.total_points}` : ''}`}
                  </td>
                  <td>{pct(r.score, r.total_points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="muted" style={{ marginTop: 16 }}>
        اضغط «ظهور أونلاين» عندما تكون جاهزا. بعد ظهور حالة «أونلاين» سيستقبل التطبيق أوامر المعلم.
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Dashboard />);
