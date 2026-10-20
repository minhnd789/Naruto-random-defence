import { useEffect, useState } from 'react';
import { api, ArenaState, BattleTarget, OwnedHero, Profile } from '../api';
import { HEROES, heroById } from '../engine/heroes';
import { power } from '../engine/progression';
import { tierOf } from '../engine/ranking';
import { Portrait } from './Portrait';
import { Leaderboard, TierBadge, useCountdown } from './Ranking';
import { EnemyRow, Mission, progOf, teamPower } from './TeamSelect';

export function Arena({
  profile,
  setProfile,
  onBack,
  onPrepare,
  topBar,
}: {
  profile: Profile;
  setProfile: (p: Profile) => void;
  onBack: () => void;
  onPrepare: (target: BattleTarget, mission: Mission) => void;
  topBar: React.ReactNode;
}) {
  const [st, setSt] = useState<ArenaState | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'fight' | 'rank' | 'log'>('fight');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = (p: Promise<ArenaState>) =>
    p
      .then((s) => {
        setSt(s);
        setErr('');
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load(api.arena());
  }, []);

  const season = useCountdown(st?.endsAt ?? 0);
  if (!st)
    return (
      <div className="select-screen">
        {topBar}
        {err ? <div className="form-error">{err}</div> : <p className="muted">Đang tải đấu trường…</p>}
      </div>
    );

  const me = st.me;
  const claim = async () => {
    setBusy(true);
    try {
      const r = await api.arenaClaim();
      setProfile(r);
      setSt(r.arena);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="select-screen">
      {topBar}
      <div className="screen-title">
        <button className="btn-back" onClick={onBack}>
          ‹ Sảnh
        </button>
        <h2>Đấu Trường</h2>
        <span className="muted">
          Mùa {st.season} · kết thúc sau {season.text}
        </span>
      </div>

      <div className="arena-head panel">
        <TierBadge rating={me.rating} big />
        <div className="ah-stat">
          <small>Điểm</small>
          <b>{me.rating}</b>
        </div>
        <div className="ah-stat">
          <small>Hạng</small>
          <b>#{me.rank}</b>
        </div>
        <div className="ah-stat">
          <small>Thắng / Thua</small>
          <b>
            {me.wins} / {me.losses}
          </b>
        </div>
        <div className="ah-stat">
          <small>Vé</small>
          <b className="tickets">
            {'◆'.repeat(me.tickets)}
            <i>{'◆'.repeat(me.ticketsMax - me.tickets)}</i>
          </b>
          {me.ticketNextMs && <small className="muted">+1 sau {Math.ceil(me.ticketNextMs / 60000)} phút</small>}
        </div>
        <div className="ah-next">
          {(() => {
            const t = tierOf(me.rating);
            return (
              <small className="muted">
                Thưởng cuối mùa bậc {t.name}: {t.reward.gems} Ngọc, {t.reward.coins.toLocaleString('vi-VN')} Xu
              </small>
            );
          })()}
        </div>
      </div>

      {st.pendingReward && (
        <div className="season-reward">
          <span>
            Mùa {st.pendingReward.season} đã kết thúc. Bạn đạt bậc <b>{tierOf(st.pendingReward.rating).name}</b> ({st.pendingReward.rating} điểm).
          </span>
          <button className="btn-fight small" disabled={busy} onClick={claim}>
            Nhận {st.pendingReward.reward.gems} Ngọc + {st.pendingReward.reward.coins.toLocaleString('vi-VN')} Xu
          </button>
        </div>
      )}
      {err && <div className="form-error">{err}</div>}

      <div className="chapter-tabs">
        <button className={`chip ${tab === 'fight' ? 'on' : ''}`} onClick={() => setTab('fight')}>
          Khiêu chiến
        </button>
        <button className={`chip ${tab === 'rank' ? 'on' : ''}`} onClick={() => setTab('rank')}>
          Bảng xếp hạng
        </button>
        <button className={`chip ${tab === 'log' ? 'on' : ''}`} onClick={() => setTab('log')}>
          Nhật ký
        </button>
      </div>

      <main className="select-main two">
        <section className="panel">
          {tab === 'fight' && (
            <>
              <div className="panel-head">
                <h2>Đối thủ</h2>
                <button className="btn-mini" onClick={() => load(api.arenaRefresh())}>
                  ↻ Làm mới
                </button>
              </div>
              <div className="opp-list">
                {st.opponents.map((o) => (
                  <div key={o.id} className={`opp ${o.fought ? 'fought' : ''}`}>
                    <div className="opp-info">
                      <b>{o.name}</b>
                      <span>
                        <TierBadge rating={o.rating} /> {o.rating} điểm · Lực chiến {o.power.toLocaleString('vi-VN')}
                        {o.id.startsWith('bot:') && <em className="bot-tag">AI</em>}
                      </span>
                    </div>
                    <EnemyRow enemies={o.team} />
                    <button
                      className="btn-up gold"
                      disabled={o.fought || me.tickets < 1}
                      onClick={() =>
                        onPrepare(
                          { mode: 'arena', opponentId: o.id },
                          { title: `Đấu trường · ${o.name}`, subtitle: `${o.rating} điểm · 1 vé`, enemies: o.team, stamina: 0 },
                        )
                      }
                    >
                      {o.fought ? 'Đã đấu' : me.tickets < 1 ? 'Hết vé' : 'Khiêu chiến'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === 'rank' && <Leaderboard type="arena" myId={profile.user.id} />}
          {tab === 'log' && <ArenaLog />}
        </section>
        <section className="panel">
          <h2>Đội phòng thủ · Lực chiến {teamPower(st.defense).toLocaleString('vi-VN')}</h2>
          <p className="hint">Người chơi khác sẽ đánh đội này. AI điều khiển đội phòng thủ của bạn.</p>
          {editing ? (
            <DefenseEditor
              owned={profile.heroes}
              initial={st.defense.map((u) => u.heroId)}
              onCancel={() => setEditing(false)}
              onSave={async (team) => {
                await load(api.arenaDefense(team));
                setEditing(false);
              }}
            />
          ) : (
            <>
              <EnemyRow enemies={st.defense} />
              <button className="btn-ghost" onClick={() => setEditing(true)}>
                Đổi đội phòng thủ
              </button>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function DefenseEditor({ owned, initial, onSave, onCancel }: { owned: OwnedHero[]; initial: string[]; onSave: (t: string[]) => Promise<void>; onCancel: () => void }) {
  const [team, setTeam] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const ids = HEROES.filter((h) => owned.some((o) => o.heroId === h.id))
    .map((h) => h.id)
    .sort((a, b) => power(heroById(b), progOf(owned, b)) - power(heroById(a), progOf(owned, a)));
  const toggle = (id: string) => setTeam((t) => (t.includes(id) ? t.filter((x) => x !== id) : t.length < 5 ? [...t, id] : t));
  return (
    <div className="def-editor">
      <p className="muted small">Chọn theo thứ tự: 2 người đầu đứng hàng trước.</p>
      <div className="def-grid">
        {ids.map((id) => {
          const i = team.indexOf(id);
          return (
            <button key={id} className={`def-pick ${i >= 0 ? 'on' : ''}`} onClick={() => toggle(id)}>
              <Portrait hero={heroById(id)} size={52} />
              <small>Lv{progOf(owned, id).level}</small>
              {i >= 0 && <b>{i + 1}</b>}
            </button>
          );
        })}
      </div>
      <div className="result-btns">
        <button
          className="btn-fight small"
          disabled={team.length !== 5 || busy}
          onClick={async () => {
            setBusy(true);
            await onSave(team);
            setBusy(false);
          }}
        >
          Lưu đội phòng thủ
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Huỷ
        </button>
      </div>
    </div>
  );
}

function ArenaLog() {
  const [log, setLog] = useState<Awaited<ReturnType<typeof api.arenaLog>> | null>(null);
  useEffect(() => {
    api.arenaLog().then(setLog).catch(() => setLog({ attacks: [], defenses: [] }));
  }, []);
  if (!log) return <p className="muted">Đang tải…</p>;
  const row = (r: { name: string; win: boolean; change: number; created_at: string }, i: number) => (
    <div key={i} className="log-row">
      <span className={r.win ? 'win' : 'lose'}>{r.win ? 'Thắng' : 'Thua'}</span>
      <b>{r.name}</b>
      <span className={`rating-change ${r.change >= 0 ? 'up' : 'down'}`}>
        {r.change >= 0 ? '+' : ''}
        {r.change}
      </span>
      <small className="muted">{new Date(r.created_at).toLocaleString('vi-VN')}</small>
    </div>
  );
  return (
    <div className="arena-log">
      <h2>Tấn công</h2>
      {log.attacks.length ? log.attacks.map(row) : <p className="muted">Chưa có trận nào.</p>}
      <h2>Phòng thủ</h2>
      {log.defenses.length ? log.defenses.map(row) : <p className="muted">Chưa ai tấn công bạn.</p>}
    </div>
  );
}
