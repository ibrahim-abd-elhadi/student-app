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
  const setRoster = useApp((s) => s.setRoster);
  const upsertPresence = useApp((s) => s.upsertPresence);

  useEffect(() => {
    const s = api.session;
    if (s && s.user.role === 'TUTOR') {
      setUser({
        id: s.user.id,
        display_name: s.user.display_name,
        classroom_id: s.user.classroom_id,
      });
      setView('dashboard');

      // Connect to WebSocket for real-time updates
      try {
        const socket = api.connectSocket();
        
        // Receive initial roster with online status
        socket.on('presence:sync', (students: Array<{ user_id: string; online: boolean; last_seen_at: string | null }>) => {
          console.debug('[tutor] presence:sync received', students);
          setRoster(
            students.map((s) => ({
              id: s.user_id,
              username: '', // Will be filled from other sources if needed
              display_name: '', // Will be filled from other sources if needed
              online: s.online,
              last_seen_at: s.last_seen_at,
            }))
          );
        });

        // Listen for real-time presence updates
        socket.on('presence:update', (update: { user_id: string; online: boolean; last_seen_at: string | null }) => {
          console.debug('[tutor] presence:update received', update);
          upsertPresence(update.user_id, update.online, update.last_seen_at);
        });
      } catch (err) {
        console.warn('Failed to connect to WebSocket:', err);
      }
    }
  }, [setUser, setView, setRoster, upsertPresence]);

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
