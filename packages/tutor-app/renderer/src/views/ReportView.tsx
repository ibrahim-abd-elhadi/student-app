import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../store';
import type { SessionReport } from '@classroom/shared';

export function ReportView() {
  const session = useApp((s) => s.activeSession);
  const setView = useApp((s) => s.setView);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    api.getReport(session.id).then(setReport).catch(console.error);
  }, [session]);

  async function print() {
    if (!session) return;
    setBusy(true);
    setPrintError(null);
    try {
      const html = await api.getReportHtml(session.id);
      if (window.tutorApi) {
        await window.tutorApi.printReport(html);
      } else {
        // Fallback: create a print window
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
          printWindow.close();
        } else {
          throw new Error('Could not open print window');
        }
      }
    } catch (err: any) {
      setPrintError(err.message || 'Print failed');
      console.error('Print error:', err);
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
      {printError && <div className="error" style={{ marginBottom: 16 }}>{printError}</div>}
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