import { CSSProperties, ReactNode, useState } from 'react';
import { OwnedHero } from '../api';
import { heroUrl } from '../battle/BattleScene';
import { ELEMENT_INFO, HEROES, ROLE_NAME, heroById } from '../engine/heroes';
import { HeroProgress, MAX_AWAKEN, UnitSetup, computeStats, power } from '../engine/progression';
import { HeroDef } from '../engine/types';
import { Portrait } from './Portrait';
import { SkillIcon } from './SkillIcon';

export const ENEMY_PRESETS: { id: string; name: string; desc: string; heroes: string[] }[] = [
  { id: 'akatsuki', name: 'Akatsuki Tập Kích', desc: 'Khống chế mạnh, nhiều sát thương diện rộng', heroes: ['kisame', 'pain', 'itachi', 'madara', 'sasuke_ems'] },
  { id: 'kage', name: 'Hội Nghị Ngũ Ảnh', desc: 'Phòng thủ chắc, hồi máu liên tục', heroes: ['gaara', 'tsunade', 'minato', 'naruto_sage', 'hinata'] },
  { id: 'team7', name: 'Đội 7 Huyền Thoại', desc: 'Tốc độ cao, dồn sát thương đơn mục tiêu', heroes: ['kakashi', 'naruto_sage', 'sasuke_ems', 'sakura', 'minato'] },
];

const SLOT_LABEL = ['Trước 1', 'Trước 2', 'Sau 1', 'Sau 2', 'Sau 3'];

export function Stars({ n, awaken = 0 }: { n: number; awaken?: number }) {
  return (
    <span className="stars">
      {'★'.repeat(n)}
      {awaken > 0 && <i className="awk">{'◆'.repeat(awaken)}</i>}
    </span>
  );
}

export function HeroCard({
  hero,
  slot,
  onClick,
  onHover,
  prog,
  draggable,
}: {
  hero: HeroDef;
  slot: number;
  onClick: () => void;
  onHover: () => void;
  prog?: HeroProgress;
  draggable?: boolean;
}) {
  const el = ELEMENT_INFO[hero.element];
  return (
    <button
      className={`hero-card r${hero.rarity} ${slot >= 0 ? 'picked' : ''}`}
      style={{ '--el': el.css } as CSSProperties}
      draggable={draggable}
      onDragStart={draggable ? (e) => e.dataTransfer.setData('text/hero', hero.id) : undefined}
      onClick={onClick}
      onMouseEnter={onHover}
      onFocus={onHover}
    >
      <img src={heroUrl(hero.image)} alt={hero.name} style={{ objectPosition: `${hero.face[0]}% ${Math.max(0, hero.face[1] - 6)}%` }} draggable={false} />
      <span className="el-badge">{el.icon}</span>
      <span className="role">{ROLE_NAME[hero.role]}</span>
      {slot >= 0 && <span className="slot-no">{SLOT_LABEL[slot]}</span>}
      <span className="card-foot">
        <Stars n={prog?.stars ?? hero.rarity} awaken={prog?.awaken} />
        <b>
          {hero.name}
          {prog && <em className="lv"> Lv{prog.level}</em>}
        </b>
        <small>{hero.title}</small>
      </span>
    </button>
  );
}

