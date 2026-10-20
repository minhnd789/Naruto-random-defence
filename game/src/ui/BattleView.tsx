import { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react';
import { api, BattleOutcome, Profile } from '../api';
import { BattleController, HudState, RemoteDriver } from '../battle/BattleController';
import { ELEMENT_INFO } from '../engine/heroes';
import { HeroDef, TeamId } from '../engine/types';
import { RewardList } from './Items';
import { Portrait } from './Portrait';

type ServerState = { status: 'pending' } | { status: 'done'; outcome: BattleOutcome } | { status: 'error'; message: string };

const SPEEDS = [1, 2, 3];

export function BattleView({
  team,
  enemy,
  seed,
  battleId,
  onProfile,
  onRetry,
  onBack,
  backLabel = 'Đổi đội hình',
  mySide = 'A',
  remote,
  overlay,
  rtaEnd,
  onSurrender,
}: {
  team: HeroDef[];
  enemy: HeroDef[];
  seed: number;
  battleId?: string; // có = trận do server cấp, kết quả phải được server xác thực
  onProfile?: (p: Profile) => void;
  onRetry?: () => void;
  onBack: () => void;
  backLabel?: string;
  // RTA
  mySide?: TeamId;
  remote?: RemoteDriver;
  overlay?: ReactNode;
  rtaEnd?: { winner: TeamId; changes: Record<TeamId, number>; ranked: boolean; reason: string } | null;
  onSurrender?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<BattleController | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [server, setServer] = useState<ServerState | null>(null);
  const reported = useRef(false);

  const report = (actions: BattleController['actions']) => {
    if (!battleId || reported.current) return null;
    reported.current = true;
    return api.battleFinish(battleId, actions);
  };

  useEffect(() => {
    const ctrl = new BattleController(team, enemy, seed, setHud);
    ctrl.mySide = mySide;
    ctrl.remote = remote;
    ctrl.onOver = (actions) => {
      const p = report(actions);
      if (!p) return;
      setServer({ status: 'pending' });
      p.then((r) => {
        onProfile?.(r);
        setServer({ status: 'done', outcome: r });
      }).catch((e) => setServer({ status: 'error', message: (e as Error).message }));
    };
    try {
      const saved = JSON.parse(localStorage.getItem('ninja-prefs') ?? '{}');
      if (saved.auto) ctrl.auto = true;
      if (SPEEDS.includes(saved.speed)) ctrl.speed = saved.speed;
    } catch {
      /* không có localStorage thì dùng mặc định */
    }
    ctrlRef.current = ctrl;
    if (import.meta.env.DEV) (window as any).__battle = ctrl; // hook debug khi phát triển
    ctrl.start(hostRef.current!);
    return () => ctrl.dispose();
  }, [team, enemy, seed]);

  const savePrefs = (auto: boolean, speed: number) => {
    try {
      localStorage.setItem('ninja-prefs', JSON.stringify({ auto, speed }));
    } catch {
      /* bỏ qua */
    }
  };

  const ctrl = ctrlRef.current;
  const active = hud?.activeUid ? hud.units.find((u) => u.uid === hud.activeUid) : null;
  const showSkills = hud?.awaitingInput && active && active.team === hud.mySide;
  const selected = showSkills ? active!.hero.skills.find((s) => s.id === hud!.selectedSkillId) : null;

  return (
    <div className="battle">
      <div className="canvas-host" ref={hostRef} />
      {!hud?.ready && <div className="loading">Đang tải trận đấu…</div>}
      {hud?.ready && (
        <div className="hud">
          {/* Thanh hành động dọc kiểu Epic Seven */}
          <div className="cr-gauge">
            <span className="cr-top">⚡</span>
            <div className="cr-track">
              {hud.units
                .filter((u) => u.alive)
                .map((u) => {
                  const isActive = u.uid === hud.activeUid;
                  return (
                    <div
                      key={u.uid}
                      className={`cr-unit team-${u.team === hud.mySide ? "A" : "B"} ${isActive ? 'active' : ''}`}
                      style={{ top: `${(1 - u.cr) * 100}%`, zIndex: Math.round(u.cr * 100) } as CSSProperties}
                      title={`${u.hero.name}: ${Math.round(u.cr * 100)}%`}
                    >
                      <Portrait hero={u.hero} size={isActive ? 44 : 34} />
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="top-center">
            <div className="turn-no">Lượt {hud.turn}</div>
            {hud.rage > 0 && <div className="rage">BẠO NỘ +{hud.rage}% sát thương</div>}
            <div className="next-turns">
              {hud.order.slice(0, 7).map((uid, i) => {
                const u = hud.units.find((x) => x.uid === uid)!;
                return <Portrait key={i} hero={u.hero} size={i === 0 ? 38 : 30} className={`nt team-${u.team === hud.mySide ? "A" : "B"} ${i === 0 ? 'first' : ''}`} />;
              })}
            </div>
          </div>

          <div className="top-right">
            <button
              className={`ctl ${hud.auto ? 'on' : ''}`}
              onClick={() => {
                ctrl?.setAuto(!hud.auto);
                savePrefs(!hud.auto, hud.speed);
              }}
            >
              AUTO
            </button>
            <button
              className="ctl"
              onClick={() => {
                const next = SPEEDS[(SPEEDS.indexOf(hud.speed) + 1) % SPEEDS.length];
                ctrl?.setSpeed(next);
                savePrefs(hud.auto, next);
              }}
            >
              x{hud.speed}
            </button>
            <button
              className="ctl"
              onClick={() => {
                if (onSurrender) {
                  if (!hud.over && !rtaEnd && !confirm('Đầu hàng và rời trận?')) return;
                  if (!rtaEnd) onSurrender();
                  if (!hud.over && !rtaEnd) return;
                } else if (!hud.over) report(ctrl?.actions ?? [])?.then((r) => onProfile?.(r)).catch(() => {});
                onBack();
              }}
            >
              {onSurrender && !hud.over && !rtaEnd ? 'Đầu hàng' : 'Thoát'}
            </button>
          </div>

          {showSkills && active && (
            <div className="skill-panel" style={{ '--el': ELEMENT_INFO[active.hero.element].css } as CSSProperties}>
              {selected && (
                <div className="skill-info">
                  <b>{selected.name}</b>
                  <p>{selected.desc}</p>
                  <small>
                    {selected.target === 'enemy' && 'Chọn một kẻ địch được đánh dấu'}
                    {selected.target === 'allEnemies' && 'Bấm vào bất kỳ kẻ địch nào để thi triển'}
                    {selected.target === 'ally' && 'Chọn một đồng đội'}
                    {(selected.target === 'allAllies' || selected.target === 'self') && 'Bấm vào bất kỳ đồng đội nào để thi triển'}
                  </small>
                </div>
              )}
              <div className="skill-row-btns">
                <div className="active-hero">
                  <Portrait hero={active.hero} size={58} />
                  <span>{active.hero.name}</span>
                </div>
                {active.hero.skills.map((s) => {
                  const cd = hud.cooldowns[s.id] ?? 0;
                  return (
                    <button
                      key={s.id}
                      className={`skill-btn s${s.slot} ${hud.selectedSkillId === s.id ? 'sel' : ''}`}
                      disabled={cd > 0}
                      onClick={() => ctrl?.selectSkill(s.id)}
                      title={s.name}
                    >
                      <span className="sk-n">{s.slot === 3 ? '奥' : s.slot}</span>
                      <span className="sk-name">{s.name}</span>
                      {cd > 0 && <span className="sk-cd">{cd}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {!showSkills && !hud.over && !hud.auto && active && active.team !== hud.mySide && <div className="enemy-turn">Lượt của đối thủ…</div>}

          {overlay}
          {((rtaEnd && (hud.over || rtaEnd.reason === 'surrender')) || (hud.over && !remote)) && (
            <Result hud={hud} server={battleId ? server : null} rtaEnd={rtaEnd ?? null} onRetry={onRetry} onBack={onBack} backLabel={backLabel} />
          )}
        </div>
      )}
    </div>
  );
}

function Result({
  hud,
  server,
  rtaEnd,
  onRetry,
  onBack,
  backLabel,
}: {
  hud: HudState;
  server: ServerState | null;
  rtaEnd: { winner: TeamId; changes: Record<TeamId, number>; ranked: boolean; reason: string } | null;
  onRetry?: () => void;
  onBack: () => void;
  backLabel: string;
}) {
  // Trận có xác thực: kết quả cuối cùng do server quyết định
  const verifiedWin = server?.status === 'done' ? server.outcome.victory : null;
  const win = rtaEnd ? rtaEnd.winner === hud.mySide : (verifiedWin ?? hud.winner === hud.mySide);
  const mine = hud.units.filter((u) => u.team === hud.mySide);
  const maxDmg = Math.max(1, ...mine.map((u) => hud.damage[u.uid] ?? 0));
  const mvp = [...mine].sort((a, b) => (hud.damage[b.uid] ?? 0) + (hud.healing[b.uid] ?? 0) - (hud.damage[a.uid] ?? 0) - (hud.healing[a.uid] ?? 0))[0];
  return (
    <div className={`result ${win ? 'win' : 'lose'}`}>
      <div className="result-card">
        <h2>{win ? 'CHIẾN THẮNG' : 'THẤT BẠI'}</h2>
        <p className="muted">Kết thúc sau {hud.turn} lượt</p>
        <div className="mvp">
          <Portrait hero={mvp.hero} size={84} />
          <div>
            <small>MVP</small>
            <b>{mvp.hero.name}</b>
            <span>
              {(hud.damage[mvp.uid] ?? 0).toLocaleString('vi-VN')} sát thương
              {hud.healing[mvp.uid] ? ` · ${hud.healing[mvp.uid].toLocaleString('vi-VN')} hồi máu` : ''}
            </span>
          </div>
        </div>
        <div className="dmg-table">
          {mine.map((u) => (
            <div key={u.uid} className="dmg-row">
              <Portrait hero={u.hero} size={30} />
              <span className="dmg-name">{u.hero.name}</span>
              <div className="dmg-bar">
                <i style={{ width: `${((hud.damage[u.uid] ?? 0) / maxDmg) * 100}%` }} />
              </div>
              <span className="dmg-val">{(hud.damage[u.uid] ?? 0).toLocaleString('vi-VN')}</span>
            </div>
          ))}
        </div>
        {rtaEnd && (
          <div className="server-result">
            {rtaEnd.reason === 'surrender' && <span className="muted">{win ? 'Đối thủ đã đầu hàng' : 'Bạn đã đầu hàng'}</span>}
            {rtaEnd.ranked ? (
              <span className={`rating-change ${rtaEnd.changes[hud.mySide] >= 0 ? 'up' : 'down'}`}>
                Điểm RTA {rtaEnd.changes[hud.mySide] >= 0 ? '+' : ''}
                {rtaEnd.changes[hud.mySide]}
              </span>
            ) : (
              <span className="muted">Trận luyện tập với bot, không tính điểm</span>
            )}
          </div>
        )}
        {server && (
          <div className="server-result">
            {server.status === 'pending' && <span className="muted">Đang xác nhận kết quả với máy chủ…</span>}
            {server.status === 'error' && <span className="form-error">{server.message}</span>}
            {server.status === 'done' && server.outcome.reward && <RewardList label="Nhận được" reward={server.outcome.reward} />}
            {server.status === 'done' && server.outcome.firstClear && <RewardList label="Lần đầu" reward={server.outcome.firstClear} />}
            {server.status === 'done' && server.outcome.arena && (
              <span className={`rating-change ${server.outcome.arena.ratingChange >= 0 ? 'up' : 'down'}`}>
                Điểm đấu trường {server.outcome.arena.ratingChange >= 0 ? '+' : ''}
                {server.outcome.arena.ratingChange} → {server.outcome.arena.newRating}
              </span>
            )}
            {server.status === 'done' && !server.outcome.victory && hud.winner === hud.mySide && (
              <span className="form-error">Máy chủ không xác nhận chiến thắng này{server.outcome.expired ? ' (trận đã quá hạn)' : ''}.</span>
            )}
          </div>
        )}
        <div className="result-btns">
          {onRetry && (
            <button className="btn-fight small" onClick={onRetry} disabled={server?.status === 'pending'}>
              Đánh lại
            </button>
          )}
          <button className="btn-ghost" onClick={onBack} disabled={server?.status === 'pending'}>
            {backLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
