import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { api, Profile } from '../api';
import { GEAR_SLOTS, GearItem, GearSlot, RARITIES, SALVAGE_COINS, SLOT_INFO, formatStat, gearName, gearScore, gearVariant } from '../engine/gear';
import { heroById } from '../engine/heroes';
import { Portrait } from './Portrait';

type SetProfile = (p: Profile & { gear?: GearItem[] }) => void;

export const rarityCss = (r: number) => RARITIES[r].color;

// Danh sách mẫu đã có hình (tools/build_assets.py ghi ra); mẫu chưa có hình dùng chữ Hán của ô
let gearArt: Set<string> | null = null;
let gearArtLoad: Promise<Set<string>> | null = null;
function loadGearArt() {
  gearArtLoad ??= fetch('/gear/manifest.json')
    .then((r) => (r.ok ? r.json() : { gear: [] }))
    .catch(() => ({ gear: [] }))
    .then((m: { gear: string[] }) => (gearArt = new Set(m.gear)));
  return gearArtLoad;
}
function useGearArt() {
  const [art, setArt] = useState(gearArt);
  useEffect(() => {
    if (!art) loadGearArt().then(setArt);
  }, [art]);
  return art;
}

/** Ô vuông trang bị: khung màu phẩm chất (Thần Thoại viền cầu vồng), biểu tượng loại đồ, cấp đồ. */
export function GearIcon({ item, slot, size = 56, onClick, selected }: { item?: GearItem | null; slot?: GearSlot; size?: number; onClick?: () => void; selected?: boolean }) {
  const s = item?.slot ?? slot!;
  const r = item?.rarity ?? -1;
  const art = useGearArt();
  const [broken, setBroken] = useState(false);
  const img = item && !broken && art?.has(item.variant) ? `/gear/${item.variant}.webp` : null;
  return (
    <button
      className={`gear-icon ${item ? `r${r}` : 'empty'} ${selected ? 'sel' : ''}`}
      style={{ width: size, height: size, '--rc': item ? rarityCss(r) : '#3a3340' } as CSSProperties}
      onClick={onClick}
      title={item ? `${gearName(item)} · ${RARITIES[item.rarity].name} · cấp ${item.ilvl}` : `${SLOT_INFO[s].name}: trống`}
    >
      {img ? (
        <img className="gi-img" src={img} alt="" draggable={false} onError={() => setBroken(true)} />
      ) : (
        <span className="gi-k" style={{ fontSize: size * 0.42 }}>
          {SLOT_INFO[s].icon}
        </span>
      )}
      {item && <span className="gi-lv">{item.ilvl}</span>}
      {item?.heroId && <Portrait hero={heroById(item.heroId)} size={size * 0.38} className="gi-owner" />}
      {!item && <small className="gi-name">{SLOT_INFO[s].name}</small>}
    </button>
  );
}

export function GearDetail({ item }: { item: GearItem }) {
  const r = RARITIES[item.rarity];
  const v = gearVariant(item);
  return (
    <div className={`gear-detail r${item.rarity}`} style={{ '--rc': rarityCss(item.rarity) } as CSSProperties}>
      <div className="gd-head">
        <GearIcon item={item} size={52} />
        <div>
          <b className="gd-rarity">{gearName(item)}</b>
          <span>
            {r.name} · {SLOT_INFO[item.slot].name} · cấp {item.ilvl}
          </span>
        </div>
      </div>
      <div className="gd-main">
        {item.main.map((l, i) => (
          <b key={i}>{formatStat(l)}</b>
        ))}
      </div>
      {item.subs.length > 0 && (
        <div className="gd-subs">
          {item.subs.map((l, i) => (
            <span key={i}>{formatStat(l)}</span>
          ))}
        </div>
      )}
      {v?.desc && <p className="gd-desc">{v.desc}</p>}
      {item.heroId && <small className="muted">Đang mặc: {heroById(item.heroId).name}</small>}
    </div>
  );
}

/** 8 ô trang bị của một ninja; bấm ô để chọn đồ mặc / tháo. */
export function HeroGearPanel({ heroId, profile, setProfile }: { heroId: string; profile: Profile; setProfile: SetProfile }) {
  const gear = profile.gear ?? [];
  const [open, setOpen] = useState<GearSlot | null>(null);
  const worn = (slot: GearSlot) => gear.find((g) => g.heroId === heroId && g.slot === slot) ?? null;
  return (
    <div className="hero-gear">
      <div className="up-head">
        <b>Trang bị</b>
        <span className="muted small">Bấm ô để mặc / đổi đồ</span>
      </div>
      <div className="hg-grid">
        {GEAR_SLOTS.map((slot) => (
          <GearIcon key={slot} slot={slot} item={worn(slot)} size={58} onClick={() => setOpen(slot)} />
        ))}
      </div>
      {open && <GearPicker heroId={heroId} slot={open} profile={profile} setProfile={setProfile} onClose={() => setOpen(null)} />}
    </div>
  );
}

