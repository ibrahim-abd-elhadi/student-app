import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../store';
import type { ExamSummary } from '@classroom/shared';

export function LaunchView() {
  const exams = useApp((s) => s.exams);
  const setExams = useApp((s) => s.setExams);
  const selected = useApp((s) => s.selectedStudentIds);
  const roster = useApp((s) => s.roster);
  const setView = useApp((s) => s.setView);
  const startActive = useApp((s) => s.startActive);

  const [examId, setExamId] = useState<string>('');
  const [duration, setDuration] = useState<number>(30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void api.listExams().then((list: ExamSummary[]) => {
      const published = list.filter((e) => e.is_published && e.question_count > 0);
      setExams(published);
      if (published[0]) {
        setExamId(published[0].id);
        setDuration(published[0].default_duration);
      }
    });
  }, [setExams]);

  async function start() {
    if (!examId) return;
    setBusy(true);
    setErr(null);
    try {
      const create = await api.createSession({
        exam_id: examId,
        student_ids: [...selected],
        duration_minutes: duration,
      });
      const started = await api.startSession(create.session.id);
      const detail = await api.getSession(create.session.id);
      const exam = exams.find((e) => e.id === examId)!;
      startActive(detail.session, exam, detail.attempts, exam.question_count);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? 'failed');
    } finally {
      setBusy(false);
    }
  }

  const studentNames = roster
    .filter((r) => selected.has(r.id))
    .map((r) => r.display_name);

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h2>إطلاق اختبار</h2>
      <div className="muted" style={{ marginBottom: 12 }}>
        الطلاب المحددون ({studentNames.length}): {studentNames.join('، ')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>
          الاختبار
          <select
            value={examId}
            onChange={(e) => {
              setExamId(e.target.value);
              const x = exams.find((x) => x.id === e.target.value);
              if (x) setDuration(x.default_duration);
            }}
            style={{ width: '100%', marginTop: 4 }}
          >
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} ({e.question_count} سؤال)
              </option>
            ))}
            {exams.length === 0 && <option>لا توجد اختبارات منشورة</option>}
          </select>
        </label>
        <label>
          المدة (دقائق)
          <input
            type="number"
            min={1}
            max={360}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value, 10) || 1)}
            style={{ width: '100%', marginTop: 4 }}
          />
        </label>
        {err && <div className="error">{err}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={start} disabled={busy || !examId || studentNames.length === 0}>
            {busy ? '...' : 'بدء الاختبار الآن'}
          </button>
          <button className="secondary" onClick={() => setView('dashboard')}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
