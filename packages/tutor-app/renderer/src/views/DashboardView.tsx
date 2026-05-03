import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { listMyAttempts } from './api';
import type { StudentAttemptSummary, AttemptState } from './api';
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
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const s = (await window.studentApi.getSession()) as Session | null;
      if (!s) {
        setErr('لا توجد جلسة. الرجاء تسجيل الدخول مجدداً.');
        return;
      }
      setSession(s);
      const list = await listMyAttempts(s.base_url, s.access_token);
      setRows(list);
      setErr(null);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? 'فشل التحميل');
    }
  };

  useEffect(() => {
    const sock = api.connectSocket();

    const refreshRoster = async () => {
      try {
        const list = await api.listStudents(user.classroom_id);
        setRoster(list);
      } catch (err) {
        console.error('Roster fetch failed:', err);
      }
    };

    refreshRoster();
    const rosterTimer = window.setInterval(refreshRoster, 5_000);

    sock.on('connect', () => {
      console.log('✅ Tutor socket connected:', sock.id);
      refreshRoster();
    });

    sock.on('disconnect', () => {
      console.log('❌ Tutor socket disconnected');
    });

    sock.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message);
    });

    sock.on('presence:update', (p: any) => {
      console.log('presence:update =>', p);

      upsertPresence(
        p.user_id,
        p.online,
        p.last_seen_at ?? null,
        p.ready ?? false
      );
    });

    sock.on('student:state', (p: any) => {
      console.log('student:state =>', p);

      upsertStudentState(p.student_id, {
        locked: p.locked,
        suspicious: p.suspicious,
      });
    });

    return () => {
      window.clearInterval(rosterTimer);
      sock.off('connect');
      sock.off('disconnect');
      sock.off('connect_error');
      sock.off('presence:update');
      sock.off('student:state');
    };
  }, [user.classroom_id]);

  function lock() {
    if (selected.size === 0) return;

    api.connectSocket().emit('student:lock', {
      student_ids: [...selected],
      message: 'تم قفل الجهاز من قبل المعلّم',
    });
  }

  async function refresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1>أهلاً، {session?.user.display_name ?? '...'}</h1>
          <div className="muted">لوحة الطالب</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refresh} disabled={refreshing}>
            {refreshing ? '...' : 'تحديث'}
          </button>
          <button onClick={ready} disabled={readying}>
            {readying ? '...' : 'استعداد'}
          </button>
        </div>
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
        عند الضغط على «استعداد» سيُخفى التطبيق في الخلفية بانتظار أوامر المعلّم.
      </p>
    </div>
  );
}
