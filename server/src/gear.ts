// Trang bị: lưu trữ, rơi đồ, mặc/tháo, phân giải
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  GEAR_SLOTS,
  GearBonus,
  GearItem,
  GearSlot,
  Rarity,
  SALVAGE_COINS,
  gearBonus,
  rollGear,
  rollRarity,
  rollSlot,
} from '../../game/src/engine/gear';
import { HEROES } from '../../game/src/engine/heroes';
import { Db, Queryable } from './db';
import { secureRandom } from './gacha';
import { HttpError, parse } from './http';
import { profile } from './profile';

const json = <T>(v: unknown): T => (typeof v === 'string' ? JSON.parse(v) : v) as T;

function rowToItem(r: any): GearItem {
  return { id: Number(r.id), slot: r.slot, rarity: r.rarity, ilvl: r.ilvl, main: json(r.main), subs: json(r.subs), heroId: r.hero_id ?? null };
}

export async function listGear(q: Queryable, userId: number): Promise<GearItem[]> {
  const { rows } = await q.query('SELECT * FROM gear WHERE user_id = $1 ORDER BY rarity DESC, ilvl DESC, id DESC', [userId]);
  return rows.map(rowToItem);
}

/** Tổng chỉ số trang bị của từng ninja (để chụp vào đội hình lúc vào trận). */
export async function gearBonusByHero(q: Queryable, userId: number, heroIds: string[]): Promise<Map<string, GearBonus>> {
  const { rows } = await q.query('SELECT * FROM gear WHERE user_id = $1 AND hero_id = ANY($2::text[])', [userId, heroIds]);
  const by = new Map<string, GearItem[]>();
  for (const r of rows) {
    const it = rowToItem(r);
    by.set(it.heroId!, [...(by.get(it.heroId!) ?? []), it]);
  }
  return new Map([...by].map(([h, items]) => [h, gearBonus(items)]));
}

export async function insertGear(q: Queryable, userId: number, item: Omit<GearItem, 'id' | 'heroId'>): Promise<GearItem> {
  const { rows } = await q.query(
    'INSERT INTO gear (user_id, slot, rarity, ilvl, main, subs) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [userId, item.slot, item.rarity, item.ilvl, JSON.stringify(item.main), JSON.stringify(item.subs)],
  );
  return rowToItem(rows[0]);
}

/** Rơi đồ sau trận thắng: `chance` xác suất có đồ, `bonus` đẩy phẩm chất lên (đánh trùm). */
export async function dropGear(q: Queryable, userId: number, ilvl: number, chance: number, bonus = 0, count = 1): Promise<GearItem[]> {
  const out: GearItem[] = [];
  for (let i = 0; i < count; i++) {
    if (secureRandom() >= chance) continue;
    const item = rollGear(secureRandom, rollSlot(secureRandom), rollRarity(secureRandom, bonus), Math.max(1, ilvl));
    out.push(await insertGear(q, userId, item));
  }
  return out;
}

/** Đồ khởi đầu cho tài khoản mới: 4 món Tinh Anh cấp 1. */
export async function grantStarterGear(q: Queryable, userId: number) {
  for (const slot of ['weapon', 'helmet', 'armor', 'boots'] as GearSlot[]) {
    await insertGear(q, userId, rollGear(secureRandom, slot, 1, 1));
  }
  await q.query('UPDATE users SET starter_gear = true WHERE id = $1', [userId]);
}

/** Tặng bù đồ khởi đầu cho tài khoản tạo trước khi có trang bị (chạy lúc server khởi động, mỗi tài khoản đúng một lần). */
export async function backfillStarterGear(db: Db): Promise<number> {
  const { rows } = await db.query('SELECT id FROM users WHERE starter_gear = false');
  let n = 0;
  for (const r of rows) {
    const done = await db.tx(async (q) => {
      const u = (await q.query('SELECT starter_gear FROM users WHERE id = $1 FOR UPDATE', [r.id])).rows[0];
      if (!u || u.starter_gear) return false;
      await grantStarterGear(q, r.id);
      return true;
    });
    if (done) n++;
  }
  return n;
}

