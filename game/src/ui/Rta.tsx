import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { api, currentToken, Profile, RtaMe } from '../api';
import { RemoteDriver } from '../battle/BattleController';
import { Choice } from '../engine/ai';
import { ELEMENT_INFO, HEROES, heroById } from '../engine/heroes';
import { UnitSetup, buildTeam } from '../engine/progression';
import { PICK_ORDER, RTA_MIN_HEROES } from '../engine/ranking';
import { TeamId } from '../engine/types';
import { BattleView } from './BattleView';
import { Portrait } from './Portrait';
import { Leaderboard, TierBadge, useCountdown } from './Ranking';

interface MatchInfo {
  matchId: string;
  you: TeamId;
  ranked: boolean;
  me: { name: string; rating: number };
  opponent: { name: string; rating: number; bot: boolean };
}
interface Draft {
  phase: 'preban' | 'pick' | 'postban' | 'battle' | 'ended';
  turn: TeamId | 'both';
  pickIndex: number;
  deadline: number;
  prebans: Partial<Record<TeamId, string>>;
  picks: Record<TeamId, string[]>;
  postbans: Partial<Record<TeamId, string>>;
}
interface StartMsg {
  seed: number;
  teamA: UnitSetup[];
  teamB: UnitSetup[];
}
interface EndMsg {
  winner: TeamId;
  reason: string;
  changes: Record<TeamId, number>;
}

/** Hàng đợi hành động từ server cho controller trận đấu. */
class WsDriver implements RemoteDriver {
  private queue: (Choice & { actorUid: string })[] = [];
  private waiter: { uid: string; resolve: (c: Choice) => void } | null = null;
  constructor(private sendFn: (c: Choice) => void) {}
  push(a: Choice & { actorUid: string }) {
    this.queue.push(a);
    this.flush();
  }
  nextAction(actorUid: string) {
    return new Promise<Choice>((resolve) => {
      this.waiter = { uid: actorUid, resolve };
      this.flush();
    });
  }
  send(c: Choice) {
    this.sendFn(c);
  }
  private flush() {
    if (!this.waiter || !this.queue.length) return;
    const a = this.queue.shift()!;
    if (a.actorUid !== this.waiter.uid) console.warn('RTA lệch lượt', a.actorUid, this.waiter.uid);
    const w = this.waiter;
    this.waiter = null;
    w.resolve({ skillId: a.skillId, targetUid: a.targetUid });
  }
}

const other = (s: TeamId): TeamId => (s === 'A' ? 'B' : 'A');

