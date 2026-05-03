import React, { useState } from 'react';
import { api } from '../api';
import { useApp } from '../store';

export function LoginView() {
  const setUser = useApp((s) => s.setUser);
  const setView = useApp((s) => s.setView);

  const [username, setUsername] = useState('tutor1');
  const [password, setPassword] = useState('Password123!');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    setBusy(true);
    setErr(null);

    try {
      const s = await api.login(username, password);

      if (s.user.role !== 'TUTOR' && s.user.role !== 'ADMIN') {
        api.logout();
        throw new Error('هذا التطبيق مخصص للمعلمين فقط.');
      }

      // connect realtime websocket
      api.connectSocket();

      setUser({
        id: s.user.id,
        display_name: s.user.display_name,
        classroom_id: s.user.classroom_id,
      });

      setView('dashboard');

    } catch (e: any) {
      setErr(
        e?.response?.data?.message ??
        e?.message ??
        'فشل تسجيل الدخول'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="card login-card" onSubmit={submit}>
        <h2>تسجيل الدخول</h2>

        <div className="row">
          <label>اسم المستخدم</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="row">
          <label>كلمة المرور</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {err && (
          <div className="error" style={{ marginBottom: 8 }}>
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{ width: '100%' }}
        >
          {busy ? 'جارٍ ...' : 'دخول'}
        </button>
      </form>
    </div>
  );
}