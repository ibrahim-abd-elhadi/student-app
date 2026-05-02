import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface DraftChoice { id: string; text: string; }
interface DraftQuestion {
  ordinal: number;
  prompt: string;
  choices: DraftChoice[];
  correct_id: string;
  points: number;
}

export function ExamEditor({
  examId,
  onDone,
}: {
  examId: string | null;
  onDone: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [shuffle, setShuffle] = useState(true);
  const [published, setPublished] = useState(false);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(examId);

  useEffect(() => {
    if (!examId) return;
    void api.getExam(examId).then((e: any) => {
      setTitle(e.title);
      setDescription(e.description ?? '');
      setDuration(e.default_duration);
      setShuffle(e.shuffle_questions);
      setPublished(e.is_published);
      setQuestions(
        e.questions.map((q: any) => ({
          ordinal: q.ordinal,
          prompt: q.prompt,
          choices: q.choices,
          correct_id: q.correct_id,
          points: q.points,
        })),
      );
    });
  }, [examId]);

  function addQuestion() {
    setQuestions((qs) => [
      ...qs,
      {
        ordinal: qs.length + 1,
        prompt: '',
        choices: [
          { id: 'a', text: '' },
          { id: 'b', text: '' },
        ],
        correct_id: 'a',
        points: 1,
      },
    ]);
  }
  function patchQuestion(idx: number, patch: Partial<DraftQuestion>) {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }
  function removeQuestion(idx: number) {
    setQuestions((qs) => qs.filter((_, i) => i !== idx).map((q, i) => ({ ...q, ordinal: i + 1 })));
  }
  function addChoice(qIdx: number) {
    const q = questions[qIdx];
    const nextId = String.fromCharCode(97 + q.choices.length);
    patchQuestion(qIdx, { choices: [...q.choices, { id: nextId, text: '' }] });
  }
  function removeChoice(qIdx: number, cIdx: number) {
    const q = questions[qIdx];
    if (q.choices.length <= 2) return;
    const next = q.choices.filter((_, i) => i !== cIdx);
    patchQuestion(qIdx, {
      choices: next,
      correct_id: next.find((c) => c.id === q.correct_id) ? q.correct_id : next[0].id,
    });
  }
  function patchChoice(qIdx: number, cIdx: number, text: string) {
    const q = questions[qIdx];
    const next = q.choices.map((c, i) => (i === cIdx ? { ...c, text } : c));
    patchQuestion(qIdx, { choices: next });
  }

  function validate(): string | null {
    if (!title.trim()) return 'العنوان مطلوب';
    if (duration < 1) return 'المدة غير صحيحة';
    if (questions.length === 0) return 'أضف سؤالاً واحداً على الأقل';
    for (const [i, q] of questions.entries()) {
      if (!q.prompt.trim()) return `السؤال ${i + 1}: نص السؤال فارغ`;
      if (q.choices.length < 2) return `السؤال ${i + 1}: يجب أن يكون فيه خياران على الأقل`;
      if (q.choices.some((c) => !c.text.trim())) return `السؤال ${i + 1}: خيار فارغ`;
      if (!q.choices.some((c) => c.id === q.correct_id))
        return `السؤال ${i + 1}: الإجابة الصحيحة غير محددة`;
      const ids = new Set(q.choices.map((c) => c.id));
      if (ids.size !== q.choices.length) return `السؤال ${i + 1}: معرفات الخيارات مكررة`;
    }
    return null;
  }

  async function save() {
    const v = validate();
    if (v) { setErr(v); return; }
    setBusy(true);
    setErr(null);
    try {
      const body = {
        title,
        description,
        default_duration: duration,
        shuffle_questions: shuffle,
        is_published: published,
      };
      let id = savedId;
      if (!id) {
        const created = await api.createExam(body);
        id = created.id;
      } else {
        await api.updateExam(id, body);
      }
      await api.replaceQuestions(id!, questions);
      setSavedId(id);
      onDone();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? 'فشل الحفظ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="toolbar">
        <button onClick={save} disabled={busy}>{busy ? '...' : 'حفظ'}</button>
        <button className="secondary" onClick={onDone}>إلغاء</button>
      </div>
      {err && <div className="error" style={{ marginBottom: 12 }}>{err}</div>}
      <div className="card">
        <div className="row"><label>العنوان</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="row"><label>الوصف</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="row"><label>المدة (دقائق)</label>
          <input type="number" min={1} max={360} value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value, 10) || 1)} /></div>
        <label>
          <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
          {' '}خلط ترتيب الأسئلة عشوائياً
        </label>
        <br />
        <label>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          {' '}منشور (يظهر للمعلّمين عند بدء الجلسات)
        </label>
      </div>

      <h3>الأسئلة</h3>
      {questions.map((q, i) => (
        <div key={i} className="q-card">
          <div className="row"><label>السؤال {i + 1}</label>
            <input value={q.prompt} onChange={(e) => patchQuestion(i, { prompt: e.target.value })} /></div>
          <div>
            {q.choices.map((c, j) => (
              <div className="choice-row" key={c.id}>
                <input
                  type="radio"
                  checked={q.correct_id === c.id}
                  onChange={() => patchQuestion(i, { correct_id: c.id })}
                  title="حدد الإجابة الصحيحة"
                />
                <input
                  value={c.text}
                  placeholder={`خيار ${c.id}`}
                  onChange={(e) => patchChoice(i, j, e.target.value)}
                />
                <button
                  className="secondary"
                  onClick={() => removeChoice(i, j)}
                  disabled={q.choices.length <= 2}
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="secondary" onClick={() => addChoice(i)}>+ خيار</button>
            <button className="danger" onClick={() => removeQuestion(i)}>حذف السؤال</button>
          </div>
        </div>
      ))}
      <button onClick={addQuestion}>+ إضافة سؤال</button>
    </>
  );
}
