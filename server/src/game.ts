// Nâng cấp ninja, vượt ải, bí cảnh và xác thực trận đấu trên server
import { randomInt, randomUUID } from 'node:crypto';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ELEMENT_INFO, heroById } from '../../game/src/engine/heroes';
import {
  AWAKEN_COST,
  COINS_PER_BOOK,
  EXP_PER_BOOK,
  ITEMS,
  MAX_AWAKEN,
  MAX_STARS,
  STAR_COST,
  UnitSetup,
  applyExp,
  booksToMax,
  buildTeam,
  maxLevel,
  runeId,
} from '../../game/src/engine/progression';
import { replayBattle } from '../../game/src/engine/replay';
import {
  DUNGEON_TIERS,
  DungeonId,
  ELEMENTS,
  Reward,
  dungeonEnemies,
  dungeonReward,
  dungeonStamina,
  prevStageId,
  stageById,
  stageFirstClear,
  stageReward,
} from '../../game/src/engine/stages';
import { Element } from '../../game/src/engine/types';
import { arenaFinish, arenaPrepare } from './arena';
import { Db, Queryable } from './db';
import { secureRandom } from './gacha';
import { HttpError, parse } from './http';
import { addItems, changeStamina, profile, takeCoins, takeItem } from './profile';

const BATTLE_TTL_MS = 2 * 60 * 60 * 1000;

const levelSchema = z.object({ books: z.number().int().min(1).max(1000) });
const startSchema = z.object({
  mode: z.enum(['stage', 'dungeon', 'arena']),
  opponentId: z.string().max(40).optional(),
  stageId: z.string().max(10).optional(),
  dungeon: z.enum(['exp', 'rune', 'soul']).optional(),
  tier: z.number().int().min(1).max(DUNGEON_TIERS).optional(),
  element: z.enum(ELEMENTS as [Element, ...Element[]]).optional(),
  team: z.array(z.string()).length(5),
});
const finishSchema = z.object({
  battleId: z.string().uuid(),
  actions: z.array(z.object({ skillId: z.string().max(40), targetUid: z.string().max(4).optional() })).max(2000),
});

async function lockHero(q: Queryable, userId: number, heroId: string) {
  const h = (
    await q.query('SELECT hero_id, stars, level, exp, awaken, dupes FROM user_heroes WHERE user_id = $1 AND hero_id = $2 FOR UPDATE', [userId, heroId])
  ).rows[0];
  if (!h) throw new HttpError(404, 'Bạn chưa sở hữu ninja này');
  return h as { hero_id: string; stars: number; level: number; exp: number; awaken: number; dupes: number };
}

function mergeReward(a: Reward, b: Reward): Reward {
  const items = { ...a.items };
  for (const [k, v] of Object.entries(b.items)) items[k] = (items[k] ?? 0) + v;
  return { coins: a.coins + b.coins, gems: (a.gems ?? 0) + (b.gems ?? 0), items };
}

async function grant(q: Queryable, userId: number, r: Reward) {
  await q.query('UPDATE users SET coins = coins + $2, gems = gems + $3 WHERE id = $1', [userId, r.coins, r.gems ?? 0]);
  await addItems(q, userId, r.items);
}

/** Trận cũ chưa xong coi như bỏ cuộc; trận đấu trường bỏ dở bị tính thua để không né được việc mất điểm. */
async function abandonActive(q: Queryable, userId: number) {
  const active = (await q.query(`SELECT id, mode, target FROM battles WHERE user_id = $1 AND status = 'active' FOR UPDATE`, [userId])).rows;
  for (const b of active) {
    if (b.mode === 'arena') await arenaFinish(q, userId, typeof b.target === 'string' ? JSON.parse(b.target) : b.target, false);
  }
  await q.query(`UPDATE battles SET status = 'abandoned', finished_at = now() WHERE user_id = $1 AND status = 'active'`, [userId]);
}

