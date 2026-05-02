import React, { useEffect, useState } from 'react';
import { api } from './api';
import { Login } from './views/Login';
import { ExamList } from './views/ExamList';
import { ExamEditor } from './views/ExamEditor';

type View =
  | { name: 'login' }
  | { name: 'list' }
  | { name: 'edit'; examId: string | null };

export function App() {
  const [view, setView] = useState<View>(api.session ? { name: 'list' } : { name: 'login' });

  useEffect(() => {
    if (!api.session) setView({ name: 'login' });
  }, []);

  function logout() {
    api.logout();
    setView({ name: 'login' });
  }

  return (
    <div className="shell">
      <div className="topbar">
        <h1 style={{ fontSize: 16, margin: 0 }}>مصمم الاختبارات</h1>
        {api.session && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="muted">{api.session.user.display_name}</span>
            <button className="secondary" onClick={logout}>تسجيل خروج</button>
          </div>
        )}
      </div>
      <div className="body">
        {view.name === 'login' && (
          <Login onDone={() => setView({ name: 'list' })} />
        )}
        {view.name === 'list' && (
          <ExamList
            onNew={() => setView({ name: 'edit', examId: null })}
            onEdit={(id) => setView({ name: 'edit', examId: id })}
          />
        )}
        {view.name === 'edit' && (
          <ExamEditor
            examId={view.examId}
            onDone={() => setView({ name: 'list' })}
          />
        )}
      </div>
    </div>
  );
}
