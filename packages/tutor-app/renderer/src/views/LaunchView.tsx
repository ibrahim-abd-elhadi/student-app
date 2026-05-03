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

  const [examId, setExamId] = useState('');
  const [duration, setDuration] = useState(30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const list: ExamSummary[] = await api.listExams();
        const fixed = list.filter(
          (e: any) =>
            e.is_published === true &&
            Number(e.question_count) > 0 &&
            typeof e.id === 'string'
        );
        setExams(fixed);
        if (fixed.length > 0) {
          setExamId(fixed[0].id);
          setDuration(Number(fixed[0].default_duration || 30));
        }
      } catch (e) {
        console.error(e);
      }
    }
    load();
  }, []);

  async function start() {
    setBusy(true);
    setErr(null);

    try {
      const realStudents = roster
        .filter((r) => selected.has(r.id))
        .map((r) => r.id);

      console.log('exam_id:', examId);
      console.log('student_ids:', realStudents);

      const create = await api.createSession({
        exam_id: examId,
        student_ids: realStudents,
        duration_minutes: duration,
      });

      await api.startSession(create.session.id);

      const detail = await api.getSession(create.session.id);
      const exam = exams.find((x) => x.id === examId)!;

      startActive(detail.session, exam, detail.attempts, exam.question_count);
    } catch (e: any) {
      console.error('Start exam error:', e);
      // Try to extract a meaningful message from various error shapes
      const msg =
        e?.response?.data?.message ??
        (e?.response?.data?.error) ??
        (typeof e?.response?.data === 'string' ? e.response.data : undefined) ??
        e?.message ??
        'فشل – راجع السجلات';
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  const chosenStudents = roster.filter((r) => selected.has(r.id));

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h2>إطلاق اختبار</h2>

      <div className="muted" style={{ marginBottom: 12 }}>
        الطلاب المحددون ({chosenStudents.length}):
        {' '}
        {chosenStudents.map((x) => x.display_name).join('، ')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>
          الاختبار
          <select
            value={examId}
            onChange={(e) => {
              const val = e.target.value;
              setExamId(val);
              const found = exams.find((x) => x.id === val);
              if (found) setDuration(Number(found.default_duration || 30));
            }}
            style={{ width: '100%', marginTop: 4 }}
          >
            {exams.map((e: any) => (
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

        {err && (
          <div className="error" style={{ whiteSpace: 'pre-wrap' }}>
            {err}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={start}
            disabled={busy || !examId || chosenStudents.length === 0}
          >
            {busy ? '...' : 'بدء الاختبار الآن'}
          </button>
          <button className="secondary" onClick={() => setView('dashboard')}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}