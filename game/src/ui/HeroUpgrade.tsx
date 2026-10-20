import { useState } from 'react';
import { api, OwnedHero, Profile } from '../api';
import { ELEMENT_INFO, heroById } from '../engine/heroes';
import {
  AWAKEN_COST,
  COINS_PER_BOOK,
  MAX_AWAKEN,
  MAX_STARS,
  STAR_COST,
  booksToMax,
  expToNext,
  maxLevel,
  runeId,
} from '../engine/progression';
import { ItemIcon } from './Items';
import { Currency } from './TopBar';

export function HeroUpgrade({ owned, profile, setProfile }: { owned: OwnedHero; profile: Profile; setProfile: (p: Profile) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const hero = heroById(owned.heroId);
  const inv = profile.inventory;
  const books = inv.exp_book ?? 0;
  const cap = maxLevel(owned.stars);
  const atCap = owned.level >= cap;
  const toMax = booksToMax(owned);

  const run = async (fn: () => Promise<Profile>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      setProfile(await fn());
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const useBooks = (n: number) => run(() => api.levelUp(owned.heroId, n), 'Đã dùng Cuộn Kinh Nghiệm');

  // Nâng sao
  const starCost = owned.stars < MAX_STARS ? STAR_COST[owned.stars] : null;
  const shardsHave = owned.dupes + (inv.soul_stone ?? 0);
  // Thức tỉnh
  const awCost = owned.awaken < MAX_AWAKEN ? AWAKEN_COST[owned.awaken + 1] : null;
  const rune = runeId(hero.element);

  return (
    <div className="upgrade">
      <div className="up-block">
        <div className="up-head">
          <b>Cấp độ</b>
          <span>
            Lv {owned.level}/{cap}
          </span>
        </div>
        <div className="exp-bar">
          <i style={{ width: atCap ? '100%' : `${(owned.exp / expToNext(owned.level)) * 100}%` }} />
          <small>{atCap ? 'Đã đạt cấp tối đa của số sao hiện tại' : `${owned.exp.toLocaleString('vi-VN')} / ${expToNext(owned.level).toLocaleString('vi-VN')} EXP`}</small>
        </div>
        <div className="up-row">
          <ItemIcon id="exp_book" qty={books} />
          <span className="muted small">{COINS_PER_BOOK} Xu / sách</span>
        </div>
        <div className="up-btns">
          <button className="btn-up" disabled={busy || atCap || books < 1} onClick={() => useBooks(1)}>
            +1 sách
          </button>
          <button className="btn-up" disabled={busy || atCap || books < 1} onClick={() => useBooks(10)}>
            +10 sách
          </button>
          <button className="btn-up gold" disabled={busy || atCap || books < 1} onClick={() => useBooks(toMax)}>
            Lên tối đa ({Math.min(toMax, books)} sách)
          </button>
        </div>
      </div>

      <div className="up-block">
        <div className="up-head">
          <b>Nâng sao</b>
          <span className="stars">
            {'★'.repeat(owned.stars)}
            <i className="dim">{'★'.repeat(MAX_STARS - owned.stars)}</i>
          </span>
        </div>
        {starCost ? (
          <>
            <p className="muted small">
              Cấp tối đa tăng lên {maxLevel(owned.stars + 1)}, chỉ số +10%. Cần đạt Lv {cap}. Mảnh linh hồn của ninja dùng trước, phần thiếu dùng Linh Hồn Thạch.
            </p>
            <div className="up-row">
              <span className={`req ${atCap ? 'ok' : ''}`}>Lv {cap}</span>
              <span className={`req ${shardsHave >= starCost.shards ? 'ok' : ''}`}>
                Mảnh {owned.dupes} + <ItemIcon id="soul_stone" qty={inv.soul_stone ?? 0} /> / {starCost.shards}
              </span>
              <Currency kind="coins" value={starCost.coins} />
            </div>
            <button
              className="btn-up gold"
              disabled={busy || !atCap || shardsHave < starCost.shards || profile.user.coins < starCost.coins}
              onClick={() => run(() => api.starUp(owned.heroId), `${hero.name} đã lên ${owned.stars + 1}★!`)}
            >
              Nâng lên {owned.stars + 1}★
            </button>
          </>
        ) : (
          <p className="muted small">Đã đạt sao tối đa.</p>
        )}
      </div>

      <div className="up-block">
        <div className="up-head">
          <b>Thức tỉnh</b>
          <span className="awk-row">
            {Array.from({ length: MAX_AWAKEN }, (_, i) => (
              <i key={i} className={i < owned.awaken ? 'on' : ''} style={{ color: ELEMENT_INFO[hero.element].css }}>
                ◆
              </i>
            ))}
          </span>
        </div>
        {awCost ? (
          <>
            <p className="muted small">
              Bậc {owned.awaken + 1}: chỉ số +6%, tốc độ +2{owned.awaken + 1 === 3 ? ', chí mạng +5%' : ''}.
            </p>
            <div className="up-row">
              <span className={`req ${owned.level >= awCost.level ? 'ok' : ''}`}>Lv {awCost.level}</span>
              <ItemIcon id={rune} qty={inv[rune] ?? 0} need={awCost.runes} />
              <Currency kind="coins" value={awCost.coins} />
            </div>
            <button
              className="btn-up gold"
              disabled={busy || owned.level < awCost.level || (inv[rune] ?? 0) < awCost.runes || profile.user.coins < awCost.coins}
              onClick={() => run(() => api.awaken(owned.heroId), `${hero.name} thức tỉnh bậc ${owned.awaken + 1}!`)}
            >
              Thức tỉnh bậc {owned.awaken + 1}
            </button>
          </>
        ) : (
          <p className="muted small">Đã thức tỉnh tối đa.</p>
        )}
      </div>
      {msg && <div className={msg.ok ? 'form-ok' : 'form-error'}>{msg.text}</div>}
    </div>
  );
}
