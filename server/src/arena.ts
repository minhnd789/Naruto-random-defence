// Đấu trường thường: đánh đội phòng thủ (AI điều khiển) của người chơi khác, xếp hạng theo mùa
import { randomInt } from 'node:crypto';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HEROES, heroById } from '../../game/src/engine/heroes';
import { UnitSetup, power } from '../../game/src/engine/progression';
import {
  ARENA_BASE,
  ARENA_LOSS,
  ARENA_TICKETS_MAX,
  ARENA_TICKET_REGEN_MS,
  ARENA_WIN,
  RTA_BASE,
  TIERS,
  eloDelta,
  seasonEndsAt,
  seasonOf,
  softReset,
  tierOf,
} from '../../game/src/engine/ranking';
import { Rng } from '../../game/src/engine/rng';
import { enemySetup, Reward } from '../../game/src/engine/stages';
import { Db, Queryable } from './db';
import { HttpError, parse } from './http';
import { profile, regen } from './profile';

export interface Opponent {
  id: string; // "u:<userId>" hoặc "bot:<n>"
  name: string;
  rating: number;
  power: number;
  team: UnitSetup[];
  fought: boolean;
}

const BOT_NAMES = [
  'Kẻ Lang Thang', 'Ẩn Giả Sương Mù', 'Kiếm Khách Vô Danh', 'Ninja Mặt Nạ', 'Lữ Khách Cát Vàng', 'Hồ Ly Đêm',
  'Bóng Ma Rừng Tre', 'Sát Thủ Mưa Phùn', 'Đao Phủ Núi Đá', 'Thầy Bói Làng Mây', 'Cung Thủ Sấm Sét', 'Độc Nhãn Long',
];

const json = <T>(v: unknown): T => (typeof v === 'string' ? JSON.parse(v) : v) as T;
const teamSchema = z.object({ team: z.array(z.string()).length(5) });

/** Xếp đội bot: đỡ đòn lên hàng trước, hỗ trợ và hồi máu ra sau. */
export function frontlineFirst(ids: string[]): string[] {
  const score = (id: string) => (heroById(id).role === 'tank' ? 0 : heroById(id).role === 'healer' || heroById(id).role === 'support' ? 2 : 1);
  return [...ids].sort((a, b) => score(a) - score(b));
}

