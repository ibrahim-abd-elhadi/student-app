import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

const params = new URLSearchParams(location.search);
const message = params.get('msg') || 'تم قفل الجهاز من قبل المعلّم';

function LockScreen() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="lock-screen">
      <div className="icon">🔒</div>
      <h1>{message}</h1>
      <div className="clock">{now.toLocaleTimeString('ar')}</div>
      <div className="muted">سيتم فك القفل عند سماح المعلّم.</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<LockScreen />);