function GearPicker({ heroId, slot, profile, setProfile, onClose }: { heroId: string; slot: GearSlot; profile: Profile; setProfile: SetProfile; onClose: () => void }) {
  const gear = profile.gear ?? [];
  const current = gear.find((g) => g.heroId === heroId && g.slot === slot) ?? null;
  const list = gear.filter((g) => g.slot === slot && g.id !== current?.id).sort((a, b) => gearScore(b) - gearScore(a));
  const [sel, setSel] = useState<GearItem | null>(list[0] ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (fn: () => Promise<Profile & { gear: GearItem[] }>) => {
    setBusy(true);
    setErr('');
    try {
      setProfile(await fn());
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal gear-picker" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            {SLOT_INFO[slot].name} · {heroById(heroId).name}
          </h3>
          <button className="inspect-x" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="gp-body">
          <div className="gp-side">
            <small className="muted">Đang mặc</small>
            {current ? <GearDetail item={current} /> : <p className="muted">Chưa có đồ ở ô này.</p>}
            {current && (
              <button className="btn-ghost" disabled={busy} onClick={() => run(() => api.unequipGear(current.id))}>
                Tháo ra
              </button>
            )}
          </div>
          <div className="gp-side">
            <small className="muted">Chọn đồ ({list.length})</small>
            <div className="gp-list">
              {list.map((g) => (
                <GearIcon key={g.id} item={g} size={52} selected={sel?.id === g.id} onClick={() => setSel(g)} />
              ))}
              {!list.length && <p className="muted">Chưa có {SLOT_INFO[slot].name.toLowerCase()} nào. Vượt ải và bí cảnh để nhận thêm.</p>}
            </div>
            {sel && <GearDetail item={sel} />}
            {sel && (
              <button className="btn-fight small" disabled={busy} onClick={() => run(() => api.equipGear(sel.id, heroId))}>
                {sel.heroId ? `Lấy từ ${heroById(sel.heroId).name} và mặc` : 'Mặc vào'}
              </button>
            )}
          </div>
        </div>
        {err && <div className="form-error">{err}</div>}
      </div>
    </div>
  );
}

/** Túi đồ: xem toàn bộ trang bị, chọn nhiều món chưa mặc để phân giải lấy Xu. */
export function GearBag({ profile, setProfile, onClose }: { profile: Profile; setProfile: SetProfile; onClose: () => void }) {
  const gear = profile.gear ?? [];
  const [slot, setSlot] = useState<GearSlot | 'all'>('all');
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [view, setView] = useState<GearItem | null>(null);
  const [msg, setMsg] = useState('');
  const shown = useMemo(() => gear.filter((g) => slot === 'all' || g.slot === slot), [gear, slot]);
  const coins = [...picked].reduce((s, id) => s + SALVAGE_COINS[gear.find((g) => g.id === id)?.rarity ?? 0], 0);
  const toggle = (g: GearItem) => {
    setView(g);
    if (g.heroId) return; // đồ đang mặc không chọn phân giải được
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(g.id)) n.delete(g.id);
      else n.add(g.id);
      return n;
    });
  };
  const quickPick = (maxRarity: number) =>
    setPicked(new Set(gear.filter((g) => !g.heroId && g.rarity <= maxRarity && (slot === 'all' || g.slot === slot)).map((g) => g.id)));
  const salvage = async () => {
    try {
      const r = await api.salvageGear([...picked]);
      setProfile(r);
      setMsg(`Đã phân giải ${picked.size} món, nhận ${r.coins.toLocaleString('vi-VN')} Xu`);
      setPicked(new Set());
      setView(null);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal gear-bag" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Túi đồ · {gear.length} món</h3>
          <button className="inspect-x" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="chips">
          <button className={`chip ${slot === 'all' ? 'on' : ''}`} onClick={() => setSlot('all')}>
            Tất cả
          </button>
          {GEAR_SLOTS.map((s) => (
            <button key={s} className={`chip ${slot === s ? 'on' : ''}`} onClick={() => setSlot(s)}>
              {SLOT_INFO[s].icon} {SLOT_INFO[s].name}
            </button>
          ))}
        </div>
        <div className="gb-body">
          <div className="gb-grid">
            {shown.map((g) => (
              <div key={g.id} className={`gb-cell ${picked.has(g.id) ? 'picked' : ''}`}>
                <GearIcon item={g} size={60} selected={view?.id === g.id} onClick={() => toggle(g)} />
              </div>
            ))}
            {!shown.length && <p className="muted">Không có trang bị.</p>}
          </div>
          <div className="gb-side">
            {view ? <GearDetail item={view} /> : <p className="muted">Bấm một món để xem chỉ số. Món chưa mặc sẽ được chọn để phân giải.</p>}
            <div className="gb-actions">
              <button className="btn-mini" onClick={() => quickPick(0)}>
                Chọn đồ Thường
              </button>
              <button className="btn-mini" onClick={() => quickPick(1)}>
                Chọn ≤ Tinh Anh
              </button>
              <button className="btn-mini" onClick={() => setPicked(new Set())}>
                Bỏ chọn
              </button>
            </div>
            <button className="btn-fight small" disabled={!picked.size} onClick={salvage}>
              Phân giải {picked.size} món → {coins.toLocaleString('vi-VN')} Xu
            </button>
            {msg && <div className="form-ok">{msg}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
