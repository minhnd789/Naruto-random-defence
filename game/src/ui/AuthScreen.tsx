import { FormEvent, useState } from 'react';
import { api, Profile, setToken } from '../api';
import { heroUrl } from '../battle/BattleScene';

export function AuthScreen({ onAuthed }: { onAuthed: (p: Profile) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = mode === 'login' ? await api.login(username, password) : await api.register(username, password);
      setToken(r.token);
      onAuthed(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <img className="auth-art left" src={heroUrl('Naruto_Sage_Mode.webp')} alt="" draggable={false} />
      <img className="auth-art right" src={heroUrl('Sasuke_EMS.webp')} alt="" draggable={false} />
      <form className="auth-card" onSubmit={submit}>
        <div className="logo center">
          <span className="logo-k">忍</span>
          <div>
            <h1>NINJA ĐẤU TRƯỜNG</h1>
            <p>Triệu hồi ninja · xếp đội hình · chinh phục đấu trường</p>
          </div>
        </div>
        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
            Đăng nhập
          </button>
          <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>
            Tạo tài khoản
          </button>
        </div>
        <label>
          Tên đăng nhập
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="3–20 ký tự: chữ, số, _" autoFocus />
        </label>
        <label>
          Mật khẩu
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="Tối thiểu 6 ký tự"
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="btn-fight" disabled={busy || !username || !password}>
          {busy ? 'Đang xử lý…' : mode === 'login' ? 'VÀO GAME' : 'TẠO TÀI KHOẢN'}
        </button>
        {mode === 'register' && <p className="hint center">Tài khoản mới nhận 5 ninja 4★, 3.000 Ngọc Chakra và 20 Cuộn Triệu Hồi.</p>}
      </form>
    </div>
  );
}
