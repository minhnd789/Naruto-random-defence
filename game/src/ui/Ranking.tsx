import { CSSProperties, useEffect, useState } from 'react';
import { api, LeaderRow } from '../api';
import { tierOf } from '../engine/ranking';

export function TierBadge({ rating, big }: { rating: number; big?: boolean }) {
  const t = tierOf(rating);
  return (
    <span className={`tier-badge ${big ? 'big' : ''}`} style={{ '--tc': t.color } as CSSProperties} title={`${t.name} (từ ${t.min} điểm)`}>
      <i>{t.icon}</i>
      {t.name}
    </span>
  );
}

export function useCountdown(target: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, target - now);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return { ms, text: d > 0 ? `${d} ngày ${h} giờ` : h > 0 ? `${h} giờ ${m} phút` : `${m}:${String(s).padStart(2, '0')}` };
}

export function Leaderboard({ type, myId }: { type: 'arena' | 'rta'; myId: number }) {
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api
      .leaderboard(type)
      .then((r) => setRows(r.rows))
      .catch((e) => setErr(e.message));
  }, [type]);
  if (err) return <div className="form-error">{err}</div>;
  if (!rows) return <p className="muted">Đang tải…</p>;
  if (!rows.length) return <p className="muted">Chưa có ai trên bảng xếp hạng mùa này.</p>;
  return (
    <div className="lb">
      {rows.map((r) => (
        <div key={r.userId} className={`lb-row ${r.userId === myId ? 'me' : ''} ${r.rank <= 3 ? `top${r.rank}` : ''}`}>
          <b className="lb-rank">{r.rank}</b>
          <span className="lb-name">{r.name}</span>
          <TierBadge rating={r.rating} />
          <b className="lb-rating">{r.rating}</b>
          <small className="muted">
            {r.wins}T · {r.losses}B
          </small>
        </div>
      ))}
    </div>
  );
}