/** Lấy hồ sơ đấu trường của mùa hiện tại; tạo mới (giảm chênh lệch điểm mùa trước) nếu chưa có. */
export async function ensureArena(q: Queryable, userId: number, season = seasonOf()) {
  let row = (await q.query('SELECT * FROM arena_players WHERE user_id = $1 AND season = $2 FOR UPDATE', [userId, season])).rows[0];
  if (!row) {
    const prev = (await q.query('SELECT rating FROM arena_players WHERE user_id = $1 AND season = $2', [userId, season - 1])).rows[0];
    const rating = prev ? softReset(prev.rating, ARENA_BASE) : ARENA_BASE;
    await q.query('INSERT INTO arena_players (user_id, season, rating) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [userId, season, rating]);
    row = (await q.query('SELECT * FROM arena_players WHERE user_id = $1 AND season = $2 FOR UPDATE', [userId, season])).rows[0];
  }
  return row;
}

export async function ensureRta(q: Queryable, userId: number, season = seasonOf()) {
  let row = (await q.query('SELECT * FROM rta_players WHERE user_id = $1 AND season = $2', [userId, season])).rows[0];
  if (!row) {
    const prev = (await q.query('SELECT rating FROM rta_players WHERE user_id = $1 AND season = $2', [userId, season - 1])).rows[0];
    const rating = prev ? softReset(prev.rating, RTA_BASE) : RTA_BASE;
    await q.query('INSERT INTO rta_players (user_id, season, rating) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [userId, season, rating]);
    row = (await q.query('SELECT * FROM rta_players WHERE user_id = $1 AND season = $2', [userId, season])).rows[0];
  }
  return row;
}

/** Đội phòng thủ (mặc định = đội hình chiến đấu) kèm chỉ số tiến trình hiện tại. */
export async function defenseOf(q: Queryable, userId: number): Promise<UnitSetup[]> {
  const u = (await q.query('SELECT team, defense FROM users WHERE id = $1', [userId])).rows[0];
  let ids = json<string[]>(u.defense);
  if (ids.length !== 5) ids = json<string[]>(u.team);
  const rows = (await q.query('SELECT hero_id, level, stars, awaken FROM user_heroes WHERE user_id = $1 AND hero_id = ANY($2::text[])', [userId, ids])).rows;
  return ids
    .map((id) => rows.find((r) => r.hero_id === id))
    .filter(Boolean)
    .map((r) => ({ heroId: r.hero_id, level: r.level, stars: r.stars, awaken: r.awaken }));
}

const teamPower = (t: UnitSetup[]) => t.reduce((s, u) => s + power(heroById(u.heroId), u), 0);

/** Đối thủ bot cho lúc chưa đủ người chơi thật: mạnh xấp xỉ đội của người chơi. */
function makeBot(rng: Rng, myLevel: number, myRating: number): Opponent {
  const pool = [...HEROES].sort(() => rng.next() - 0.5);
  const ids = frontlineFirst(pool.slice(0, 5).map((h) => h.id));
  const level = Math.max(1, Math.min(60, myLevel + Math.floor(rng.range(-2, 3))));
  const team = ids.map((id) => enemySetup(id, level));
  const n = Math.floor(rng.range(0, BOT_NAMES.length));
  return {
    id: `bot:${Math.floor(rng.range(1, 1e9))}`,
    name: `${BOT_NAMES[n]} #${Math.floor(rng.range(10, 999))}`,
    rating: Math.max(800, myRating + Math.floor(rng.range(-80, 80))),
    power: teamPower(team),
    team,
    fought: false,
  };
}

async function refreshOpponents(q: Queryable, userId: number, season: number, rating: number): Promise<Opponent[]> {
  const mine = await defenseOf(q, userId);
  const avgLevel = Math.round(mine.reduce((s, u) => s + u.level, 0) / Math.max(1, mine.length));
  // Người chơi thật có điểm gần nhau
  const cands = (
    await q.query(
      `SELECT a.user_id, a.rating, u.display_name FROM arena_players a JOIN users u ON u.id = a.user_id
        WHERE a.season = $1 AND a.user_id <> $2 AND ABS(a.rating - $3) <= 300
        ORDER BY random() LIMIT 3`,
      [season, userId, rating],
    )
  ).rows;
  const out: Opponent[] = [];
  for (const c of cands) {
    const team = await defenseOf(q, c.user_id);
    if (team.length !== 5) continue;
    out.push({ id: `u:${c.user_id}`, name: c.display_name, rating: c.rating, power: teamPower(team), team, fought: false });
  }
  const rng = new Rng(randomInt(1, 2 ** 31 - 1));
  while (out.length < 3) out.push(makeBot(rng, avgLevel, rating));
  out.sort((a, b) => b.rating - a.rating);
  await q.query('UPDATE arena_players SET opponents = $3 WHERE user_id = $1 AND season = $2', [userId, season, JSON.stringify(out)]);
  return out;
}

function ticketsOf(row: any) {
  return regen(row.tickets, new Date(row.tickets_at), ARENA_TICKETS_MAX, ARENA_TICKET_REGEN_MS);
}

/** Gọi trong transaction khi bắt đầu trận đấu trường: trừ vé, trả về đội phòng thủ của đối thủ. */
export async function arenaPrepare(q: Queryable, userId: number, opponentId: string) {
  const season = seasonOf();
  const row = await ensureArena(q, userId, season);
  const opps = json<Opponent[]>(row.opponents);
  const opp = opps.find((o) => o.id === opponentId);
  if (!opp) throw new HttpError(404, 'Đối thủ không còn trong danh sách, hãy làm mới');
  if (opp.fought) throw new HttpError(409, 'Bạn đã đấu với đối thủ này, hãy làm mới danh sách');
  const t = ticketsOf(row);
  if (t.value < 1) throw new HttpError(400, 'Hết vé đấu trường, vé hồi 1 lượt mỗi 30 phút');
  await q.query('UPDATE arena_players SET tickets = $3, tickets_at = $4 WHERE user_id = $1 AND season = $2', [userId, season, t.value - 1, t.at]);
  return { enemies: opp.team, target: { opponentId: opp.id, name: opp.name, rating: opp.rating, season } };
}

/** Gọi trong transaction khi trận đấu trường kết thúc: cập nhật Elo hai bên, nhật ký, phần thưởng. */
export async function arenaFinish(q: Queryable, userId: number, target: { opponentId: string; name: string; rating: number; season: number }, victory: boolean) {
  const row = await ensureArena(q, userId, target.season);
  const delta = eloDelta(row.rating, target.rating, victory ? 1 : 0);
  await q.query(
    `UPDATE arena_players SET rating = GREATEST(0, rating + $3), wins = wins + $4, losses = losses + $5 WHERE user_id = $1 AND season = $2`,
    [userId, target.season, delta, victory ? 1 : 0, victory ? 0 : 1],
  );
  // Người phòng thủ thật bị trừ/cộng một nửa
  let defChange = 0;
  let defenderId: number | null = null;
  if (target.opponentId.startsWith('u:')) {
    defenderId = Number(target.opponentId.slice(2));
    const d = await ensureArena(q, defenderId, target.season);
    defChange = Math.round(eloDelta(d.rating, row.rating, victory ? 0 : 1) / 2);
    await q.query('UPDATE arena_players SET rating = GREATEST(0, rating + $3) WHERE user_id = $1 AND season = $2', [defenderId, target.season, defChange]);
  }
  const opps = json<Opponent[]>(row.opponents).map((o) => (o.id === target.opponentId ? { ...o, fought: true } : o));
  await q.query('UPDATE arena_players SET opponents = $3 WHERE user_id = $1 AND season = $2', [userId, target.season, JSON.stringify(opps)]);
  await q.query(
    'INSERT INTO arena_log (season, attacker, defender, defender_name, win, att_change, def_change) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [target.season, userId, defenderId, target.name, victory, delta, defChange],
  );
  const r = victory ? ARENA_WIN : ARENA_LOSS;
  const reward: Reward = { coins: r.coins, gems: r.gems, items: {} };
  await q.query('UPDATE users SET coins = coins + $2, gems = gems + $3 WHERE id = $1', [userId, reward.coins, reward.gems ?? 0]);
  return { reward, ratingChange: delta, newRating: row.rating + delta };
}

async function leaderboard(db: Db, table: 'arena_players' | 'rta_players', season: number) {
  const { rows } = await db.query(
    `SELECT p.user_id, u.display_name, p.rating, p.wins, p.losses FROM ${table} p JOIN users u ON u.id = p.user_id
      WHERE p.season = $1 ORDER BY p.rating DESC, p.wins DESC LIMIT 50`,
    [season],
  );
  return rows.map((r, i) => ({ rank: i + 1, userId: r.user_id, name: r.display_name, rating: r.rating, wins: r.wins, losses: r.losses }));
}

export function registerArenaRoutes(app: FastifyInstance, db: Db, requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>) {
  async function state(userId: number) {
    const season = seasonOf();
    return db.tx(async (q) => {
      const row = await ensureArena(q, userId, season);
      let opponents = json<Opponent[]>(row.opponents);
      if (!opponents.length) opponents = await refreshOpponents(q, userId, season, row.rating);
      const rank = (await q.query('SELECT COUNT(*)::int AS n FROM arena_players WHERE season = $1 AND rating > $2', [season, row.rating])).rows[0].n + 1;
      const t = ticketsOf(row);
      const prev = (await q.query('SELECT rating, reward_claimed FROM arena_players WHERE user_id = $1 AND season = $2', [userId, season - 1])).rows[0];
      const defense = await defenseOf(q, userId);
      return {
        season,
        endsAt: seasonEndsAt(season),
        me: {
          rating: row.rating,
          wins: row.wins,
          losses: row.losses,
          rank,
          tickets: t.value,
          ticketsMax: ARENA_TICKETS_MAX,
          ticketNextMs: t.value >= ARENA_TICKETS_MAX ? null : ARENA_TICKET_REGEN_MS - ((Date.now() - t.at.getTime()) % ARENA_TICKET_REGEN_MS),
        },
        opponents: opponents.map(({ team, ...o }) => ({ ...o, team })),
        defense,
        pendingReward: prev && !prev.reward_claimed ? { season: season - 1, rating: prev.rating, tier: tierOf(prev.rating).id, reward: tierOf(prev.rating).reward } : null,
      };
    });
  }

  app.get('/api/arena', { preHandler: requireAuth }, async (req) => state(req.userId));

  app.post('/api/arena/refresh', { preHandler: requireAuth }, async (req) => {
    await db.tx(async (q) => {
      const row = await ensureArena(q, req.userId);
      await refreshOpponents(q, req.userId, row.season, row.rating);
    });
    return state(req.userId);
  });

  app.put('/api/arena/defense', { preHandler: requireAuth }, async (req) => {
    const { team } = parse(teamSchema, req.body);
    if (new Set(team).size !== 5) throw new HttpError(400, 'Mỗi ninja chỉ được xếp một lần');
    const owned = await db.query('SELECT hero_id FROM user_heroes WHERE user_id = $1 AND hero_id = ANY($2::text[])', [req.userId, team]);
    if (owned.rows.length !== 5) throw new HttpError(400, 'Đội phòng thủ có ninja bạn chưa sở hữu');
    await db.query('UPDATE users SET defense = $2 WHERE id = $1', [req.userId, JSON.stringify(team)]);
    return state(req.userId);
  });

  app.post('/api/arena/claim', { preHandler: requireAuth }, async (req) => {
    const season = seasonOf() - 1;
    const reward = await db.tx(async (q) => {
      const prev = (await q.query('SELECT rating, reward_claimed FROM arena_players WHERE user_id = $1 AND season = $2 FOR UPDATE', [req.userId, season])).rows[0];
      if (!prev || prev.reward_claimed) throw new HttpError(409, 'Không có thưởng mùa để nhận');
      const r = tierOf(prev.rating).reward;
      await q.query('UPDATE arena_players SET reward_claimed = true WHERE user_id = $1 AND season = $2', [req.userId, season]);
      await q.query('UPDATE users SET coins = coins + $2, gems = gems + $3 WHERE id = $1', [req.userId, r.coins, r.gems]);
      return r;
    });
    return { reward, ...(await profile(db, req.userId)), arena: await state(req.userId) };
  });

  app.get<{ Querystring: { type?: string } }>('/api/leaderboard', { preHandler: requireAuth }, async (req) => {
    const season = seasonOf();
    const type = req.query.type === 'rta' ? 'rta' : 'arena';
    return { season, type, tiers: TIERS, rows: await leaderboard(db, type === 'rta' ? 'rta_players' : 'arena_players', season) };
  });

  app.get('/api/rta/me', { preHandler: requireAuth }, async (req) => {
    const season = seasonOf();
    const row = (await db.query('SELECT rating, wins, losses FROM rta_players WHERE user_id = $1 AND season = $2', [req.userId, season])).rows[0];
    const rating = row?.rating ?? RTA_BASE;
    const rank = row ? (await db.query('SELECT COUNT(*)::int AS n FROM rta_players WHERE season = $1 AND rating > $2', [season, rating])).rows[0].n + 1 : null;
    const heroes = (await db.query('SELECT COUNT(*)::int AS n FROM user_heroes WHERE user_id = $1', [req.userId])).rows[0].n;
    return { season, endsAt: seasonEndsAt(season), rating, wins: row?.wins ?? 0, losses: row?.losses ?? 0, rank, heroes };
  });

  app.get('/api/arena/log', { preHandler: requireAuth }, async (req) => {
    const attacks = (
      await db.query('SELECT defender_name AS name, win, att_change AS change, created_at FROM arena_log WHERE attacker = $1 ORDER BY id DESC LIMIT 20', [req.userId])
    ).rows;
    const defenses = (
      await db.query(
        `SELECT u.display_name AS name, NOT l.win AS win, l.def_change AS change, l.created_at FROM arena_log l JOIN users u ON u.id = l.attacker
          WHERE l.defender = $1 ORDER BY l.id DESC LIMIT 20`,
        [req.userId],
      )
    ).rows;
    return { attacks, defenses };
  });
}
