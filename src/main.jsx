import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Sprout, RefreshCw } from 'lucide-react';
import App from './App';
import { loadCatalog } from './data/catalog';
import './styles.css';
function Boot() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadCatalog().then(() => { if (active) setLoaded(true); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [attempt]);
  if (loaded) return <App/>;
  return <main className="boot-screen"><span className="brand-icon"><Sprout size={30}/></span><h1>{error ? 'Khu vườn cần thêm một chút thời gian' : 'Đang chuẩn bị khu vườn của bạn…'}</h1><p>{error || 'Hàng ngàn từ mới đang chờ bạn khám phá.'}</p>{error && <button className="btn primary" onClick={() => { setError(''); setAttempt(a => a + 1); }}><RefreshCw size={16}/>Thử lại</button>}</main>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><Boot/></React.StrictMode>);
