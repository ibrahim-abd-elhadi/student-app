import React, { useEffect, useState } from 'react';
import { api } from '../api';
import type { ExamSummary } from '@classroom/shared';

export function ExamList({
  onNew,
  onEdit,
}: {
  onNew: () => void;
  onEdit: (id: string) => void;
}) {
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    try {
      const list = await api.listExams();
      setExams(list);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? 'فشل التحميل');
    }
  }
  useEffect(() => { void reload(); }, []);

  async function remove(id: string) {
    if (!confirm('حذف هذا الاختبار نهائياً؟')) return;
    try {
      await api.deleteExam(id);
      await reload();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'فشل الحذف (قد يكون مستخدماً في جلسة).');
    }
  }

  return (
    <>
      <div className="toolbar">
        <button onClick={onNew}>+ اختبار جديد</button>
      </div>
      {err && <div className="error">{err}</div>}
      {exams.map((e) => (
        <div key={e.id} className="card list-card">
          <div>
            <div><strong>{e.title}</strong></div>
            <div className="muted">
              {e.question_count} سؤال · مدة {e.default_duration} دقيقة ·{' '}
              {e.is_published ? 'منشور' : 'مسودة'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onEdit(e.id)}>تعديل</button>
            <button className="danger" onClick={() => remove(e.id)}>حذف</button>
          </div>
        </div>
      ))}
      {exams.length === 0 && <div className="muted">لا توجد اختبارات بعد.</div>}
    </>
  );
}
