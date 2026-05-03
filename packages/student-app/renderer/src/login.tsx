import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { login } from './api';
import { startHost } from './host';
import './styles.css';

const isHost = new URLSearchParams(location.search).get('mode') === 'host';

function LoginCard() {
  const [base, setBase] = useState('http://127.0.0.1:8080');
  const [username, setUsername] = useState('student1');
  const [password, setPassword] = useState('Password123!');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const data = await login(base, username, password);
      if (data.user.role !== 'STUDENT') {
        throw new Error('هذا التطبيق مخصص للطلاب فقط.');
      }
      if (window.studentApi?.loginComplete) {
        await window.studentApi.loginComplete({
          base_url: base,
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          user: {
            id: data.user.id,
            display_name: data.user.display_name,
            classroom_id: data.user.classroom_id,
          },
        });
      } else {
        console.log("LOGIN SUCCESS:", data);
        alert("Login success (Electron bridge missing)");
      }
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? 'فشل');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="card" style={{ width: 360 }} onSubmit={submit}>
        <h2>تسجيل دخول الطالب</h2>
        <div className="row">
          <label>عنوان الخادم</label>
          <input value={base} onChange={(e) => setBase(e.target.value)} required />
        </div>
        <div className="row">
          <label>اسم المستخدم</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="row">
          <label>كلمة المرور</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err && <div className="error" style={{ marginBottom: 8 }}>{err}</div>}
        <button type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? '...' : 'دخول'}
        </button>
      </form>
    </div>
  );
}

function HostStatus() {
  return (
    <div className="center">
      <div className="muted">جلسة الطالب نشطة في الخلفية. تحت تصرف المعلّم.</div>
    </div>
  );
}

if (isHost) {
  void startHost();
  ReactDOM.createRoot(document.getElementById('root')!).render(<HostStatus />);
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(<LoginCard />);
}