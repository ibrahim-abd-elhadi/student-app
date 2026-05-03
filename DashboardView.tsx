import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../store';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentScore {
  student_id: string;
  answered: number;
  total: number;
  score: number;
}

interface ActivityLog {
  id: number;
  text: string;
  time: string;
  type: 'success' | 'warning' | 'info' | 'danger';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.trim().slice(0, 2);
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  sub,
  subType = 'neutral',
}: {
  label: string;
  value: string | number;
  sub?: string;
  subType?: 'success' | 'warning' | 'neutral';
}) {
  const subColor =
    subType === 'success'
      ? '#1D9E75'
      : subType === 'warning'
      ? '#BA7517'
      : 'var(--muted)';
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub && (
        <div className="metric-sub" style={{ color: subColor }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function StudentTile({
  student,
  selected,
  score,
  onToggle,
}: {
  student: any;
  selected: boolean;
  score?: StudentScore;
  onToggle: () => void;
}) {
  const statusClass = student.locked
    ? 'locked'
    : student.exam_active
    ? 'exam-active'
    : student.online
    ? 'online'
    : 'offline';

  const avatarClass = student.locked
    ? 'av-locked'
    : student.exam_active
    ? 'av-exam'
    : student.online
    ? 'av-online'
    : 'av-offline';

  const statusText = student.locked
    ? '🔒 مقفول'
    : student.exam_done
    ? '✓ أنهى'
    : student.exam_active
    ? 'في الامتحان'
    : student.online
    ? 'متصل'
    : 'غير متصل';

  const progress =
    score && score.total > 0
      ? Math.round((score.answered / score.total) * 100)
      : 0;

  const barColor = student.locked
    ? '#D85A30'
    : student.exam_done
    ? '#1D9E75'
    : '#BA7517';

  return (
    <div
      className={`student-tile ${statusClass} ${selected ? 'selected' : ''}`}
      onClick={onToggle}
      title={student.display_name}
    >
      <div className={`s-avatar ${avatarClass}`}>
        {getInitials(student.display_name)}
      </div>
      <div className="s-name">{student.display_name}</div>
      <div className="s-status">{statusText}</div>
      {student.suspicious && (
        <div className="s-warn">⚠ نشاط مشبوه</div>
      )}
      <div className="s-progress">
        <div
          className="s-progress-fill"
          style={{ width: `${progress}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

function ScoreRow({ student, score }: { student: any; score: StudentScore }) {
  const pct = score.total > 0 ? Math.round((score.score / score.total) * 100) : 0;
  const color = student.locked ? '#D85A30' : student.exam_done ? '#1D9E75' : '#BA7517';
  return (
    <div className="score-row">
      <div className={`s-avatar-sm ${student.locked ? 'av-locked' : student.exam_done ? 'av-online' : 'av-exam'}`}>
        {getInitials(student.display_name)}
      </div>
      <div className="score-info">
        <div className="score-name">{student.display_name}</div>
        <div className="score-bar">
          <span className="score-num" style={{ color }}>
            {score.score}/{score.total}
          </span>
          <div className="bar-wrap">
            <div
              className="bar-fill"
              style={{ width: `${pct}%`, background: color }}
            />
          </div>
          <span className="score-pct">{pct}%{student.exam_done ? '' : ' جارٍ'}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function DashboardView() {
  const user            = useApp((s) => s.user)!;
  const roster          = useApp((s) => s.roster);
  const setRoster       = useApp((s) => s.setRoster);
  const upsertPresence  = useApp((s) => s.upsertPresence);
  const upsertStudentState = useApp((s) => s.upsertStudentState);
  const selected        = useApp((s) => s.selectedStudentIds);
  const toggleStudent   = useApp((s) => s.toggleStudent);
  const clearSelection  = useApp((s) => s.clearSelection);
  const selectAllOnline = useApp((s) => s.selectAllOnline);
  const setView         = useApp((s) => s.setView);

  const [scores, setScores]       = useState<Record<string, StudentScore>>({});
  const [timerSecs, setTimerSecs] = useState<number | null>(null);
  const [examActive, setExamActive] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [logCounter, setLogCounter]   = useState(0);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function addLog(text: string, type: ActivityLog['type'] = 'info') {
    const now = new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
    setLogCounter((c) => {
      const id = c + 1;
      setActivityLog((prev) => [{ id, text, time: now, type }, ...prev].slice(0, 20));
      return id;
    });
  }

  // ── Socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    void api.listStudents(user.classroom_id).then(setRoster);
    const sock = api.connectSocket();

    sock.on('presence:update', (p: any) => {
      upsertPresence(p.user_id, p.online, p.last_seen_at);
      const s = roster.find((r) => r.id === p.user_id);
      if (s) addLog(`${p.online ? 'اتصال' : 'انقطاع'} ${s.display_name}`, p.online ? 'info' : 'warning');
    });

    sock.on('student:state', (p: any) => {
      upsertStudentState(p.student_id, { locked: p.locked, suspicious: p.suspicious });
      const s = roster.find((r) => r.id === p.student_id);
      if (s && p.locked) addLog(`تم قفل جهاز ${s.display_name}`, 'danger');
    });

    sock.on('exam:answer', (p: any) => {
      setScores((prev) => ({
        ...prev,
        [p.student_id]: {
          student_id: p.student_id,
          answered:   p.answered ?? 0,
          total:      p.total    ?? 0,
          score:      p.score    ?? 0,
        },
      }));
    });

    sock.on('exam:started', (p: any) => {
      setExamActive(true);
      setTimerSecs(p.duration_minutes * 60);
      addLog('بدأ الامتحان', 'warning');
    });

    sock.on('exam:ended', () => {
      setExamActive(false);
      setTimerSecs(null);
      addLog('انتهى الامتحان', 'success');
    });

    sock.on('exam:student_done', (p: any) => {
      const s = roster.find((r) => r.id === p.student_id);
      if (s) addLog(`${s.display_name} أنهى الامتحان`, 'success');
    });

    return () => {
      sock.off('presence:update');
      sock.off('student:state');
      sock.off('exam:answer');
      sock.off('exam:started');
      sock.off('exam:ended');
      sock.off('exam:student_done');
    };
  }, [user.classroom_id, setRoster, upsertPresence, upsertStudentState]);

  // ── Timer countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (timerSecs === null) return;
    const interval = setInterval(() => {
      setTimerSecs((t) => {
        if (t === null || t <= 0) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerSecs]);

  // ── Actions ────────────────────────────────────────────────────────────────
  function lock() {
    if (selected.size === 0) return;
    api.connectSocket().emit('student:lock', {
      student_ids: [...selected],
      message: 'تم قفل الجهاز من قبل المعلّم',
    }, () => undefined);
    addLog(`تم قفل ${selected.size} جهاز`, 'danger');
  }

  function unlock() {
    if (selected.size === 0) return;
    api.connectSocket().emit('student:unlock', { student_ids: [...selected] }, () => undefined);
    addLog(`تم فتح قفل ${selected.size} جهاز`, 'success');
  }

  // ── Computed metrics ───────────────────────────────────────────────────────
  const onlineCount  = roster.filter((s) => s.online).length;
  const examCount    = roster.filter((s) => (s as any).exam_active).length;
  const doneCount    = roster.filter((s) => (s as any).exam_done).length;
  const lockedCount  = roster.filter((s) => s.locked).length;
  const avgScore     = doneCount > 0
    ? Math.round(
        Object.values(scores)
          .filter((sc) => {
            const st = roster.find((r) => r.id === sc.student_id) as any;
            return st?.exam_done;
          })
          .reduce((sum, sc) => sum + (sc.total > 0 ? (sc.score / sc.total) * 100 : 0), 0) / doneCount
      )
    : null;

  const dotColor = (type: ActivityLog['type']) => ({
    success: '#1D9E75',
    warning: '#BA7517',
    info:    '#378ADD',
    danger:  '#D85A30',
  }[type]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="dashboard" dir="rtl">

      {/* ── Styles ────────────────────────────────────────────────────────── */}
      <style>{`
        .dashboard { padding: 1.25rem; font-family: inherit; color: var(--fg, #1a1a1a); }
        .dash-topbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.25rem; }
        .dash-title  { font-size:17px; font-weight:600; }
        .dash-sub    { font-size:12px; color:var(--muted,#666); margin-top:2px; }
        .badge       { display:inline-flex; align-items:center; gap:5px; font-size:11px;
                       padding:3px 9px; border-radius:6px; font-weight:500; }
        .badge-exam  { background:#FAEEDA; color:#854F0B; }
        .badge-on    { background:#E1F5EE; color:#0F6E56; }
        .badge-row   { display:flex; gap:6px; }

        /* Metrics */
        .metrics     { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr));
                       gap:8px; margin-bottom:1.25rem; }
        .metric-card { background:var(--bg2,#f5f5f3); border-radius:8px; padding:12px 14px; }
        .metric-label{ font-size:11px; color:var(--muted,#666); margin-bottom:4px; }
        .metric-value{ font-size:20px; font-weight:600; }
        .metric-sub  { font-size:11px; margin-top:3px; }

        /* Grid layout */
        .dash-grid   { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
        .dash-col    { display:flex; flex-direction:column; gap:12px; }
        .dash-card   { background:var(--bg,#fff); border:0.5px solid var(--border,#e0e0e0);
                       border-radius:12px; padding:1rem 1.25rem; }
        .card-header { display:flex; align-items:center; justify-content:space-between;
                       margin-bottom:12px; }
        .card-title  { font-size:13px; font-weight:600; }
        .card-action { font-size:11px; color:#378ADD; cursor:pointer; }

        /* Student tiles */
        .student-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
        .student-tile{ border:0.5px solid var(--border,#e0e0e0); border-radius:8px;
                       padding:10px 6px; text-align:center; cursor:pointer;
                       transition:background .15s; user-select:none; }
        .student-tile:hover { background:var(--bg2,#f5f5f3); }
        .student-tile.selected { outline:2px solid #378ADD; }
        .student-tile.online   { border-color:#1D9E75; }
        .student-tile.exam-active{ border-color:#BA7517; border-width:1.5px; }
        .student-tile.locked   { border-color:#D85A30; }
        .s-avatar  { width:30px;height:30px;border-radius:50%;display:flex;
                     align-items:center;justify-content:center;font-size:11px;
                     font-weight:600;margin:0 auto 5px; }
        .av-online { background:#E1F5EE; color:#0F6E56; }
        .av-exam   { background:#FAEEDA; color:#854F0B; }
        .av-locked { background:#FAECE7; color:#993C1D; }
        .av-offline{ background:var(--bg2,#f5f5f3); color:var(--muted,#666); }
        .s-name    { font-size:10px; font-weight:600; white-space:nowrap;
                     overflow:hidden; text-overflow:ellipsis; }
        .s-status  { font-size:9px; color:var(--muted,#666); margin-top:2px; }
        .s-warn    { font-size:9px; color:#D85A30; margin-top:2px; }
        .s-progress{ height:3px; background:var(--border,#e0e0e0);
                     border-radius:2px; margin-top:5px; overflow:hidden; }
        .s-progress-fill{ height:100%; border-radius:2px; transition:width .3s; }

        /* Timer */
        .timer-wrap  { text-align:center; padding:.5rem 0; }
        .timer-val   { font-size:28px; font-weight:700; font-variant-numeric:tabular-nums;
                       direction:ltr; display:inline-block; }
        .timer-label { font-size:11px; color:var(--muted,#666); margin-top:3px; }
        .timer-warn  { color:#D85A30; }

        /* Scores */
        .score-row   { display:flex; align-items:center; gap:8px; padding:7px 0;
                       border-bottom:0.5px solid var(--border,#e0e0e0); }
        .score-row:last-child{ border-bottom:none; }
        .s-avatar-sm { width:26px;height:26px;border-radius:50%;display:flex;
                       align-items:center;justify-content:center;font-size:10px;
                       font-weight:600;flex-shrink:0; }
        .score-info  { flex:1; min-width:0; }
        .score-name  { font-size:12px; font-weight:500; }
        .score-bar   { display:flex; align-items:center; gap:5px; margin-top:3px; }
        .score-num   { font-size:11px; font-weight:600; min-width:30px; }
        .bar-wrap    { flex:1; height:5px; background:var(--border,#e0e0e0);
                       border-radius:3px; overflow:hidden; }
        .bar-fill    { height:100%; border-radius:3px; }
        .score-pct   { font-size:10px; color:var(--muted,#666); min-width:44px; }

        /* Activity */
        .act-item    { display:flex; align-items:flex-start; gap:8px; padding:6px 0;
                       border-bottom:0.5px solid var(--border,#e0e0e0); }
        .act-item:last-child{ border-bottom:none; }
        .act-dot     { width:7px;height:7px;border-radius:50%;margin-top:5px;flex-shrink:0; }
        .act-text    { font-size:11px; flex:1; line-height:1.5; }
        .act-time    { font-size:10px; color:var(--muted,#666); white-space:nowrap; }

        /* Buttons */
        .btn-row     { display:flex; gap:6px; margin-top:10px; flex-wrap:wrap; }
        .btn         { font-size:11px; padding:5px 10px; border-radius:6px;
                       border:0.5px solid var(--border,#e0e0e0); background:transparent;
                       cursor:pointer; transition:background .15s; }
        .btn:hover   { background:var(--bg2,#f5f5f3); }
        .btn:disabled{ opacity:.4; cursor:not-allowed; }
        .btn-primary { background:#E6F1FB; color:#185FA5; border-color:#B5D4F4; }
        .btn-danger  { background:#FAECE7; color:#993C1D; border-color:#F5C4B3; }
        .btn-success { background:#E1F5EE; color:#0F6E56; border-color:#9FE1CB; }

        /* FR checklist */
        .fr-list     { display:flex; flex-direction:column; gap:5px; }
        .fr-item     { display:flex; align-items:center; gap:7px; font-size:11px; }
        .fr-icon     { width:18px;height:18px;border-radius:4px;display:flex;
                       align-items:center;justify-content:center;font-size:9px;flex-shrink:0; }
        .fr-done     { background:#E1F5EE; color:#0F6E56; }
        .fr-pending  { background:#FAEEDA; color:#854F0B; }
        .fr-miss     { background:#FAECE7; color:#993C1D; }
      `}</style>

      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <div className="dash-topbar">
        <div>
          <div className="dash-title">لوحة التحكم — {user.classroom_id}</div>
          <div className="dash-sub">مرحباً، {user.display_name}</div>
        </div>
        <div className="badge-row">
          {examActive && <span className="badge badge-exam">● امتحان جارٍ</span>}
          <span className="badge badge-on">● {onlineCount} متصل</span>
        </div>
      </div>

      {/* ── Metrics ──────────────────────────────────────────────────────── */}
      <div className="metrics">
        <MetricCard label="الطلاب المتصلون" value={onlineCount}
          sub={`من أصل ${roster.length}`} subType="success" />
        {examActive && (
          <MetricCard label="في الامتحان" value={examCount}
            sub={timerSecs !== null ? `متبقي ${formatTime(timerSecs)}` : undefined}
            subType="warning" />
        )}
        <MetricCard label="أنهوا الامتحان" value={doneCount}
          sub={avgScore !== null ? `متوسط ${avgScore}%` : undefined}
          subType="success" />
        <MetricCard label="أجهزة مقفولة" value={lockedCount}
          subType={lockedCount > 0 ? 'warning' : 'neutral'} />
        <MetricCard label="إجمالي الطلاب" value={roster.length} />
      </div>

      {/* ── Main Grid ────────────────────────────────────────────────────── */}
      <div className="dash-grid">

        {/* ── Students ───────────────────────────────────────────────────── */}
        <div className="dash-card">
          <div className="card-header">
            <span className="card-title">الطلاب ({roster.length})</span>
            <span className="card-action" onClick={selectAllOnline}>تحديد المتصلين</span>
          </div>
          <div className="student-grid">
            {roster.map((s) => (
              <StudentTile
                key={s.id}
                student={s}
                selected={selected.has(s.id)}
                score={scores[s.id]}
                onToggle={() => toggleStudent(s.id)}
              />
            ))}
            {roster.length === 0 && (
              <div style={{ gridColumn: '1/-1', color: 'var(--muted,#666)', fontSize: 12 }}>
                لا يوجد طلاب في هذا الصف.
              </div>
            )}
          </div>
          <div className="btn-row">
            <button className="btn btn-danger" onClick={lock}
              disabled={selected.size === 0}>
              قفل الأجهزة ({selected.size})
            </button>
            <button className="btn btn-success" onClick={unlock}
              disabled={selected.size === 0}>
              فك القفل
            </button>
            <button className="btn btn-primary"
              onClick={() => setView('launch')}
              disabled={selected.size === 0}>
              بدء اختبار للمحددين ←
            </button>
            <button className="btn" onClick={clearSelection}
              disabled={selected.size === 0}>
              إلغاء التحديد
            </button>
          </div>
        </div>

        {/* ── Right Column ───────────────────────────────────────────────── */}
        <div className="dash-col">

          {/* Timer */}
          {examActive && timerSecs !== null && (
            <div className="dash-card">
              <div className="card-header">
                <span className="card-title">الوقت المتبقي</span>
              </div>
              <div className="timer-wrap">
                <div
                  className={`timer-val ${timerSecs < 300 ? 'timer-warn' : ''}`}
                >
                  {formatTime(timerSecs)}
                </div>
                <div className="timer-label">الامتحان جارٍ</div>
              </div>
              <div className="btn-row" style={{ justifyContent: 'center' }}>
                <button className="btn btn-danger"
                  onClick={() => api.connectSocket().emit('exam:stop', {}, () => undefined)}>
                  إنهاء الامتحان الآن
                </button>
                <button className="btn btn-primary"
                  onClick={() => setView('report')}>
                  عرض التقرير
                </button>
              </div>
            </div>
          )}

          {/* FR Checklist */}
          <div className="dash-card">
            <div className="card-header">
              <span className="card-title">متطلبات المشروع</span>
            </div>
            <div className="fr-list">
              {[
                { done: true,  label: 'خدمة تعمل تلقائياً بعد التثبيت' },
                { done: true,  label: 'قفل/فتح أجهزة الطلاب' },
                { done: true,  label: 'اكتشاف الطلاب تلقائياً' },
                { done: true,  label: 'بدء وإيقاف الامتحان' },
                { done: true,  label: 'تتبع مباشر للطلاب' },
                { done: true,  label: 'Designer — إنشاء أسئلة MCQ' },
                { done: true,  label: 'دعم اللغة العربية' },
                { done: false, label: 'طباعة تقرير النتائج', pending: true },
                { done: false, label: 'تسجيل دخول الطالب للامتحان', pending: false },
              ].map((fr, i) => (
                <div className="fr-item" key={i}>
                  <div className={`fr-icon ${fr.done ? 'fr-done' : fr.pending ? 'fr-pending' : 'fr-miss'}`}>
                    {fr.done ? '✓' : fr.pending ? '!' : '✗'}
                  </div>
                  <span>{fr.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Scores + Activity ─────────────────────────────────── */}
      <div className="dash-grid">

        {/* Scores */}
        <div className="dash-card">
          <div className="card-header">
            <span className="card-title">نتائج الطلاب</span>
            <span className="card-action" onClick={() => setView('report')}>
              طباعة تقرير ←
            </span>
          </div>
          {roster.filter((s) => scores[s.id]).length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted,#666)' }}>
              لم تبدأ أي امتحانات بعد.
            </div>
          ) : (
            roster
              .filter((s) => scores[s.id])
              .map((s) => (
                <ScoreRow key={s.id} student={s} score={scores[s.id]} />
              ))
          )}
        </div>

        {/* Activity Log */}
        <div className="dash-card">
          <div className="card-header">
            <span className="card-title">سجل النشاط المباشر</span>
          </div>
          {activityLog.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted,#666)' }}>
              لا يوجد نشاط بعد.
            </div>
          ) : (
            activityLog.map((log) => (
              <div className="act-item" key={log.id}>
                <div className="act-dot" style={{ background: dotColor(log.type) }} />
                <div className="act-text">{log.text}</div>
                <div className="act-time">{log.time}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
