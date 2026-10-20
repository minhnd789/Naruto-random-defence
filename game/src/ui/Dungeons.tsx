import { CSSProperties, useState } from 'react';
import { BattleTarget, Profile } from '../api';
import { ELEMENT_INFO } from '../engine/heroes';
import { DUNGEONS, DUNGEON_TIERS, DungeonId, ELEMENTS, dungeonEnemies, dungeonLevel, dungeonReward, dungeonStamina } from '../engine/stages';
import { Element } from '../engine/types';
import { RewardList } from './Items';
import { EnemyRow, Mission, teamPower } from './TeamSelect';

export function Dungeons({
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
  const [id, setId] = useState<DungeonId>('exp');
  const cleared = profile.dungeonClears[id] ?? 0;
  const [tier, setTier] = useState(Math.min(DUNGEON_TIERS, cleared + 1));
  const [element, setElement] = useState<Element>('fire');
  const el = id === 'rune' ? element : undefined;
  const enemies = dungeonEnemies(id, tier, el);
  const d = DUNGEONS[id];

  const pick = (nid: DungeonId) => {
    setId(nid);
    setTier(Math.min(DUNGEON_TIERS, (profile.dungeonClears[nid] ?? 0) + 1));
  };

  return (
    <div className="select-screen">
      {topBar}
      <div className="screen-title">
        <button className="btn-back" onClick={onBack}>
          ‹ Sảnh
        </button>
        <h2>Bí Cảnh</h2>
        <span className="muted">Khiêu chiến để lấy nguyên liệu nâng cấp ninja</span>
      </div>
      <div className="dungeon-cards">
        {(Object.keys(DUNGEONS) as DungeonId[]).map((k) => (
          <button key={k} className={`dungeon-card ${k === id ? 'on' : ''}`} style={{ '--c': DUNGEONS[k].color } as CSSProperties} onClick={() => pick(k)}>
            <span className="dc-k">{DUNGEONS[k].icon}</span>
            <b>{DUNGEONS[k].name}</b>
            <small>{DUNGEONS[k].desc}</small>
            <em>Đã vượt bậc {profile.dungeonClears[k] ?? 0}/{DUNGEON_TIERS}</em>
          </button>
        ))}
      </div>
      <section className="panel dungeon-detail" style={{ '--c': d.color } as CSSProperties}>
        <div className="tiers">
          {Array.from({ length: DUNGEON_TIERS }, (_, i) => i + 1).map((t) => {
            const open = t === 1 || cleared >= t - 1;
            return (
              <button key={t} className={`tier ${t === tier ? 'on' : ''} ${t <= cleared ? 'done' : ''}`} disabled={!open} onClick={() => setTier(t)}>
                <b>Bậc {t}</b>
                <small>{open ? `Cấp ${dungeonLevel(t)}` : '🔒'}</small>
              </button>
            );
          })}
        </div>
        {id === 'rune' && (
          <div className="el-pick">
            <span className="muted">Chọn hệ:</span>
            {ELEMENTS.map((e) => (
              <button key={e} className={`el-chip ${e === element ? 'on' : ''}`} style={{ '--el': ELEMENT_INFO[e].css } as CSSProperties} onClick={() => setElement(e)}>
                {ELEMENT_INFO[e].icon} {ELEMENT_INFO[e].name}
              </button>
            ))}
          </div>
        )}
        <div className="si-meta">
          <span>Lực chiến địch {teamPower(enemies).toLocaleString('vi-VN')}</span>
          <span className="stam">⚡ {dungeonStamina(tier)} thể lực</span>
        </div>
        <EnemyRow enemies={enemies} />
        <RewardList label="Phần thưởng" reward={dungeonReward(id, tier, el)} />
        <button
          className="btn-fight"
          onClick={() =>
            onPrepare(
              { mode: 'dungeon', dungeon: id, tier, element: el },
              {
                title: `${d.name} · Bậc ${tier}`,
                subtitle: el ? `Hệ ${ELEMENT_INFO[el].name}` : `Cấp ${dungeonLevel(tier)}`,
                enemies,
                stamina: dungeonStamina(tier),
              },
            )
          }
        >
          CHUẨN BỊ
        </button>
      </section>
    </div>
  );
}
