import { useState } from 'react';
import { Profile } from '../api';
import { HEROES, heroById } from '../engine/heroes';
import { power } from '../engine/progression';
import { GearBag, HeroGearPanel } from './Gear';
import { HeroUpgrade } from './HeroUpgrade';
import { ItemIcon } from './Items';
import { HeroCard, HeroDetail, progOf } from './TeamSelect';

export function Collection({ profile, setProfile, onBack, topBar }: { profile: Profile; setProfile: (p: Profile & { gear?: import('../engine/gear').GearItem[] }) => void; onBack: () => void; topBar: React.ReactNode }) {
  const [filter, setFilter] = useState<0 | 3 | 4 | 5>(0);
  const [sel, setSel] = useState(profile.heroes[0]?.heroId ?? HEROES[0].id);
  const [bag, setBag] = useState(false);
  const owned = new Map(profile.heroes.map((h) => [h.heroId, h]));
  const list = HEROES.filter((h) => !filter || h.rarity === filter).sort(
    (a, b) =>
      Number(owned.has(b.id)) - Number(owned.has(a.id)) ||
      (owned.has(a.id) ? power(b, progOf(profile.heroes, b.id)) - power(a, progOf(profile.heroes, a.id)) : b.rarity - a.rarity),
  );
  const o = owned.get(sel);

  return (
    <div className="select-screen">
      {topBar}
      <div className="screen-title">
        <button className="btn-back" onClick={onBack}>
          ‹ Sảnh
        </button>
        <h2>
          Ninja · {owned.size}/{HEROES.length}
        </h2>
        <button className="btn-mini bag-btn" onClick={() => setBag(true)}>
          🎒 Túi đồ ({profile.gear?.length ?? 0})
        </button>
        <div className="inv-strip">
          {Object.entries(profile.inventory)
            .sort()
            .map(([id, q]) => (
              <ItemIcon key={id} id={id} qty={q} />
            ))}
        </div>
      </div>
      <main className="select-main two">
        <section className="panel roster">
          <div className="chips">
            {([0, 5, 4, 3] as const).map((r) => (
              <button key={r} className={`chip ${filter === r ? 'on' : ''}`} onClick={() => setFilter(r)}>
                {r ? `${r}★` : 'Tất cả'}
              </button>
            ))}
          </div>
          <div className="grid">
            {list.map((h) => (
              <div key={h.id} className={`coll-wrap ${owned.has(h.id) ? '' : 'locked'} ${sel === h.id ? 'sel' : ''}`}>
                <HeroCard hero={h} slot={-1} prog={owned.has(h.id) ? progOf(profile.heroes, h.id) : undefined} onClick={() => setSel(h.id)} onHover={() => {}} />
                {!owned.has(h.id) && <span className="lock">Chưa sở hữu</span>}
                {owned.has(h.id) && (owned.get(h.id)!.dupes ?? 0) > 0 && <span className="dupe-badge">+{owned.get(h.id)!.dupes}</span>}
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <HeroDetail hero={heroById(sel)} dupes={o?.dupes} progress={o ? progOf(profile.heroes, sel) : undefined}>
            {o && <HeroGearPanel heroId={sel} profile={profile} setProfile={setProfile} />}
            {o && <HeroUpgrade key={sel} owned={o} profile={profile} setProfile={setProfile} />}
          </HeroDetail>
          {!o && <p className="hint">Nhận ninja này qua Triệu Hồi.</p>}
        </section>
      </main>
      {bag && <GearBag profile={profile} setProfile={setProfile} onClose={() => setBag(false)} />}
    </div>
  );
}
