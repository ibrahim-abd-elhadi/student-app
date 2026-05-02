import React, { useState } from 'react';
import { api } from '../api';

export function Login({ onDone }: { onDone: () => void }) {
  const [base, setBase] = useState('http://127.0.0.1:8080');
  const [u, setU] = useState('tutor1');
  const [p, setP] = useState('Password123!');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const data = await api.login(base, u, p);
      if (data.user.role !== 'TUTOR' && data.user.role !== 'ADMIN') {
        api.logout();
        throw new Error('يجب تسجيل الدخول بحساب معلّم أو مسؤول.');
      }
      onDone();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? 'فشل');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="card" style={{ width: 360 }} onSubmit={submit}>
        <h2>تسجيل الدخول</h2>
        <div className="row"><label>الخادم</label>
          <input value={base} onChange={(e) => setBase(e.target.value)} required /></div>
        <div className="row"><label>اسم المستخدم</label>
          <input value={u} onChange={(e) => setU(e.target.value)} required /></div>
        <div className="row"><label>كلمة المرور</label>
          <input type="password" value={p} onChange={(e) => setP(e.target.value)} required /></div>
        {err && <div className="error" style={{ marginBottom: 8 }}>{err}</div>}
        <button type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? '...' : 'دخول'}
        </button>
      </form>
    </div>
  );
}