export function Rta({ profile, onBack, topBar }: { profile: Profile; onBack: () => void; topBar: React.ReactNode }) {
  const [me, setMe] = useState<RtaMe | null>(null);
  const [status, setStatus] = useState<'connecting' | 'idle' | 'queued' | 'match' | 'closed'>('connecting');
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [start, setStart] = useState<StartMsg | null>(null);
  const [end, setEnd] = useState<EndMsg | null>(null);
  const [turnDeadline, setTurnDeadline] = useState(0);
  const [myChoice, setMyChoice] = useState<string | null>(null); // lựa chọn cấm đồng thời đã gửi
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'play' | 'rank'>('play');
  const wsRef = useRef<WebSocket | null>(null);
  const driverRef = useRef<WsDriver | null>(null);

  const send = (m: unknown) => wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify(m));

  useEffect(() => {
    api.rtaMe().then(setMe).catch(() => {});
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/api/rta/ws?token=${encodeURIComponent(currentToken() ?? '')}`);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      switch (m.t) {
        case 'hello':
          setStatus('idle');
          break;
        case 'queued':
          setStatus('queued');
          break;
        case 'cancelled':
          setStatus('idle');
          break;
        case 'match':
          setMatch(m);
          setStatus('match');
          setDraft(null);
          setStart(null);
          setEnd(null);
          setMyChoice(null);
          driverRef.current = new WsDriver((c) => send({ t: 'act', ...c }));
          break;
        case 'draft':
          setDraft((prev) => {
            if (!prev || prev.phase !== m.phase) setMyChoice(null);
            return m;
          });
          break;
        case 'start':
          setStart(m);
          break;
        case 'turn':
          setTurnDeadline(m.deadline);
          break;
        case 'action':
          driverRef.current?.push(m);
          break;
        case 'end':
          setEnd(m);
          api.rtaMe().then(setMe).catch(() => {});
          break;
        case 'error':
          setErr(m.message);
          setTimeout(() => setErr(''), 3500);
          if (status === 'connecting') setStatus('idle');
          break;
      }
    };
    ws.onclose = () => setStatus((s) => (s === 'match' ? s : 'closed'));
    ws.onerror = () => setErr('Mất kết nối máy chủ RTA');
    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToLobby = () => {
    setMatch(null);
    setDraft(null);
    setStart(null);
    setEnd(null);
    setStatus(wsRef.current?.readyState === 1 ? 'idle' : 'closed');
  };

  // ---------- Trận đấu ----------
  const teams = useMemo(() => (start ? { A: buildTeam(start.teamA), B: buildTeam(start.teamB) } : null), [start]);
  if (match && start && teams) {
    return (
      <BattleView
        key={match.matchId}
        team={teams.A}
        enemy={teams.B}
        seed={start.seed}
        mySide={match.you}
        theme="rta"
        remote={driverRef.current!}
        overlay={<TurnTimer deadline={turnDeadline} match={match} hidden={!!end} />}
        rtaEnd={end ? { ...end, ranked: match.ranked } : null}
        onSurrender={() => send({ t: 'surrender' })}
        onBack={backToLobby}
        backLabel="Về sảnh RTA"
      />
    );
  }

  // ---------- Cấm / chọn ----------
  if (match && draft) {
    return (
      <DraftView
        profile={profile}
        match={match}
        draft={draft}
        myChoice={myChoice}
        err={err}
        onChoose={(heroId) => {
          const t = draft.phase === 'preban' ? 'ban' : draft.phase === 'pick' ? 'pick' : 'postban';
          send({ t, heroId });
          if (draft.phase !== 'pick') setMyChoice(heroId);
        }}
        onSurrender={() => send({ t: 'surrender' })}
        end={end}
        onLeave={backToLobby}
      />
    );
  }

  // ---------- Sảnh RTA ----------
  const enough = profile.heroes.length >= RTA_MIN_HEROES;
  return (
    <div className="select-screen">
      {topBar}
      <div className="screen-title">
        <button className="btn-back" onClick={onBack}>
          ‹ Sảnh
        </button>
        <h2>Đấu Trường Realtime</h2>
        <span className="muted">Cấm/chọn tướng, đánh trực tiếp theo lượt</span>
      </div>
      <div className="chapter-tabs">
        <button className={`chip ${tab === 'play' ? 'on' : ''}`} onClick={() => setTab('play')}>
          Thi đấu
        </button>
        <button className={`chip ${tab === 'rank' ? 'on' : ''}`} onClick={() => setTab('rank')}>
          Bảng xếp hạng
        </button>
      </div>
      {tab === 'rank' ? (
        <section className="panel">
          <Leaderboard type="rta" myId={profile.user.id} />
        </section>
      ) : (
        <main className="select-main two">
          <section className="panel rta-lobby">
            {me && <RtaSummary me={me} />}
            <div className="rta-rules">
              <div>
                <b>1. Cấm trước</b>
                <span>Mỗi bên cấm 1 ninja, cả hai đều không được chọn.</span>
              </div>
              <div>
                <b>2. Chọn kiểu rắn</b>
                <span>A1 · B1 B2 · A2 A3 · B3 B4 · A4 A5 · B5</span>
              </div>
              <div>
                <b>3. Cấm sau</b>
                <span>Mỗi bên loại 1 ninja của đối thủ, đánh 4 đấu 4.</span>
              </div>
              <div>
                <b>4. Giao chiến</b>
                <span>Mỗi lượt 30 giây, hết giờ máy tự đánh.</span>
              </div>
            </div>
            {!enough && <p className="warn">Cần ít nhất {RTA_MIN_HEROES} ninja (bạn có {profile.heroes.length}). Hãy triệu hồi thêm.</p>}
            {err && <div className="form-error">{err}</div>}
            {status === 'connecting' && <p className="muted">Đang kết nối…</p>}
            {status === 'closed' && <div className="form-error">Mất kết nối máy chủ. Hãy quay lại sảnh rồi vào lại.</div>}
            {status === 'queued' ? (
              <div className="queue-box">
                <div className="spinner" />
                <span>Đang tìm đối thủ có điểm gần bạn…</span>
                <button className="btn-ghost" onClick={() => send({ t: 'cancel' })}>
                  Huỷ tìm trận
                </button>
              </div>
            ) : (
              <div className="result-btns">
                <button className="btn-fight" disabled={status !== 'idle' || !enough} onClick={() => send({ t: 'queue', mode: 'pvp' })}>
                  TÌM TRẬN
                </button>
                <button className="btn-ghost" disabled={status !== 'idle' || !enough} onClick={() => send({ t: 'queue', mode: 'bot' })}>
                  Đấu với Bot
                </button>
              </div>
            )}
          </section>
          <section className="panel">
            <h2>Ninja của bạn</h2>
            <p className="hint">Trong RTA mọi ninja tự lên tối đa (Lv60 · 6★ · thức tỉnh 3); chỉ trang bị là của riêng bạn.</p>
            <div className="def-grid">
              {[...profile.heroes]
                .sort((a, b) => heroById(b.heroId).rarity - heroById(a.heroId).rarity)
                .map((h) => (
                  <div key={h.heroId} className="def-pick">
                    <Portrait hero={heroById(h.heroId)} size={52} />
                    <small>Lv60</small>
                  </div>
                ))}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

function RtaSummary({ me }: { me: RtaMe }) {
  const cd = useCountdown(me.endsAt);
  return (
    <div className="arena-head inner">
      <TierBadge rating={me.rating} big />
      <div className="ah-stat">
        <small>Điểm RTA</small>
        <b>{me.rating}</b>
      </div>
      <div className="ah-stat">
        <small>Hạng</small>
        <b>{me.rank ? `#${me.rank}` : '—'}</b>
      </div>
      <div className="ah-stat">
        <small>Thắng / Thua</small>
        <b>
          {me.wins} / {me.losses}
        </b>
      </div>
      <div className="ah-stat">
        <small>Mùa {me.season}</small>
        <b className="small">còn {cd.text}</b>
      </div>
    </div>
  );
}

