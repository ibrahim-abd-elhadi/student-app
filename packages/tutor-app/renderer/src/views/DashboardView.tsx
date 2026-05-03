import React, { useEffect } from 'react';
import { api } from '../api';
import { useApp } from '../store';

export function DashboardView() {
  const user = useApp((s) => s.user)!;

  const roster = useApp((s) => s.roster);
  const setRoster = useApp((s) => s.setRoster);

  const upsertPresence = useApp((s) => s.upsertPresence);
  const upsertStudentState = useApp((s) => s.upsertStudentState);

  const selected = useApp((s) => s.selectedStudentIds);
  const toggleStudent = useApp((s) => s.toggleStudent);
  const clearSelection = useApp((s) => s.clearSelection);
  const selectAllOnline = useApp((s) => s.selectAllOnline);

  const setView = useApp((s) => s.setView);

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

  function unlock() {
    if (selected.size === 0) return;

    api.connectSocket().emit('student:unlock', {
      student_ids: [...selected],
    });
  }

  return (
    <>
      <div className="toolbar">
        <button onClick={selectAllOnline}>
          تحديد المتصلين
        </button>

        <button
          className="secondary"
          onClick={clearSelection}
        >
          إلغاء التحديد
        </button>

        <button
          onClick={lock}
          disabled={selected.size === 0}
        >
          قفل الأجهزة
        </button>

        <button
          className="secondary"
          onClick={unlock}
          disabled={selected.size === 0}
        >
          فك القفل
        </button>

        <button
          className="danger"
          onClick={() => setView('launch')}
          disabled={selected.size === 0}
        >
          بدء اختبار للمحددين ({selected.size})
        </button>
      </div>

      <div className="grid">
        {roster.map((s: any) => (
          <div
            key={s.id}
            className={`card tile ${
              selected.has(s.id) ? 'selected' : ''
            }`}
            onClick={() => toggleStudent(s.id)}
          >
            <div>
              <span
                className={`dot ${
                  s.online ? 'online' : 'offline'
                }`}
              />

              <strong>{s.display_name}</strong>
            </div>

            <div className="muted">
              @{s.username}
            </div>

            <div className="muted">
              {s.online
                ? s.ready
                  ? 'متصل — في الانتظار'
                  : 'متصل'
                : s.last_seen_at
                ? `آخر ظهور: ${new Date(
                    s.last_seen_at
                  ).toLocaleString('ar')}`
                : 'غير متصل'}
            </div>

            {s.ready &&
              s.online &&
              !s.locked && (
                <div
                  style={{
                    color: '#0f766e',
                  }}
                >
                  ● نشط ومنتظر المعلّم
                </div>
              )}

            {s.locked && (
              <div
                style={{
                  color: '#fbbf24',
                }}
              >
                ● مقفول
              </div>
            )}

            {s.suspicious && (
              <div className="error">
                ⚠ نشاط مشبوه
              </div>
            )}
          </div>
        ))}

        {roster.length === 0 && (
          <div className="muted">
            لا يوجد طلاب في هذا الصف.
          </div>
        )}
      </div>
    </>
  );
}