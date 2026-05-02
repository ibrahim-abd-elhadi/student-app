import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../store';

export function MonitorView() {
  const session = useApp((s) => s.activeSession)!;
  const exam = useApp((s) => s.activeExam)!;
  const total = useApp((s) => s.totalQuestions);
  const attempts = useApp((s) => s.attempts);
  const roster = useApp((s) => s.roster);
  const applyProgress = useApp((s) => s.applyProgress);
  const applySubmitted = useApp((s) => s.applySubmitted);
  const closeActive = useApp((s) => s.closeActive);
  const setView = useApp((s) => s.setView);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const sock = api.connectSocket();
    sock.on('attempt:progress', (p: any) =>
      applyProgress(p.student_id, p.answered_count),
    );
    sock.on('attempt:submitted', (p: any) =>
      applySubmitted(p.student_id, p.score, p.submitted_at),
    );
    sock.on('session:closed', (p: any) => {
      if (p.session_id === session.id) closeActive();
    });
    return () => {
      sock.off('attempt:progress');
      sock.off('attempt:submitted');
      sock.off('session:closed');
    };
  }, [session.id, applyProgress, applySubmitted, closeActive]);

  const remainingMs = session.deadline_at
    ? new Date(session.deadline_at).getTime() - now
    : 0;
  const timeStr = formatRemaining(Math.max(0, remainingMs));

  async function stop() {
    try {
      await api.stopSession(session.id);
    } catch {
      // server might already be closing it via deadline; closeActive arrives via socket.
    }
  }

  const nameById = new Map(roster.map((r) => [r.id, r.display_name]));

  return (
    <>
      <div className="toolbar">
        <div className="card" style={{ padding: '8px 16px' }}>
          <strong>{exam.title}</strong> &nbsp;·&nbsp; الوقت المتبقي:&nbsp;
          <strong>{timeStr}</strong>
        </div>
        <button className="danger" onClick={stop}>إنهاء الاختبار الآن</button>
        <button className="secondary" onClick={() => setView('report')}>عرض التقرير</button>
      </div>

      <table className="card">
        <thead>
          <tr>
            <th>الطالب</th>
            <th>الإجابات</th>
            <th>الحالة</th>
            <th>الدرجة</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(attempts).map((a) => (
            <tr key={a.id}>
              <td>{nameById.get(a.student_id) ?? a.student_id}</td>
              <td style={{ minWidth: 200 }}>
                <div className="progress">
                  <div style={{ width: `${total ? (a.answered_count / total) * 100 : 0}%` }} />
                </div>
                <div className="muted">
                  {a.answered_count} / {total}
                </div>
              </td>
              <td>{stateLabel(a.state)}</td>
              <td>{a.score ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function formatRemaining(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function stateLabel(s: string): string {
  switch (s) {
    case 'SUBMITTED': return 'مُسلَّم';
    case 'EXPIRED':   return 'منتهي';
    case 'IN_PROGRESS': return 'قيد التنفيذ';
    case 'ASSIGNED':  return 'لم يبدأ';
    case 'CANCELLED': return 'ملغى';
    default: return s;
  }
}