export function HeroDetail({ hero, dupes, progress, children }: { hero: HeroDef; dupes?: number; progress?: HeroProgress; children?: ReactNode }) {
  const el = ELEMENT_INFO[hero.element];
  const s = progress ? computeStats(hero, progress) : hero.stats;
  return (
    <div className="detail" style={{ '--el': el.css } as CSSProperties}>
      <div className="detail-head">
        <Portrait hero={hero} size={64} className="detail-face" />
        <div>
          <Stars n={progress?.stars ?? hero.rarity} awaken={progress?.awaken} />
          <h3>
            {hero.name} {progress && <span className="lv-big">Lv {progress.level}</span>}
          </h3>
          <div className="muted">
            {hero.title} · <span style={{ color: el.css }}>{el.icon} {el.name}</span> · {ROLE_NAME[hero.role]}
          </div>
          {progress && <div className="power">Lực chiến {power(hero, progress).toLocaleString('vi-VN')}</div>}
          {dupes !== undefined && <div className="dupes">Mảnh linh hồn: {dupes}</div>}
        </div>
      </div>
      <div className="stat-grid">
        <span>Máu</span><b>{s.hp.toLocaleString('vi-VN')}</b>
        <span>Công</span><b>{s.atk.toLocaleString('vi-VN')}</b>
        <span>Thủ</span><b>{s.def.toLocaleString('vi-VN')}</b>
        <span>Tốc độ</span><b>{s.spd}</b>
        <span>Chí mạng</span><b>{Math.round(s.crit * 100)}%</b>
        <span>ST chí mạng</span><b>{Math.round(s.critDmg * 100)}%</b>
        <span>Hiệu lực</span><b>{Math.round(s.eff * 100)}%</b>
        <span>Kháng</span><b>{Math.round(s.res * 100)}%</b>
      </div>
      {children}
      <div className="skills">
        {hero.skills.map((sk) => (
          <div key={sk.id} className={`skill-row s${sk.slot}`}>
            <span className="skill-ico">
              <SkillIcon skill={sk} element={hero.element} size={38} />
              <i>{sk.slot === 3 ? '奥' : sk.slot}</i>
            </span>
            <div>
              <b>{sk.name}</b> {sk.cd > 0 && <small className="cd">Hồi {sk.cd} lượt</small>}
              <p>{sk.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const progOf = (owned: OwnedHero[], id: string): HeroProgress => {
  const o = owned.find((h) => h.heroId === id);
  return o ? { level: o.level, stars: o.stars, awaken: o.awaken } : { level: 1, stars: heroById(id).rarity, awaken: 0 };
};
export const teamPower = (setups: UnitSetup[]) => setups.reduce((s, u) => s + power(heroById(u.heroId), u), 0);

export interface Mission {
  title: string;
  subtitle: string;
  enemies: UnitSetup[];
  stamina: number;
}

export function EnemyRow({ enemies }: { enemies: UnitSetup[] }) {
  return (
    <div className="enemy-row">
      {enemies.map((e, i) => (
        <div key={i} className="enemy-chip" title={`${heroById(e.heroId).name} Lv${e.level}`}>
          <Portrait hero={heroById(e.heroId)} size={44} className="mini-face" />
          <small>Lv{e.level}</small>
          <i className="awk-stars">{'★'.repeat(e.stars)}</i>
        </div>
      ))}
    </div>
  );
}

export function TeamSelect({
  owned,
  initial,
  mission,
  stamina,
  onStart,
  onBack,
  backLabel = 'Sảnh',
  topBar,
  busy,
  error,
}: {
  owned: OwnedHero[];
  initial: string[];
  mission: Mission | null; // null = luyện tập (chọn đội địch mẫu, không tốn thể lực, không thưởng)
  stamina: number;
  onStart: (team: string[], practiceEnemy?: string[]) => void;
  onBack: () => void;
  backLabel?: string;
  topBar: ReactNode;
  busy?: boolean;
  error?: string;
}) {
  const ownedIds = owned.map((o) => o.heroId);
  const roster = HEROES.filter((h) => ownedIds.includes(h.id)).sort((a, b) => power(b, progOf(owned, b.id)) - power(a, progOf(owned, a.id)));
  const [team, setTeam] = useState<(string | null)[]>(() => [...initial.filter((id) => ownedIds.includes(id)), null, null, null, null, null].slice(0, 5));
  const [enemy, setEnemy] = useState(ENEMY_PRESETS[0].id);
  const [hover, setHover] = useState<HeroDef>(heroById(initial[0] ?? roster[0].id));
  const [picked, setPicked] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const toggle = (id: string) => {
    setTeam((t) => {
      const i = t.indexOf(id);
      const next = [...t];
      if (i >= 0) next[i] = null;
      else {
        const free = next.indexOf(null);
        if (free < 0) return t;
        next[free] = id;
      }
      return next;
    });
  };
  const full = team.every(Boolean);
  const mySetups: UnitSetup[] = team.filter(Boolean).map((id) => ({ heroId: id!, ...progOf(owned, id!) }));
  const myPower = teamPower(mySetups);
  const enemyPower = mission ? teamPower(mission.enemies) : 0;
  const lackStamina = mission ? stamina < mission.stamina : false;

  /** Đặt ninja vào ô i; nếu ninja đã ở ô khác thì hai ô đổi chỗ cho nhau. */
  const place = (heroId: string, i: number) =>
    setTeam((t) => {
      const next = [...t];
      const from = next.indexOf(heroId);
      if (from >= 0) next[from] = next[i];
      next[i] = heroId;
      return next;
    });
  const swap = (a: number, b: number) =>
    setTeam((t) => {
      const next = [...t];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });

  const slotView = (i: number) => {
    const id = team[i];
    const h = id ? heroById(id) : null;
    return (
      <div
        key={i}
        role="button"
        tabIndex={0}
        className={`f-slot ${h ? 'filled' : ''} ${picked === i ? 'picking' : ''} ${dragOver === i ? 'drop' : ''}`}
        draggable={!!h}
        onDragStart={(e) => e.dataTransfer.setData('text/slot', String(i))}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(i);
        }}
        onDragLeave={() => setDragOver((d) => (d === i ? null : d))}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(null);
          const from = e.dataTransfer.getData('text/slot');
          const hero = e.dataTransfer.getData('text/hero');
          if (from !== '') swap(Number(from), i);
          else if (hero) place(hero, i);
          setPicked(null);
        }}
        onClick={() => {
          if (picked === null) setPicked(h ? i : null);
          else if (picked === i) setPicked(null);
          else {
            swap(picked, i);
            setPicked(null);
          }
        }}
        title={h ? 'Kéo thả hoặc chạm để đổi chỗ' : 'Ô trống: kéo một ninja vào đây'}
      >
        {h ? <Portrait hero={h} size={62} /> : <span className="plus">+</span>}
        <small>
          {h ? h.name : SLOT_LABEL[i]}
          {h && <em className="lv"> Lv{progOf(owned, h.id).level}</em>}
        </small>
        {h && (
          <button
            className="f-remove"
            title="Bỏ khỏi đội"
            onClick={(e) => {
              e.stopPropagation();
              setPicked(null);
              toggle(h.id);
            }}
          >
            ×
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="select-screen">
      {topBar}
      <div className="screen-title">
        <button className="btn-back" onClick={onBack}>
          ‹ {backLabel}
        </button>
        <h2>{mission ? mission.title : 'Luyện tập'}</h2>
        {mission && <span className="muted">{mission.subtitle}</span>}
      </div>
      <main className="select-main">
        <section className="panel roster">
          <h2>Chọn 5 ninja ({roster.length} đang sở hữu)</h2>
          <div className="grid">
            {roster.map((h) => (
              <HeroCard key={h.id} hero={h} prog={progOf(owned, h.id)} slot={team.indexOf(h.id)} draggable onClick={() => toggle(h.id)} onHover={() => setHover(h)} />
            ))}
          </div>
        </section>
        <section className="panel">
          <HeroDetail hero={hover} progress={ownedIds.includes(hover.id) ? progOf(owned, hover.id) : undefined} />
        </section>
        <section className="panel side">
          <h2>Đội hình · Lực chiến {myPower.toLocaleString('vi-VN')}</h2>
          <div className="formation">
            <div className="f-col">
              <span className="f-label">Hàng sau</span>
              {[2, 3, 4].map(slotView)}
            </div>
            <div className="f-col front">
              <span className="f-label">Hàng trước</span>
              {[0, 1].map(slotView)}
            </div>
          </div>
          <p className="hint">Kéo thả để đổi vị trí (trên điện thoại: chạm ô này rồi chạm ô kia). Đòn đánh đơn phải nhắm hàng trước khi hàng trước còn người, nên đặt tướng đỡ đòn ở hàng trước.</p>
          {mission ? (
            <>
              <h2>Kẻ địch · Lực chiến {enemyPower.toLocaleString('vi-VN')}</h2>
              <EnemyRow enemies={mission.enemies} />
              {full && myPower < enemyPower * 0.85 && <p className="warn">Đội của bạn yếu hơn đáng kể. Hãy nâng cấp ninja trước.</p>}
            </>
          ) : (
            <>
              <h2>Đối thủ luyện tập</h2>
              <div className="enemies">
                {ENEMY_PRESETS.map((p) => (
                  <button key={p.id} className={`enemy-opt ${p.id === enemy ? 'on' : ''}`} onClick={() => setEnemy(p.id)}>
                    <div className="enemy-faces">
                      {p.heroes.map((id) => (
                        <Portrait key={id} hero={heroById(id)} size={34} className="mini-face" />
                      ))}
                    </div>
                    <b>{p.name}</b>
                    <small>{p.desc} · Không tốn thể lực, không có thưởng</small>
                  </button>
                ))}
              </div>
            </>
          )}
          {error && <div className="form-error">{error}</div>}
          <button
            className="btn-fight"
            disabled={!full || busy || lackStamina}
            onClick={() => onStart(team as string[], mission ? undefined : ENEMY_PRESETS.find((p) => p.id === enemy)!.heroes)}
          >
            {!full ? `Còn thiếu ${team.filter((x) => !x).length} ninja` : lackStamina ? 'Không đủ thể lực' : busy ? 'Đang vào trận…' : 'CHIẾN ĐẤU'}
            {mission && mission.stamina > 0 && full && !lackStamina && !busy && <small className="cost"> · {mission.stamina} thể lực</small>}
          </button>
        </section>
      </main>
    </div>
  );
}

export { MAX_AWAKEN };