function TurnTimer({ deadline, match, hidden }: { deadline: number; match: MatchInfo; hidden: boolean }) {
  const cd = useCountdown(deadline);
  if (hidden) return null;
  const s = Math.ceil(cd.ms / 1000);
  return (
    <div className="rta-bar">
      <span className="me">{match.me.name}</span>
      <b className={`timer ${s <= 5 ? 'low' : ''}`}>{s}</b>
      <span className="op">
        {match.opponent.name}
        {match.opponent.bot && <em className="bot-tag">BOT</em>}
      </span>
    </div>
  );
}

function DraftView({
  profile,
  match,
  draft,
  myChoice,
  err,
  onChoose,
  onSurrender,
  end,
  onLeave,
}: {
  profile: Profile;
  match: MatchInfo;
  draft: Draft;
  myChoice: string | null;
  err: string;
  onChoose: (heroId: string) => void;
  onSurrender: () => void;
  end: EndMsg | null;
  onLeave: () => void;
}) {
  const my = match.you;
  const op = other(my);
  const cd = useCountdown(draft.deadline);
  const owned = new Set(profile.heroes.map((h) => h.heroId));
  const banned = new Set([draft.prebans.A, draft.prebans.B].filter(Boolean) as string[]);
  const myTurn = draft.phase === 'pick' ? draft.turn === my : (draft.phase === 'preban' || draft.phase === 'postban') && !myChoice;

  let title = '';
  let hint = '';
  let grid: string[] = [];
  if (draft.phase === 'preban') {
    title = 'Cấm trước';
    hint = myChoice ? `Bạn đã cấm ${heroById(myChoice).name}. Chờ đối thủ…` : 'Chọn 1 ninja để cấm khỏi trận (cả hai bên).';
    grid = HEROES.map((h) => h.id);
  } else if (draft.phase === 'pick') {
    const left = PICK_ORDER.slice(draft.pickIndex).findIndex((s) => s !== draft.turn);
    const count = left < 0 ? PICK_ORDER.length - draft.pickIndex : left;
    title = draft.turn === my ? `Lượt bạn chọn (${count})` : 'Đối thủ đang chọn…';
    hint = 'Chọn ninja trong đội của bạn. Ninja bị cấm không thể chọn.';
    grid = HEROES.filter((h) => owned.has(h.id)).map((h) => h.id);
  } else if (draft.phase === 'postban') {
    title = 'Cấm sau';
    hint = myChoice ? `Bạn đã loại ${heroById(myChoice).name}. Chờ đối thủ…` : 'Loại 1 ninja của đối thủ khỏi trận.';
    grid = draft.picks[op];
  } else {
    title = 'Đang vào trận…';
  }

  const canChoose = (id: string) => {
    if (!myTurn) return false;
    if (draft.phase === 'preban') return true;
    if (draft.phase === 'pick') return !banned.has(id) && !draft.picks[my].includes(id);
    if (draft.phase === 'postban') return draft.picks[op].includes(id);
    return false;
  };

  const slots = (side: TeamId) => (
    <div className={`draft-side ${side === my ? 'mine' : 'theirs'}`}>
      <div className="ds-head">
        <b>{side === my ? match.me.name : match.opponent.name}</b>
        <TierBadge rating={side === my ? match.me.rating : match.opponent.rating} />
      </div>
      {Array.from({ length: 5 }, (_, i) => {
        const id = draft.picks[side][i];
        const removed = id && draft.postbans[other(side)] === id;
        return (
          <div key={i} className={`ds-slot ${id ? 'filled' : ''} ${removed ? 'removed' : ''}`}>
            {id ? <Portrait hero={heroById(id)} size={48} /> : <span className="plus">{i + 1}</span>}
            <small>{id ? heroById(id).name : 'Chờ chọn'}</small>
          </div>
        );
      })}
      {draft.prebans[side] && draft.phase !== 'preban' && (
        <div className="ds-ban">
          Đã cấm: <b>{heroById(draft.prebans[side]!).name}</b>
        </div>
      )}
    </div>
  );

  return (
    <div className="select-screen draft">
      <div className="draft-top">
        <h2>{title}</h2>
        <b className={`timer ${cd.ms < 6000 ? 'low' : ''}`}>{Math.ceil(cd.ms / 1000)}</b>
        <button className="btn-mini" onClick={() => (end ? onLeave() : confirm('Đầu hàng trận này?') && onSurrender())}>
          {end ? 'Rời' : 'Đầu hàng'}
        </button>
      </div>
      {end && (
        <div className="season-reward">
          <span>{end.winner === my ? 'Đối thủ đã rời trận. Bạn thắng!' : 'Bạn đã đầu hàng.'}</span>
          <button className="btn-fight small" onClick={onLeave}>
            Về sảnh RTA
          </button>
        </div>
      )}
      <p className="hint center">{hint}</p>
      {err && <div className="form-error">{err}</div>}
      <div className="draft-main">
        {slots(my)}
        <div className="draft-grid">
          {grid.map((id) => {
            const h = heroById(id);
            const el = ELEMENT_INFO[h.element];
            const isBanned = banned.has(id);
            const taken = draft.picks[my].includes(id);
            return (
              <button
                key={id}
                className={`dg-hero ${isBanned ? 'banned' : ''} ${taken ? 'taken' : ''} ${myChoice === id ? 'chosen' : ''}`}
                style={{ '--el': el.css } as CSSProperties}
                disabled={!canChoose(id)}
                onClick={() => onChoose(id)}
                title={h.name}
              >
                <Portrait hero={h} size={64} />
                <span className="dg-el">{el.icon}</span>
                <b>{h.name}</b>
                {owned.has(id) && draft.phase !== 'postban' && <small>Lv60 · ★6</small>}
                {isBanned && <em className="ban-x">CẤM</em>}
              </button>
            );
          })}
        </div>
        {slots(op)}
      </div>
    </div>
  );
}
