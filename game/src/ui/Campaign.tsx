import { CSSProperties, useState } from 'react';
import { BattleTarget, Profile } from '../api';
import { heroUrl } from '../battle/BattleScene';
import { heroById } from '../engine/heroes';
import { CHAPTERS, StageDef, prevStageId, stageFirstClear, stageReward } from '../engine/stages';
import { ItemIcon, RewardList } from './Items';
import { Portrait } from './Portrait';
import { EnemyRow, Mission, teamPower } from './TeamSelect';

// Vị trí các nút ải trên bản đồ (phần trăm)
const NODE_POS: [number, number][] = [
  [9, 72],
  [25, 42],
  [41, 68],
  [57, 36],
  [72, 64],
  [88, 34],
];

export function isUnlocked(profile: Profile, id: string) {
  const prev = prevStageId(id);
  return !prev || profile.stageClears.includes(prev);
}

export function Campaign({
  profile,
  onBack,
  onPrepare,
  topBar,
}: {
  profile: Profile;
  onBack: () => void;
  onPrepare: (target: BattleTarget, mission: Mission) => void;
  topBar: React.ReactNode;
}) {
  const next = CHAPTERS.flatMap((c) => c.stages).find((s) => !profile.stageClears.includes(s.id) && isUnlocked(profile, s.id));
  const [chapterId, setChapterId] = useState(next?.chapter ?? CHAPTERS.length);
  const chapter = CHAPTERS.find((c) => c.id === chapterId)!;
  const [selId, setSelId] = useState<string>(next && next.chapter === chapterId ? next.id : chapter.stages[0].id);
  const sel = chapter.stages.find((s) => s.id === selId) ?? chapter.stages[0];
  const boss = chapter.stages[chapter.stages.length - 1];
  const bossHero = heroById(boss.enemies[boss.enemies.length - 2].heroId);

  const path = NODE_POS.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ');

  const prepare = (s: StageDef) =>
    onPrepare({ mode: 'stage', stageId: s.id }, { title: `Ải ${s.id} · ${s.name}`, subtitle: `Cấp đề xuất ${s.level}`, enemies: s.enemies, stamina: s.stamina });

  return (
    <div className="select-screen">
      {topBar}
      <div className="screen-title">
        <button className="btn-back" onClick={onBack}>
          ‹ Sảnh
        </button>
        <h2>Vượt Ải</h2>
      </div>
      <div className="chapter-tabs">
        {CHAPTERS.map((c) => {
          const open = isUnlocked(profile, c.stages[0].id);
          const done = c.stages.filter((s) => profile.stageClears.includes(s.id)).length;
          return (
            <button
              key={c.id}
              className={`chip ${c.id === chapterId ? 'on' : ''}`}
              disabled={!open}
              onClick={() => {
                setChapterId(c.id);
                setSelId(c.stages.find((s) => !profile.stageClears.includes(s.id) && isUnlocked(profile, s.id))?.id ?? c.stages[0].id);
              }}
            >
              Chương {c.id} {open ? `· ${done}/${c.stages.length}` : '🔒'}
            </button>
          );
        })}
      </div>
      <main className="select-main two">
        <section className="panel map-panel">
          <div className="map" style={{ '--boss': `url(${heroUrl(bossHero.image)})` } as CSSProperties}>
            <div className="map-head">
              <small>Chương {chapter.id}</small>
              <h3>{chapter.name}</h3>
              <p>{chapter.desc}</p>
            </div>
            <svg className="map-path" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d={path} />
            </svg>
            {chapter.stages.map((s, i) => {
              const cleared = profile.stageClears.includes(s.id);
              const open = isUnlocked(profile, s.id);
              const [x, y] = NODE_POS[i];
              return (
                <button
                  key={s.id}
                  className={`node ${cleared ? 'cleared' : open ? 'open' : 'locked'} ${s.boss ? 'boss' : ''} ${s.id === sel.id ? 'sel' : ''}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  disabled={!open}
                  onClick={() => setSelId(s.id)}
                >
                  {s.boss ? <Portrait hero={heroById(s.enemies[s.enemies.length - 2].heroId)} size={58} /> : <span>{s.index}</span>}
                  <small>{cleared ? '✓ ' : ''}{s.id}</small>
                </button>
              );
            })}
          </div>
        </section>
        <section className="panel stage-info">
          <small className="muted">
            Ải {sel.id} {sel.boss && <b className="boss-tag">TRÙM</b>}
          </small>
          <h3>{sel.name}</h3>
          <div className="si-meta">
            <span>Cấp địch {sel.level}</span>
            <span>Lực chiến {teamPower(sel.enemies).toLocaleString('vi-VN')}</span>
            <span className="stam">⚡ {sel.stamina} thể lực</span>
          </div>
          <EnemyRow enemies={sel.enemies} />
          <RewardList label="Phần thưởng" reward={stageReward(sel)} />
          <div className="reward-list">
            <span className="rl-label">Có thể rơi</span>
            <ItemIcon id="rune_fire" />
            <ItemIcon id="soul_stone" />
          </div>
          {!profile.stageClears.includes(sel.id) && <RewardList label="Lần đầu" reward={stageFirstClear(sel)} />}
          <button className="btn-fight" disabled={!isUnlocked(profile, sel.id)} onClick={() => prepare(sel)}>
            CHUẨN BỊ
          </button>
        </section>
      </main>
    </div>
  );
}
