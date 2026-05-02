import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../store';
import type { SessionReport } from '@classroom/shared';

export function ReportView() {
  const session = useApp((s) => s.activeSession);
  const setView = useApp((s) => s.setView);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    void api.getReport(session.id).then(setReport);
  }, [session]);

  async function print() {
    if (!session) return;
    setBusy(true);
    try {
      const html = await api.getReportHtml(session.id);
      await window.tutorApi.printReport(html);
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return <div className="muted">لا توجد جلسة نشطة.</div>;
  }
  if (!report) return <div className="muted">جارٍ تحميل التقرير...</div>;

  return (
    <>
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>{report.exam_title}</h2>
        <button onClick={print} disabled={busy}>طباعة</button>
        <button className="secondary" onClick={() => setView('dashboard')}>عودة</button>
      </div>
      <table className="card">
        <thead>
          <tr>
            <th>الطالب</th>
            <th>عدد الإجابات</th>
            <th>الدرجة</th>
            <th>الحالة</th>
            <th>وقت التسليم</th>
          </tr>
        </thead>
        <tbody>
          {report.results.map((r) => (
            <tr key={r.student_id}>
              <td>{r.display_name}</td>
              <td>{r.answered_count} / {report.total_questions}</td>
              <td>{r.score ?? '—'}</td>
              <td>{r.state}</td>
              <td>{r.submitted_at ? new Date(r.submitted_at).toLocaleString('ar') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