export function registerGameRoutes(app: FastifyInstance, db: Db, requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>) {
  // ---------- Nâng cấp ----------
  app.post<{ Params: { heroId: string } }>('/api/hero/:heroId/level', { preHandler: requireAuth }, async (req) => {
    const { books } = parse(levelSchema, req.body);
    await db.tx(async (q) => {
      const h = await lockHero(q, req.userId, req.params.heroId);
      const need = booksToMax(h);
      if (need === 0) throw new HttpError(400, `Đã đạt cấp tối đa ${maxLevel(h.stars)} của ${h.stars}★, hãy nâng sao`);
      const use = Math.min(books, need);
      await takeItem(q, req.userId, 'exp_book', use, ITEMS.exp_book.name);
      await takeCoins(q, req.userId, use * COINS_PER_BOOK);
      const r = applyExp(h, use * EXP_PER_BOOK);
      await q.query('UPDATE user_heroes SET level = $3, exp = $4 WHERE user_id = $1 AND hero_id = $2', [req.userId, h.hero_id, r.level, r.exp]);
    });
    return profile(db, req.userId);
  });

  app.post<{ Params: { heroId: string } }>('/api/hero/:heroId/star', { preHandler: requireAuth }, async (req) => {
    await db.tx(async (q) => {
      const h = await lockHero(q, req.userId, req.params.heroId);
      if (h.stars >= MAX_STARS) throw new HttpError(400, 'Ninja đã đạt sao tối đa');
      if (h.level < maxLevel(h.stars)) throw new HttpError(400, `Cần đạt cấp ${maxLevel(h.stars)} trước khi nâng sao`);
      const cost = STAR_COST[h.stars];
      const fromDupes = Math.min(h.dupes, cost.shards);
      const fromStones = cost.shards - fromDupes;
      await takeItem(q, req.userId, 'soul_stone', fromStones, `mảnh linh hồn (thiếu ${fromStones} Linh Hồn Thạch)`);
      await takeCoins(q, req.userId, cost.coins);
      await q.query('UPDATE user_heroes SET stars = stars + 1, dupes = dupes - $3 WHERE user_id = $1 AND hero_id = $2', [req.userId, h.hero_id, fromDupes]);
    });
    return profile(db, req.userId);
  });

  app.post<{ Params: { heroId: string } }>('/api/hero/:heroId/awaken', { preHandler: requireAuth }, async (req) => {
    await db.tx(async (q) => {
      const h = await lockHero(q, req.userId, req.params.heroId);
      if (h.awaken >= MAX_AWAKEN) throw new HttpError(400, 'Ninja đã thức tỉnh tối đa');
      const cost = AWAKEN_COST[h.awaken + 1];
      if (h.level < cost.level) throw new HttpError(400, `Cần đạt cấp ${cost.level} để thức tỉnh bậc ${h.awaken + 1}`);
      const el = heroById(h.hero_id).element;
      await takeItem(q, req.userId, runeId(el), cost.runes, `Ấn Chú ${ELEMENT_INFO[el].name}`);
      await takeCoins(q, req.userId, cost.coins);
      await q.query('UPDATE user_heroes SET awaken = awaken + 1 WHERE user_id = $1 AND hero_id = $2', [req.userId, h.hero_id]);
    });
    return profile(db, req.userId);
  });

  // ---------- Trận đấu ----------
  app.post('/api/battle/start', { preHandler: requireAuth }, async (req) => {
    const body = parse(startSchema, req.body);
    if (new Set(body.team).size !== 5) throw new HttpError(400, 'Mỗi ninja chỉ được xếp một lần');

    let enemies: UnitSetup[] = [];
    let cost = 0;
    let target: Record<string, unknown> = {};
    if (body.mode === 'arena') {
      if (!body.opponentId) throw new HttpError(400, 'Thiếu đối thủ');
    } else if (body.mode === 'stage') {
      const stage = body.stageId ? stageById(body.stageId) : undefined;
      if (!stage) throw new HttpError(404, 'Không có ải này');
      enemies = stage.enemies;
      cost = stage.stamina;
      target = { stageId: stage.id };
    } else {
      if (!body.dungeon || !body.tier) throw new HttpError(400, 'Thiếu thông tin bí cảnh');
      if (body.dungeon === 'rune' && !body.element) throw new HttpError(400, 'Hãy chọn hệ cho Đền Ấn Chú');
      const element = body.dungeon === 'rune' ? body.element : undefined;
      enemies = dungeonEnemies(body.dungeon, body.tier, element);
      cost = dungeonStamina(body.tier);
      target = { dungeon: body.dungeon, tier: body.tier, element };
    }

    const result = await db.tx(async (q) => {
      // Kiểm tra mở khóa
      if (body.mode === 'stage') {
        const prev = prevStageId(body.stageId!);
        if (prev && !(await q.query('SELECT 1 FROM stage_clears WHERE user_id = $1 AND stage_id = $2', [req.userId, prev])).rows.length)
          throw new HttpError(403, `Hãy vượt ải ${prev} trước`);
      } else if (body.mode === 'arena') {
        const a = await arenaPrepare(q, req.userId, body.opponentId!);
        enemies = a.enemies;
        target = a.target;
      } else if (body.tier! > 1) {
        const ok = await q.query('SELECT 1 FROM dungeon_clears WHERE user_id = $1 AND dungeon_id = $2 AND tier = $3', [req.userId, body.dungeon, body.tier! - 1]);
        if (!ok.rows.length) throw new HttpError(403, `Hãy vượt bậc ${body.tier! - 1} trước`);
      }
      const rows = (
        await q.query('SELECT hero_id, level, stars, awaken FROM user_heroes WHERE user_id = $1 AND hero_id = ANY($2::text[])', [req.userId, body.team])
      ).rows;
      if (rows.length !== 5) throw new HttpError(400, 'Đội hình có ninja bạn chưa sở hữu');
      const team: UnitSetup[] = body.team.map((id) => {
        const r = rows.find((x) => x.hero_id === id)!;
        return { heroId: id, level: r.level, stars: r.stars, awaken: r.awaken };
      });
      if (cost) await changeStamina(q, req.userId, -cost);
      await q.query('UPDATE users SET team = $2 WHERE id = $1', [req.userId, JSON.stringify(body.team)]);
      await abandonActive(q, req.userId);
      const id = randomUUID();
      const seed = randomInt(1, 2 ** 31 - 1);
      await q.query('INSERT INTO battles (id, user_id, mode, target, seed, team, enemy) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
        id, req.userId, body.mode, JSON.stringify(target), seed, JSON.stringify(team), JSON.stringify(enemies),
      ]);
      return { battleId: id, seed, team, enemies };
    });
    return { battle: result, ...(await profile(db, req.userId)) };
  });

  app.post('/api/battle/finish', { preHandler: requireAuth }, async (req) => {
    const { battleId, actions } = parse(finishSchema, req.body);
    const out = await db.tx(async (q) => {
      const b = (await q.query('SELECT * FROM battles WHERE id = $1 AND user_id = $2 FOR UPDATE', [battleId, req.userId])).rows[0];
      if (!b) throw new HttpError(404, 'Không tìm thấy trận đấu');
      if (b.status !== 'active') throw new HttpError(409, 'Trận đấu này đã được ghi nhận');
      const json = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v);
      const team = json(b.team) as UnitSetup[];
      const enemy = json(b.enemy) as UnitSetup[];
      const target = json(b.target) as { stageId?: string; dungeon?: DungeonId; tier?: number; element?: Element } & Record<string, any>;
      const expired = Date.now() - new Date(b.created_at).getTime() > BATTLE_TTL_MS;

      const replay = replayBattle(buildTeam(team), buildTeam(enemy), Number(b.seed), actions);
      const victory = !expired && replay.winner === 'A';
      let reward: Reward | null = null;
      let firstClear: Reward | null = null;
      let arena: { ratingChange: number; newRating: number } | null = null;

      if (b.mode === 'arena') {
        const r = await arenaFinish(q, req.userId, target as any, victory);
        reward = r.reward;
        arena = { ratingChange: r.ratingChange, newRating: r.newRating };
      } else if (victory) {
        if (b.mode === 'stage') {
          const stage = stageById(target.stageId!)!;
          reward = stageReward(stage);
          // Rơi ngẫu nhiên: Ấn Chú một hệ bất kỳ, hiếm khi rơi Linh Hồn Thạch
          if (secureRandom() < 0.25) reward.items[runeId(ELEMENTS[Math.floor(secureRandom() * ELEMENTS.length)])] = 1;
          if (secureRandom() < 0.08) reward.items.soul_stone = (reward.items.soul_stone ?? 0) + 1;
          const ins = await q.query(
            `INSERT INTO stage_clears (user_id, stage_id) VALUES ($1, $2)
             ON CONFLICT (user_id, stage_id) DO UPDATE SET clears = stage_clears.clears + 1 RETURNING clears`,
            [req.userId, stage.id],
          );
          if (ins.rows[0].clears === 1) firstClear = stageFirstClear(stage);
        } else {
          const t = target.tier!;
          reward = dungeonReward(target.dungeon!, t, target.element);
          if (target.dungeon === 'exp') reward.items.exp_book += Math.floor(secureRandom() * 3);
          if (target.dungeon === 'rune' && secureRandom() < 0.5) reward.items[runeId(target.element!)] += 1;
          if (target.dungeon === 'soul' && secureRandom() < 0.3) reward.items.soul_stone += 1;
          await q.query(
            `INSERT INTO dungeon_clears (user_id, dungeon_id, tier) VALUES ($1, $2, $3)
             ON CONFLICT (user_id, dungeon_id, tier) DO UPDATE SET clears = dungeon_clears.clears + 1`,
            [req.userId, target.dungeon, t],
          );
        }
        await grant(q, req.userId, firstClear ? mergeReward(reward, firstClear) : reward);
      }
      const result = { victory, turns: replay.turns, reward, firstClear, arena, expired, error: replay.error ?? null };
      await q.query('UPDATE battles SET status = $2, result = $3, finished_at = now() WHERE id = $1', [battleId, victory ? 'won' : 'lost', JSON.stringify(result)]);
      // Kết quả client báo thắng nhưng replay thua: ghi log để theo dõi gian lận
      if (replay.error) app.log.warn({ userId: req.userId, battleId, error: replay.error }, 'replay không hợp lệ');
      return result;
    });
    return { ...out, ...(await profile(db, req.userId)) };
  });
}