const equipSchema = z.object({ heroId: z.string().refine((id) => HEROES.some((h) => h.id === id), 'Ninja không hợp lệ') });
const salvageSchema = z.object({ ids: z.array(z.number().int()).min(1).max(200) });
const grantSchema = z.object({
  count: z.number().int().min(1).max(50),
  rarity: z.number().int().min(0).max(5).optional(),
  ilvl: z.number().int().min(1).max(60).optional(),
  slot: z.enum(GEAR_SLOTS as [GearSlot, ...GearSlot[]]).optional(),
});

export function registerGearRoutes(app: FastifyInstance, db: Db, requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>, devTools: boolean) {
  const state = async (userId: number) => ({ gear: await listGear(db, userId), ...(await profile(db, userId)) });

  app.get('/api/gear', { preHandler: requireAuth }, async (req) => ({ gear: await listGear(db, req.userId) }));

  app.post<{ Params: { id: string } }>('/api/gear/:id/equip', { preHandler: requireAuth }, async (req) => {
    const { heroId } = parse(equipSchema, req.body);
    const id = Number(req.params.id);
    await db.tx(async (q) => {
      const it = (await q.query('SELECT * FROM gear WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, req.userId])).rows[0];
      if (!it) throw new HttpError(404, 'Không tìm thấy trang bị');
      const owned = await q.query('SELECT 1 FROM user_heroes WHERE user_id = $1 AND hero_id = $2', [req.userId, heroId]);
      if (!owned.rows.length) throw new HttpError(400, 'Bạn chưa sở hữu ninja này');
      // Ô đó của ninja đang có đồ khác thì tháo ra
      await q.query('UPDATE gear SET hero_id = NULL WHERE user_id = $1 AND hero_id = $2 AND slot = $3 AND id <> $4', [req.userId, heroId, it.slot, id]);
      await q.query('UPDATE gear SET hero_id = $3 WHERE id = $1 AND user_id = $2', [id, req.userId, heroId]);
    });
    return state(req.userId);
  });

  app.post<{ Params: { id: string } }>('/api/gear/:id/unequip', { preHandler: requireAuth }, async (req) => {
    const r = await db.query('UPDATE gear SET hero_id = NULL WHERE id = $1 AND user_id = $2 RETURNING id', [Number(req.params.id), req.userId]);
    if (!r.rows.length) throw new HttpError(404, 'Không tìm thấy trang bị');
    return state(req.userId);
  });

  app.post('/api/gear/salvage', { preHandler: requireAuth }, async (req) => {
    const { ids } = parse(salvageSchema, req.body);
    const coins = await db.tx(async (q) => {
      const { rows } = await q.query('DELETE FROM gear WHERE user_id = $1 AND id = ANY($2::bigint[]) AND hero_id IS NULL RETURNING rarity', [req.userId, ids]);
      if (rows.length !== ids.length) throw new HttpError(400, 'Có món đang được mặc hoặc không tồn tại, hãy tháo ra trước');
      const total = rows.reduce((s, r) => s + SALVAGE_COINS[r.rarity as Rarity], 0);
      await q.query('UPDATE users SET coins = coins + $2 WHERE id = $1', [req.userId, total]);
      return total;
    });
    return { coins, ...(await state(req.userId)) };
  });

  if (devTools) {
    app.post('/api/dev/gear', { preHandler: requireAuth }, async (req) => {
      const g = parse(grantSchema, req.body);
      await db.tx(async (q) => {
        for (let i = 0; i < g.count; i++) {
          const slot = g.slot ?? rollSlot(secureRandom);
          const rarity = (g.rarity ?? rollRarity(secureRandom)) as Rarity;
          await insertGear(q, req.userId, rollGear(secureRandom, slot, rarity, g.ilvl ?? 10));
        }
      });
      return state(req.userId);
    });
  }
}
