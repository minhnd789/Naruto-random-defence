// RTA realtime: ghép trận theo điểm, cấm/chọn tướng, trận đấu theo lượt do server điều khiển
import { randomInt, randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { chooseAction } from '../../game/src/engine/ai';
import { Battle } from '../../game/src/engine/battle';
import { HEROES, heroById } from '../../game/src/engine/heroes';
import { HeroProgress, MAX_AWAKEN, MAX_STARS, UnitSetup, buildTeam, maxLevel, power } from '../../game/src/engine/progression';
import {
  DRAFT_TIMEOUT_MS,
  PICK_ORDER,
  RTA_MIN_HEROES,
  RTA_TEAM_SIZE,
  TURN_TIMEOUT_MS,
  eloDelta,
  seasonOf,
} from '../../game/src/engine/ranking';
import { TeamId } from '../../game/src/engine/types';
import { ensureRta, frontlineFirst } from './arena';
import { verifyToken } from './auth';
import { gearBonusByHero } from './gear';
import { Db } from './db';

type Side = TeamId;
const other = (s: Side): Side => (s === 'A' ? 'B' : 'A');

interface Seat {
  side: Side;
  userId: number | null; // null = bot
  name: string;
  rating: number;
  roster: Map<string, HeroProgress>;
  socket: WebSocket | null;
}

type Phase = 'preban' | 'pick' | 'postban' | 'battle' | 'ended';

export interface RtaOptions {
  draftTimeoutMs?: number;
  turnTimeoutMs?: number;
  botDelayMs?: [number, number];
}

const send = (ws: WebSocket | null | undefined, msg: unknown) => {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
};

class Match {
  id = randomUUID();
  season = seasonOf();
  phase: Phase = 'preban';
  prebans: Partial<Record<Side, string>> = {};
  picks: Record<Side, string[]> = { A: [], B: [] };
  postbans: Partial<Record<Side, string>> = {}; // tướng mà phe X cấm của đối thủ
  pickIndex = 0;
  deadline = 0;
  timer: NodeJS.Timeout | null = null;
  botTimer: NodeJS.Timeout | null = null;
  battle: Battle | null = null;
  seed = 0;
  teams: Record<Side, UnitSetup[]> = { A: [], B: [] };
  awaiting: { uid: string; side: Side } | null = null;
  log: unknown[] = []; // toàn bộ tin nhắn trận đấu, dùng để gửi lại khi kết nối lại
  ranked: boolean;

  constructor(
    public seats: Record<Side, Seat>,
    private mgr: RtaManager,
  ) {
    this.ranked = seats.A.userId !== null && seats.B.userId !== null;
  }

  seatOf(userId: number): Seat | null {
    return this.seats.A.userId === userId ? this.seats.A : this.seats.B.userId === userId ? this.seats.B : null;
  }

  broadcast(msg: unknown, keep = true) {
    if (keep) this.log.push(msg);
    send(this.seats.A.socket, msg);
    send(this.seats.B.socket, msg);
  }

  // ---------- Cấm / chọn ----------
  start() {
    for (const s of ['A', 'B'] as Side[]) send(this.seats[s].socket, this.matchInfo(s));
    this.enterPhase('preban');
  }

  matchInfo(side: Side) {
    const me = this.seats[side];
    const op = this.seats[other(side)];
    return {
      t: 'match',
      matchId: this.id,
      you: side,
      ranked: this.ranked,
      me: { name: me.name, rating: me.rating },
      opponent: { name: op.name, rating: op.rating, bot: op.userId === null },
    };
  }

  draftState() {
    return {
      t: 'draft',
      phase: this.phase,
      turn: this.phase === 'pick' ? PICK_ORDER[this.pickIndex] : 'both',
      pickIndex: this.pickIndex,
      deadline: this.deadline,
      prebans: this.prebans,
      picks: this.picks,
      postbans: this.postbans,
    };
  }

  private setTimer(ms: number, fn: () => void) {
    if (this.timer) clearTimeout(this.timer);
    this.deadline = Date.now() + ms;
    this.timer = setTimeout(fn, ms);
  }

  private enterPhase(phase: Phase) {
    this.phase = phase;
    if (phase === 'preban' || phase === 'postban') {
      this.setTimer(this.mgr.opts.draftTimeoutMs, () => this.draftTimeout());
      this.broadcast(this.draftState());
      this.scheduleBot();
    } else if (phase === 'pick') {
      this.setTimer(this.mgr.opts.draftTimeoutMs, () => this.draftTimeout());
      this.broadcast(this.draftState());
      this.scheduleBot();
    }
  }

  /** Tướng phe `side` còn được phép chọn. */
  availablePicks(side: Side): string[] {
    const banned = new Set([this.prebans.A, this.prebans.B].filter(Boolean) as string[]);
    return [...this.seats[side].roster.keys()].filter((id) => !banned.has(id) && !this.picks[side].includes(id));
  }

  private bestOf(side: Side, ids: string[]): string {
    const roster = this.seats[side].roster;
    const score = (id: string) => power(heroById(id), roster.get(id) ?? { level: 1, stars: heroById(id).rarity, awaken: 0 }) * (0.9 + Math.random() * 0.2);
    return [...ids].sort((a, b) => score(b) - score(a))[0];
  }

  /** Lựa chọn tự động khi hết giờ hoặc khi là bot. */
  private autoDraft(side: Side): string | null {
    if (this.phase === 'preban') {
      // Cấm tướng mạnh nhất của đối thủ
      const opRoster = [...this.seats[other(side)].roster.keys()];
      return this.seats[other(side)].userId === null ? HEROES[randomInt(0, HEROES.length)].id : this.bestOf(other(side), opRoster);
    }
    if (this.phase === 'pick') return this.bestOf(side, this.availablePicks(side));
    if (this.phase === 'postban') return this.bestOf(other(side), this.picks[other(side)]);
    return null;
  }

  private draftTimeout() {
    if (this.phase === 'preban' || this.phase === 'postban') {
      const map = this.phase === 'preban' ? this.prebans : this.postbans;
      for (const s of ['A', 'B'] as Side[]) if (!map[s]) map[s] = this.autoDraft(s)!;
      this.afterSimultaneous();
    } else if (this.phase === 'pick') {
      const side = PICK_ORDER[this.pickIndex];
      this.applyPick(side, this.autoDraft(side)!);
    }
  }

  private scheduleBot() {
    const bot = (['A', 'B'] as Side[]).find((s) => this.seats[s].userId === null);
    if (!bot) return;
    if (this.phase === 'pick' && PICK_ORDER[this.pickIndex] !== bot) return;
    if (this.botTimer) clearTimeout(this.botTimer);
    const [lo, hi] = this.mgr.opts.botDelayMs;
    this.botTimer = setTimeout(() => this.draftAction(bot, this.autoDraft(bot)!), randomInt(lo, hi + 1));
  }

  /** Người chơi gửi lựa chọn cấm/chọn. Trả về lỗi (nếu có). */
  draftAction(side: Side, heroId: string): string | null {
    if (!heroById(heroId)) return 'Ninja không hợp lệ';
    if (this.phase === 'preban') {
      if (this.prebans[side]) return 'Bạn đã cấm rồi';
      this.prebans[side] = heroId;
      // Cấm đồng thời: không tiết lộ cho đối thủ trước khi cả hai cùng chọn
      if (this.prebans.A && this.prebans.B) this.afterSimultaneous();
      return null;
    }
    if (this.phase === 'pick') {
      if (PICK_ORDER[this.pickIndex] !== side) return 'Chưa tới lượt chọn của bạn';
      if (!this.availablePicks(side).includes(heroId)) return 'Không thể chọn ninja này';
      this.applyPick(side, heroId);
      return null;
    }
    if (this.phase === 'postban') {
      if (this.postbans[side]) return 'Bạn đã cấm rồi';
      if (!this.picks[other(side)].includes(heroId)) return 'Chỉ được cấm ninja đối thủ đã chọn';
      this.postbans[side] = heroId;
      if (this.postbans.A && this.postbans.B) this.afterSimultaneous();
      return null;
    }
    return 'Không trong giai đoạn cấm/chọn';
  }

  private applyPick(side: Side, heroId: string) {
    this.picks[side].push(heroId);
    this.pickIndex++;
    if (this.pickIndex >= PICK_ORDER.length) this.enterPhase('postban');
    else this.enterPhase('pick');
  }

  private afterSimultaneous() {
    if (this.phase === 'preban') this.enterPhase('pick');
    else if (this.phase === 'postban') this.startBattle();
  }

  // ---------- Trận đấu ----------
  private startBattle() {
    if (this.timer) clearTimeout(this.timer);
    this.phase = 'battle';
    this.broadcast(this.draftState());
    for (const s of ['A', 'B'] as Side[]) {
      const ids = frontlineFirst(this.picks[s].filter((id) => id !== this.postbans[other(s)])).slice(0, RTA_TEAM_SIZE - 1);
      this.teams[s] = ids.map((id) => ({ heroId: id, ...this.seats[s].roster.get(id)! }));
    }
    this.seed = randomInt(1, 2 ** 31 - 1);
    this.battle = new Battle(buildTeam(this.teams.A), buildTeam(this.teams.B), this.seed);
    this.broadcast({ t: 'start', seed: this.seed, teamA: this.teams.A, teamB: this.teams.B });
    this.step();
  }

  private step() {
    const b = this.battle!;
    while (!b.over) {
      const t = b.nextTurn();
      if (!t) break;
      if (!t.canAct) continue;
      const side = t.actor.team;
      this.awaiting = { uid: t.actor.uid, side };
      this.deadline = Date.now() + this.mgr.opts.turnTimeoutMs;
      this.broadcast({ t: 'turn', actorUid: t.actor.uid, deadline: this.deadline });
      const seat = this.seats[side];
      // Bot hoặc người chơi mất kết nối: tự đánh sau một nhịp ngắn
      const quick = seat.userId === null || !seat.socket || seat.socket.readyState !== 1;
      const [lo, hi] = this.mgr.opts.botDelayMs;
      this.setTimer(quick ? randomInt(lo, hi + 1) : this.mgr.opts.turnTimeoutMs, () => this.autoAct());
      return;
    }
    this.end(b.winner!, 'ko');
  }

  private autoAct() {
    if (!this.awaiting || !this.battle) return;
    const actor = this.battle.unit(this.awaiting.uid);
    const c = chooseAction(this.battle, actor);
    this.act(this.awaiting.side, c.skillId, c.targetUid);
  }

  act(side: Side, skillId: string, targetUid?: string): string | null {
    if (this.phase !== 'battle' || !this.awaiting || !this.battle) return 'Không trong trận đấu';
    if (this.awaiting.side !== side) return 'Chưa tới lượt của bạn';
    const actor = this.battle.unit(this.awaiting.uid);
    const skill = actor.hero.skills.find((s) => s.id === skillId);
    if (!skill || !this.battle.skillReady(actor, skill)) return 'Kỹ năng không hợp lệ hoặc đang hồi';
    const uid = this.awaiting.uid;
    this.awaiting = null;
    if (this.timer) clearTimeout(this.timer);
    this.battle.act(uid, skillId, targetUid);
    this.broadcast({ t: 'action', actorUid: uid, skillId, targetUid });
    setImmediate(() => this.phase === 'battle' && this.step());
    return null;
  }

  surrender(side: Side) {
    if (this.phase === 'ended') return;
    this.end(other(side), 'surrender');
  }

  private async end(winner: Side, reason: 'ko' | 'surrender') {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    if (this.timer) clearTimeout(this.timer);
    if (this.botTimer) clearTimeout(this.botTimer);
    const changes: Record<Side, number> = { A: 0, B: 0 };
    if (this.ranked) {
      changes.A = eloDelta(this.seats.A.rating, this.seats.B.rating, winner === 'A' ? 1 : 0);
      changes.B = eloDelta(this.seats.B.rating, this.seats.A.rating, winner === 'B' ? 1 : 0);
    }
    try {
      await this.mgr.recordResult(this, winner, changes);
    } catch (e) {
      this.mgr.log('Lỗi ghi kết quả RTA', e);
    }
    this.broadcast({ t: 'end', winner, reason, changes, ratings: { A: this.seats.A.rating + changes.A, B: this.seats.B.rating + changes.B } });
    this.mgr.finish(this);
  }

  /** Kết nối lại giữa trận: gửi lại toàn bộ diễn biến. */
  resume(seat: Seat) {
    send(seat.socket, { ...this.matchInfo(seat.side), resumed: true });
    for (const m of this.log) send(seat.socket, m);
    if (this.phase !== 'battle') send(seat.socket, this.draftState());
  }
}

/** Mức phát triển mọi ninja trong RTA. */
const RTA_MAX = { level: maxLevel(MAX_STARS), stars: MAX_STARS, awaken: MAX_AWAKEN };

export class RtaManager {
  queue: { userId: number; rating: number; since: number; seat: Seat }[] = [];
  matches = new Map<string, Match>();
  byUser = new Map<number, Match>();
  sockets = new Map<number, WebSocket>();
  opts: Required<RtaOptions>;
  private ticker: NodeJS.Timeout;

  constructor(
    private db: Db,
    opts: RtaOptions = {},
    public log: (msg: string, e?: unknown) => void = () => {},
  ) {
    this.opts = {
      draftTimeoutMs: opts.draftTimeoutMs ?? DRAFT_TIMEOUT_MS,
      turnTimeoutMs: opts.turnTimeoutMs ?? TURN_TIMEOUT_MS,
      botDelayMs: opts.botDelayMs ?? [700, 1500],
    };
    this.ticker = setInterval(() => this.matchmake(), 1000);
  }

  close() {
    clearInterval(this.ticker);
    for (const m of this.matches.values()) {
      if (m.timer) clearTimeout(m.timer);
      if (m.botTimer) clearTimeout(m.botTimer);
    }
  }

  private async loadSeat(userId: number, side: Side, socket: WebSocket): Promise<Seat> {
    const u = (await this.db.query('SELECT display_name FROM users WHERE id = $1', [userId])).rows[0];
    const heroes = (await this.db.query('SELECT hero_id, level, stars, awaken FROM user_heroes WHERE user_id = $1', [userId])).rows;
    const gear = await gearBonusByHero(this.db, userId, heroes.map((h) => h.hero_id));
    // Chỉ tạo hồ sơ RTA khi đủ điều kiện, để người chưa đủ ninja không lọt vào bảng xếp hạng
    const rating = heroes.length >= RTA_MIN_HEROES ? (await this.db.tx((q) => ensureRta(q, userId))).rating : 0;
    return {
      side,
      userId,
      name: u.display_name,
      rating,
      // RTA đấu công bằng: ninja nào cũng tự lên tối đa (cấp, sao, thức tỉnh); chỉ trang bị là của riêng người chơi
      roster: new Map(heroes.map((h) => [h.hero_id, { ...RTA_MAX, gear: gear.get(h.hero_id) }])),
      socket,
    };
  }

  /** Bot luyện tập: dùng toàn bộ ninja, cũng ở mức tối đa như người chơi (không có trang bị). */
  private botSeat(side: Side, like: Seat): Seat {
    return {
      side,
      userId: null,
      name: 'Bot Huấn Luyện',
      rating: like.rating,
      roster: new Map(HEROES.map((h) => [h.id, { ...RTA_MAX }])),
      socket: null,
    };
  }

  async handle(userId: number, ws: WebSocket, raw: string) {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return send(ws, { t: 'error', message: 'Tin nhắn không hợp lệ' });
    }
    const match = this.byUser.get(userId);
    const seat = match?.seatOf(userId);
    const err = (message: string | null) => message && send(ws, { t: 'error', message });

    switch (msg.t) {
      case 'queue': {
        if (match) return err('Bạn đang trong một trận');
        if (this.queue.some((q) => q.userId === userId)) return err('Bạn đang tìm trận');
        const seatNew = await this.loadSeat(userId, 'A', ws);
        if (seatNew.roster.size < RTA_MIN_HEROES) return err(`Cần sở hữu ít nhất ${RTA_MIN_HEROES} ninja để vào RTA`);
        if (msg.mode === 'bot') {
          const m = new Match({ A: seatNew, B: this.botSeat('B', seatNew) }, this);
          this.register(m);
          m.start();
        } else {
          this.queue.push({ userId, rating: seatNew.rating, since: Date.now(), seat: seatNew });
          send(ws, { t: 'queued', rating: seatNew.rating });
          this.matchmake();
        }
        return;
      }
      case 'cancel':
        this.queue = this.queue.filter((q) => q.userId !== userId);
        return send(ws, { t: 'cancelled' });
      case 'ban':
      case 'pick':
      case 'postban':
        if (!match || !seat) return err('Bạn không ở trong trận');
        return err(match.draftAction(seat.side, String(msg.heroId)));
      case 'act':
        if (!match || !seat) return err('Bạn không ở trong trận');
        return err(match.act(seat.side, String(msg.skillId), typeof msg.targetUid === 'string' ? msg.targetUid : undefined));
      case 'surrender':
        if (match && seat) match.surrender(seat.side);
        return;
      default:
        return err('Lệnh không hỗ trợ');
    }
  }

  connect(userId: number, ws: WebSocket) {
    const old = this.sockets.get(userId);
    if (old && old !== ws) old.close(4000, 'Đăng nhập ở nơi khác');
    this.sockets.set(userId, ws);
    const match = this.byUser.get(userId);
    const seat = match?.seatOf(userId);
    if (match && seat) {
      seat.socket = ws;
      match.resume(seat);
    } else send(ws, { t: 'hello' });
  }

  disconnect(userId: number, ws: WebSocket) {
    if (this.sockets.get(userId) !== ws) return;
    this.sockets.delete(userId);
    this.queue = this.queue.filter((q) => q.userId !== userId);
    const seat = this.byUser.get(userId)?.seatOf(userId);
    if (seat) seat.socket = null;
  }

  /** Ghép hai người trong hàng chờ: khoảng điểm chấp nhận nới rộng theo thời gian chờ. */
  matchmake(): void {
    const now = Date.now();
    this.queue.sort((a, b) => a.since - b.since);
    for (let i = 0; i < this.queue.length; i++) {
      for (let j = i + 1; j < this.queue.length; j++) {
        const a = this.queue[i], b = this.queue[j];
        const window = 100 + 20 * Math.floor((now - Math.min(a.since, b.since)) / 1000);
        if (Math.abs(a.rating - b.rating) > window) continue;
        this.queue.splice(j, 1);
        this.queue.splice(i, 1);
        a.seat.side = 'A';
        b.seat.side = 'B';
        const m = new Match({ A: a.seat, B: b.seat }, this);
        this.register(m);
        m.start();
        this.matchmake();
        return;
      }
    }
  }

  private register(m: Match) {
    this.matches.set(m.id, m);
    for (const s of [m.seats.A, m.seats.B]) if (s.userId !== null) this.byUser.set(s.userId, m);
  }

  finish(m: Match) {
    this.matches.delete(m.id);
    for (const s of [m.seats.A, m.seats.B]) if (s.userId !== null && this.byUser.get(s.userId) === m) this.byUser.delete(s.userId);
  }

  async recordResult(m: Match, winner: Side, changes: Record<Side, number>) {
    await this.db.tx(async (q) => {
      for (const s of ['A', 'B'] as Side[]) {
        const seat = m.seats[s];
        if (seat.userId === null || !m.ranked) continue;
        await ensureRta(q, seat.userId, m.season);
        await q.query('UPDATE rta_players SET rating = GREATEST(0, rating + $3), wins = wins + $4, losses = losses + $5 WHERE user_id = $1 AND season = $2', [
          seat.userId, m.season, changes[s], winner === s ? 1 : 0, winner === s ? 0 : 1,
        ]);
      }
      await q.query('INSERT INTO rta_matches (id, season, a_user, b_user, winner, a_change, b_change, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [
        m.id, m.season, m.seats.A.userId, m.seats.B.userId, winner, changes.A, changes.B,
        JSON.stringify({ seed: m.seed, picks: m.picks, prebans: m.prebans, postbans: m.postbans, teams: m.teams }),
      ]);
    });
  }
}

export function registerRtaRoutes(app: FastifyInstance, db: Db, secret: Uint8Array, opts: RtaOptions = {}) {
  const mgr = new RtaManager(db, opts, (msg, e) => app.log.error({ err: e }, msg));
  app.addHook('onClose', async () => mgr.close());

  app.get<{ Querystring: { token?: string } }>('/api/rta/ws', { websocket: true }, async (socket, req) => {
    const userId = req.query.token ? await verifyToken(secret, req.query.token) : null;
    if (!userId) {
      socket.send(JSON.stringify({ t: 'error', message: 'Phiên đăng nhập không hợp lệ' }));
      return socket.close(4001, 'unauthorized');
    }
    mgr.connect(userId, socket);
    socket.on('message', (data) => {
      mgr.handle(userId, socket, data.toString()).catch((e) => {
        app.log.error(e);
        send(socket, { t: 'error', message: 'Lỗi máy chủ' });
      });
    });
    socket.on('close', () => mgr.disconnect(userId, socket));
  });

  app.get('/api/rta/status', async () => ({ queue: mgr.queue.length, matches: mgr.matches.size }));
  return mgr;
}
