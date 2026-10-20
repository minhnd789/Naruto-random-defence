import { CSSProperties, useEffect, useRef, useState } from 'react';
import { api, BannerInfo, Profile, PullResult } from '../api';
import { heroUrl } from '../battle/BattleScene';
import { ELEMENT_INFO, heroById } from '../engine/heroes';
import { Currency } from './TopBar';

const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 2 : 1).replace('.', ',')}%`;

export function Gacha({ profile, setProfile, onBack, topBar }: { profile: Profile; setProfile: (p: Profile) => void; onBack: () => void; topBar: React.ReactNode }) {
  const [banners, setBanners] = useState<BannerInfo[]>([]);
  const [sel, setSel] = useState<'premium' | 'normal'>('premium');
  const [results, setResults] = useState<PullResult[] | null>(null);
  const [lastCount, setLastCount] = useState<1 | 10>(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showRates, setShowRates] = useState(false);

  useEffect(() => {
    api.banners().then((r) => setBanners(r.banners)).catch((e) => setError(e.message));
  }, []);

  const b = banners.find((x) => x.id === sel);
  const pull = async (count: 1 | 10) => {
    if (!b || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.pull(b.id, count);
      setLastCount(count);
      setResults(r.results);
      setProfile(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const balance = b ? profile.user[b.currency] : 0;
  const pity = profile.pity[sel]?.pity ?? 0;

  return (
    <div className="gacha-screen">
      {topBar}
      <div className="screen-title">
        <button className="btn-back" onClick={onBack}>
          ‹ Sảnh
        </button>
        <h2>Triệu Hồi</h2>
      </div>
      <div className="gacha-main">
        <div className="banner-tabs">
          {banners.map((x) => (
            <button key={x.id} className={`banner-tab ${x.id} ${x.id === sel ? 'on' : ''}`} onClick={() => setSel(x.id)}>
              <img src={heroUrl(x.featured ? heroById(x.featured).image : 'Kakashi.webp')} alt="" draggable={false} />
              <b>{x.name}</b>
              <small>{x.currency === 'gems' ? 'Ngọc Chakra' : 'Cuộn Triệu Hồi'}</small>
            </button>
          ))}
        </div>

        {b && (
          <div className={`banner ${b.id}`}>
            <div className="banner-art">
              {b.featured ? (
                <img className="feat" src={heroUrl(heroById(b.featured).image)} alt="" draggable={false} />
              ) : (
                <>
                  <img className="trio t1" src={heroUrl('Hinata.webp')} alt="" draggable={false} />
                  <img className="trio t3" src={heroUrl('Gaara.webp')} alt="" draggable={false} />
                  <img className="trio t2" src={heroUrl('Kakashi.webp')} alt="" draggable={false} />
                </>
              )}
            </div>
            <div className="banner-info">
              {b.featured && <span className="rate-up">TĂNG TỈ LỆ</span>}
              <h1>{b.name}</h1>
              {b.featured && (
                <div className="feat-name">
                  {(() => {
                    const h = heroById(b.featured!);
                    return (
                      <>
                        <span style={{ color: ELEMENT_INFO[h.element].css }}>{ELEMENT_INFO[h.element].icon}</span> {h.name} · {h.title}
                      </>
                    );
                  })()}
                </div>
              )}
              <p>{b.desc}</p>
              <div className="rates">
                <span className="rt5">5★ {pct(b.rates['5'])}</span>
                <span className="rt4">4★ {pct(b.rates['4'])}</span>
                <span className="rt3">3★ {pct(b.rates['3'])}</span>
                <button className="btn-mini" onClick={() => setShowRates((v) => !v)}>
                  {showRates ? 'Ẩn danh sách' : 'Danh sách ninja'}
                </button>
              </div>
              {showRates && (
                <div className="pool-list">
                  {(['5', '4', '3'] as const).map((r) => (
                    <div key={r}>
                      <b className={`rt${r}`}>{r}★</b> {b.pools[r].map((id) => heroById(id).name).join(', ')}
                    </div>
                  ))}
                  {b.featured && <small>Khi ra 5★: {pct(b.featuredShare)} là {heroById(b.featured).name}.</small>}
                </div>
              )}
              {b.pityMax && (
                <div className="pity">
                  <div className="pity-head">
                    <span>Bảo hiểm</span>
                    <b>
                      {pity}/{b.pityMax}
                    </b>
                  </div>
                  <div className="pity-bar">
                    <i style={{ width: `${(pity / b.pityMax) * 100}%` }} />
                  </div>
                  <small>Còn {b.pityMax - pity} lượt nữa chắc chắn ra {heroById(b.featured!).name}</small>
                </div>
              )}
              <div className="pull-btns">
                {([1, 10] as const).map((n) => (
                  <button key={n} className={`btn-pull ${n === 10 ? 'ten' : ''}`} disabled={busy || balance < b.cost * n} onClick={() => pull(n)}>
                    <span>Triệu hồi x{n}</span>
                    <Currency kind={b.currency} value={b.cost * n} />
                  </button>
                ))}
              </div>
              {error && <div className="form-error">{error}</div>}
            </div>
          </div>
        )}
      </div>
      {results && (
        <SummonOverlay
          results={results}
          onClose={() => setResults(null)}
          onAgain={b && balance >= b.cost * lastCount ? () => pull(lastCount) : undefined}
          busy={busy}
        />
      )}
    </div>
  );
}

// ---------- Hoạt cảnh triệu hồi ----------
function SummonOverlay({ results, onClose, onAgain, busy }: { results: PullResult[]; onClose: () => void; onAgain?: () => void; busy: boolean }) {
  const top = Math.max(...results.map((r) => r.rarity));
  const [phase, setPhase] = useState<'circle' | 'cards'>('circle');
  const [revealed, setRevealed] = useState(0);
  const [spot, setSpot] = useState<PullResult | null>(null);
  const shownSpot = useRef(new Set<number>());

  // Kết quả mới (quay tiếp) thì chạy lại từ đầu
  useEffect(() => {
    setPhase('circle');
    setRevealed(0);
    setSpot(null);
    shownSpot.current = new Set();
    const t = setTimeout(() => setPhase('cards'), 1700);
    return () => clearTimeout(t);
  }, [results]);

  useEffect(() => {
    if (phase !== 'cards' || spot || revealed >= results.length) return;
    const t = setTimeout(() => {
      const r = results[revealed];
      if (r.rarity === 5 && !shownSpot.current.has(revealed)) {
        shownSpot.current.add(revealed);
        setSpot(r);
      }
      setRevealed((n) => n + 1);
    }, revealed === 0 ? 250 : 160);
    return () => clearTimeout(t);
  }, [phase, revealed, spot, results]);

  const done = phase === 'cards' && revealed >= results.length && !spot;
  const skip = () => {
    setPhase('cards');
    setRevealed(results.length);
  };

  return (
    <div className={`summon-overlay tier${top}`}>
      {phase === 'circle' && (
        <div className="summon-circle" onClick={skip}>
          <div className="ring r1" />
          <div className="ring r2" />
          <div className="ring r3" />
          <div className="seal">召</div>
          <div className="beam" />
          <p>Đang triệu hồi…</p>
        </div>
      )}
      {phase === 'cards' && (
        <div className={`summon-cards n${results.length}`}>
          {results.map((r, i) => {
            const h = heroById(r.heroId);
            const el = ELEMENT_INFO[h.element];
            return (
              <div key={i} className={`s-card r${r.rarity} ${i < revealed ? 'flip' : ''}`} style={{ '--el': el.css, animationDelay: `${i * 40}ms` } as CSSProperties}>
                <div className="s-inner">
                  <div className="s-back">
                    <span>忍</span>
                  </div>
                  <div className="s-front">
                    <img src={heroUrl(h.image)} alt={h.name} style={{ objectPosition: `${h.face[0]}% ${Math.max(0, h.face[1] - 6)}%` }} draggable={false} />
                    <span className="s-el">{el.icon}</span>
                    {r.isNew ? <span className="s-new">MỚI</span> : <span className="s-dupe">+1 mảnh</span>}
                    <div className="s-foot">
                      <span className="stars">{'★'.repeat(r.rarity)}</span>
                      <b>{h.name}</b>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {spot && <Spotlight r={spot} onNext={() => setSpot(null)} />}
      <div className="summon-actions">
        {!done && phase === 'cards' && !spot && (
          <button className="btn-ghost" onClick={skip}>
            Bỏ qua
          </button>
        )}
        {done && (
          <>
            {onAgain && (
              <button className="btn-fight small" onClick={onAgain} disabled={busy}>
                Triệu hồi tiếp x{results.length}
              </button>
            )}
            <button className="btn-ghost" onClick={onClose}>
              Xong
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Spotlight({ r, onNext }: { r: PullResult; onNext: () => void }) {
  const h = heroById(r.heroId);
  const el = ELEMENT_INFO[h.element];
  return (
    <div className="spotlight" style={{ '--el': el.css } as CSSProperties} onClick={onNext}>
      <div className="sp-rays" />
      <img src={heroUrl(h.image)} alt={h.name} draggable={false} />
      <div className="sp-text">
        <span className="stars big">★★★★★</span>
        <h1>{h.name}</h1>
        <p>
          {h.title} · <span style={{ color: el.css }}>{el.icon} {el.name}</span>
        </p>
        {r.isNew && <span className="sp-new">NINJA MỚI!</span>}
        {r.pityHit && <span className="sp-pity">Bảo hiểm kích hoạt</span>}
        <small>Chạm để tiếp tục</small>
      </div>
    </div>
  );
}
