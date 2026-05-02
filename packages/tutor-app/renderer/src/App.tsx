import React, { useEffect } from 'react';
import { useApp } from './store';
import { api } from './api';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { LaunchView } from './views/LaunchView';
import { MonitorView } from './views/MonitorView';
import { ReportView } from './views/ReportView';

export function App() {
  const view = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);
  const setUser = useApp((s) => s.setUser);

  useEffect(() => {
    const s = api.session;
    if (s && s.user.role === 'TUTOR') {
      setUser({
        id: s.user.id,
        display_name: s.user.display_name,
        classroom_id: s.user.classroom_id,
      });
      setView('dashboard');
    }
  }, [setUser, setView]);

  return (
    <div className="shell">
      <TopBar />
      <div className="body">
        {view === 'login' && <LoginView />}
        {view === 'dashboard' && <DashboardView />}
        {view === 'launch' && <LaunchView />}
        {view === 'monitor' && <MonitorView />}
        {view === 'report' && <ReportView />}
      </div>
    </div>
  );
}

function TopBar() {
  const user = useApp((s) => s.user);
  const setUser = useApp((s) => s.setUser);
  const setView = useApp((s) => s.setView);

  function logout() {
    api.logout();
    setUser(null);
    setView('login');
  }

  return (
    <div className="topbar">
      <h1>منصة المعلّم — التحكم بالصف</h1>
      {user && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="muted">{user.display_name}</span>
          <button className="secondary" onClick={logout}>تسجيل خروج</button>
        </div>
      )}
    </div>
  );
  
}
