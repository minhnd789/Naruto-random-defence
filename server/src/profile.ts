// Hồ sơ người chơi, thể lực, kho đồ
import { Queryable } from './db';
import { BANNERS } from './gacha';
import { HttpError } from './http';

export const STAMINA_MAX = 100;
export const STAMINA_REGEN_MS = 3 * 60 * 1000; // 1 thể lực / 3 phút

/** Tài nguyên tự hồi theo thời gian (thể lực, vé đấu trường). */
export function regen(stored: number, at: Date, max: number, interval: number, now = new Date()): { value: number; at: Date } {
  if (stored >= max) return { value: stored, at: now };
  const ticks = Math.floor((now.getTime() - at.getTime()) / interval);
  const value = Math.min(max, stored + ticks);
  return { value, at: value >= max ? now : new Date(at.getTime() + ticks * interval) };
}

export const currentStamina = (stored: number, at: Date, now = new Date()) => regen(stored, at, STAMINA_MAX, STAMINA_REGEN_MS, now);

/** Cộng/trừ thể lực trong transaction (đã khóa dòng users). */
export async function changeStamina(q: Queryable, userId: number, delta: number) {
  const u = (await q.query('SELECT stamina, stamina_at FROM users WHERE id = $1 FOR UPDATE', [userId])).rows[0];
  const cur = currentStamina(u.stamina, new Date(u.stamina_at));
  if (cur.value + delta < 0) throw new HttpError(400, `Không đủ thể lực (cần ${-delta}, còn ${cur.value})`);
  await q.query('UPDATE users SET stamina = $2, stamina_at = $3 WHERE id = $1', [userId, cur.value + delta, cur.at]);
}

export async function addItems(q: Queryable, userId: number, items: Record<string, number>) {
  for (const [item, qty] of Object.entries(items)) {
    if (qty <= 0) continue;
    await q.query(
      `INSERT INTO inventory (user_id, item_id, qty) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, item_id) DO UPDATE SET qty = inventory.qty + EXCLUDED.qty`,
      [userId, item, qty],
    );
  }
}

export async function takeItem(q: Queryable, userId: number, item: string, qty: number, label: string) {
  if (qty <= 0) return;
  const r = await q.query('UPDATE inventory SET qty = qty - $3 WHERE user_id = $1 AND item_id = $2 AND qty >= $3 RETURNING qty', [userId, item, qty]);
  if (!r.rows.length) throw new HttpError(400, `Không đủ ${label}`);
}

export async function takeCoins(q: Queryable, userId: number, coins: number) {
  if (coins <= 0) return;
  const r = await q.query('UPDATE users SET coins = coins - $2 WHERE id = $1 AND coins >= $2 RETURNING coins', [userId, coins]);
  if (!r.rows.length) throw new HttpError(400, `Không đủ Xu (cần ${coins.toLocaleString('vi-VN')})`);
}

export async function profile(q: Queryable, userId: number) {
  const u = (
    await q.query(
      `SELECT id, username, display_name, coins, gems, scrolls, team, stamina, stamina_at,
              (last_daily IS NULL OR last_daily < CURRENT_DATE) AS daily_available
         FROM users WHERE id = $1`,
      [userId],
    )
  ).rows[0];
  const heroes = (
    await q.query('SELECT hero_id, stars, level, exp, awaken, dupes FROM user_heroes WHERE user_id = $1 ORDER BY obtained_at, hero_id', [userId])
  ).rows;
  const pityRows = (await q.query('SELECT banner_id, pity, total FROM gacha_pity WHERE user_id = $1', [userId])).rows;
  const inv = (await q.query('SELECT item_id, qty FROM inventory WHERE user_id = $1 AND qty > 0', [userId])).rows;
  const stages = (await q.query('SELECT stage_id FROM stage_clears WHERE user_id = $1', [userId])).rows;
  const dungeons = (await q.query('SELECT dungeon_id, MAX(tier) AS tier FROM dungeon_clears WHERE user_id = $1 GROUP BY dungeon_id', [userId])).rows;

  const pity: Record<string, { pity: number; total: number }> = {};
  for (const b of Object.keys(BANNERS)) pity[b] = { pity: 0, total: 0 };
  for (const r of pityRows) pity[r.banner_id] = { pity: r.pity, total: r.total };
  const st = currentStamina(u.stamina, new Date(u.stamina_at));
  return {
    user: {
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      coins: u.coins,
      gems: u.gems,
      scrolls: u.scrolls,
      dailyAvailable: !!u.daily_available,
      stamina: st.value,
      staminaMax: STAMINA_MAX,
      // mili-giây tới lần hồi thể lực tiếp theo (null khi đã đầy)
      staminaNextMs: st.value >= STAMINA_MAX ? null : STAMINA_REGEN_MS - ((Date.now() - st.at.getTime()) % STAMINA_REGEN_MS),
    },
    heroes: heroes.map((h) => ({ heroId: h.hero_id, stars: h.stars, level: h.level, exp: h.exp, awaken: h.awaken, dupes: h.dupes })),
    team: (typeof u.team === 'string' ? JSON.parse(u.team) : u.team) as string[],
    pity,
    inventory: Object.fromEntries(inv.map((r) => [r.item_id, r.qty])) as Record<string, number>,
    stageClears: stages.map((r) => r.stage_id as string),
    dungeonClears: Object.fromEntries(dungeons.map((r) => [r.dungeon_id, Number(r.tier)])) as Record<string, number>,
  };
}
