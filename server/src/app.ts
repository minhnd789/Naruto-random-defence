// Các API của game: tài khoản, hồ sơ, gacha, đội hình
import websocket from '@fastify/websocket';
import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HEROES, STARTER_HEROES, heroById } from '../../game/src/engine/heroes';
import { RateLimiter, hashPassword, signToken, verifyPassword, verifyToken } from './auth';
import { Db } from './db';
import { registerArenaRoutes } from './arena';
import { registerGameRoutes } from './game';
import { grantStarterGear, registerGearRoutes } from './gear';
import { registerRtaRoutes, RtaOptions } from './rta';
import { HttpError, parse } from './http';
import { addItems, changeStamina, profile } from './profile';
import { BANNERS, roll } from './gacha';

const START_WALLET = { coins: 10000, gems: 3000, scrolls: 20 };
const DAILY = { coins: 5000, gems: 300, scrolls: 5, stamina: 50 };
const START_ITEMS = { exp_book: 20 };
const DEFAULT_TEAM = ['gaara', 'kisame', 'kakashi', 'sakura', 'hinata'];

const credSchema = z.object({
  username: z.string().trim().regex(/^[a-zA-Z0-9_]{3,20}$/, 'Tên đăng nhập 3–20 ký tự, chỉ gồm chữ, số, dấu _'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').max(72, 'Mật khẩu tối đa 72 ký tự'),
});
const pullSchema = z.object({ banner: z.enum(['normal', 'premium']), count: z.union([z.literal(1), z.literal(10)]) });
const teamSchema = z.object({ team: z.array(z.string()).length(5) });
const grantSchema = z.object({
  gems: z.number().int().min(0).max(100000).optional(),
  scrolls: z.number().int().min(0).max(10000).optional(),
  coins: z.number().int().min(0).max(10_000_000).optional(),
  stamina: z.number().int().min(0).max(1000).optional(),
  items: z.record(z.number().int().min(0).max(100000)).optional(),
});

declare module 'fastify' {
  interface FastifyRequest {
    userId: number;
  }
}

export async function buildApp(db: Db, secret: Uint8Array, opts: { devTools: boolean; logger?: boolean; rta?: RtaOptions }) {
  const app = Fastify({ logger: opts.logger ?? false, trustProxy: true });
  await app.register(websocket);
  const authLimiter = new RateLimiter(20, 60_000);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message });
    if ((err as any).validation || (err as any).statusCode === 400) return reply.code(400).send({ error: 'Dữ liệu không hợp lệ' });
    app.log.error(err);
    reply.code(500).send({ error: 'Lỗi máy chủ' });
  });

  const requireAuth = async (req: FastifyRequest, _reply: FastifyReply) => {
    const h = req.headers.authorization ?? '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    const id = token ? await verifyToken(secret, token) : null;
    if (!id) throw new HttpError(401, 'Phiên đăng nhập đã hết hạn, hãy đăng nhập lại');
    const { rows } = await db.query('SELECT 1 FROM users WHERE id = $1', [id]);
    if (!rows.length) throw new HttpError(401, 'Tài khoản không tồn tại');
    req.userId = id;
  };

  // ---------- Tài khoản ----------
  app.post('/api/auth/register', async (req) => {
    if (!authLimiter.allow(req.ip)) throw new HttpError(429, 'Thử quá nhiều lần, hãy đợi một phút');
    const { username, password } = parse(credSchema, req.body);
    const hash = await hashPassword(password);
    const userId = await db.tx(async (q) => {
      const exists = await q.query('SELECT 1 FROM users WHERE username = $1', [username.toLowerCase()]);
      if (exists.rows.length) throw new HttpError(409, 'Tên đăng nhập đã có người dùng');
      const { rows } = await q.query(
        `INSERT INTO users (username, display_name, password_hash, coins, gems, scrolls, team)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [username.toLowerCase(), username, hash, START_WALLET.coins, START_WALLET.gems, START_WALLET.scrolls, JSON.stringify(DEFAULT_TEAM)],
      );
      const id = rows[0].id as number;
      for (const hid of STARTER_HEROES) {
        await q.query('INSERT INTO user_heroes (user_id, hero_id, stars) VALUES ($1, $2, $3)', [id, hid, heroById(hid).rarity]);
      }
      await addItems(q, id, START_ITEMS);
      await grantStarterGear(q, id);
      return id;
    });
    return { token: await signToken(secret, userId), ...(await profile(db, userId)) };
  });

  app.post('/api/auth/login', async (req) => {
    if (!authLimiter.allow(req.ip)) throw new HttpError(429, 'Thử quá nhiều lần, hãy đợi một phút');
    const { username, password } = parse(credSchema, req.body);
    const { rows } = await db.query('SELECT id, password_hash FROM users WHERE username = $1', [username.toLowerCase()]);
    // Vẫn băm khi không có tài khoản để thời gian phản hồi như nhau
    const ok = rows.length ? await verifyPassword(password, rows[0].password_hash) : (await hashPassword(password), false);
    if (!ok) throw new HttpError(401, 'Sai tên đăng nhập hoặc mật khẩu');
    return { token: await signToken(secret, rows[0].id), ...(await profile(db, rows[0].id)) };
  });

  // ---------- Hồ sơ ----------
  app.get('/api/me', { preHandler: requireAuth }, async (req) => profile(db, req.userId));

  app.post('/api/daily', { preHandler: requireAuth }, async (req) => {
    await db.tx(async (q) => {
      const { rows } = await q.query(
        `UPDATE users SET coins = coins + $2, gems = gems + $3, scrolls = scrolls + $4, last_daily = CURRENT_DATE
          WHERE id = $1 AND (last_daily IS NULL OR last_daily < CURRENT_DATE) RETURNING id`,
        [req.userId, DAILY.coins, DAILY.gems, DAILY.scrolls],
      );
      if (!rows.length) throw new HttpError(409, 'Hôm nay bạn đã nhận quà rồi');
      await changeStamina(q, req.userId, DAILY.stamina);
    });
    return { reward: DAILY, ...(await profile(db, req.userId)) };
  });

  app.put('/api/team', { preHandler: requireAuth }, async (req) => {
    const { team } = parse(teamSchema, req.body);
    if (new Set(team).size !== 5) throw new HttpError(400, 'Mỗi ninja chỉ được xếp một lần');
    const owned = await db.query('SELECT hero_id FROM user_heroes WHERE user_id = $1 AND hero_id = ANY($2::text[])', [req.userId, team]);
    if (owned.rows.length !== 5) throw new HttpError(400, 'Đội hình có ninja bạn chưa sở hữu');
    await db.query('UPDATE users SET team = $2 WHERE id = $1', [req.userId, JSON.stringify(team)]);
    return { team };
  });

  // ---------- Gacha ----------
  app.get('/api/gacha/banners', async () => ({
    banners: Object.values(BANNERS).map((b) => ({
      ...b,
      pools: {
        5: HEROES.filter((h) => h.rarity === 5).map((h) => h.id),
        4: HEROES.filter((h) => h.rarity === 4).map((h) => h.id),
        3: HEROES.filter((h) => h.rarity === 3).map((h) => h.id),
      },
    })),
  }));

  app.post('/api/gacha/pull', { preHandler: requireAuth }, async (req) => {
    const { banner: bannerId, count } = parse(pullSchema, req.body);
    const banner = BANNERS[bannerId];
    const cost = banner.cost * count;
    const col = banner.currency === 'gems' ? 'gems' : 'scrolls'; // cột lấy từ cấu hình, không từ người dùng

    const results = await db.tx(async (q) => {
      const u = (await q.query(`SELECT ${col} AS bal FROM users WHERE id = $1 FOR UPDATE`, [req.userId])).rows[0];
      if (u.bal < cost) throw new HttpError(400, banner.currency === 'gems' ? 'Không đủ Ngọc Chakra' : 'Không đủ Cuộn Triệu Hồi');
      const pr = (await q.query('SELECT pity FROM gacha_pity WHERE user_id = $1 AND banner_id = $2 FOR UPDATE', [req.userId, bannerId])).rows[0];
      const r = roll(banner, count, pr?.pity ?? 0);

      await q.query(`UPDATE users SET ${col} = ${col} - $2 WHERE id = $1`, [req.userId, cost]);
      await q.query(
        `INSERT INTO gacha_pity (user_id, banner_id, pity, total) VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, banner_id) DO UPDATE SET pity = EXCLUDED.pity, total = gacha_pity.total + EXCLUDED.total`,
        [req.userId, bannerId, r.pity, count],
      );
      const owned = new Set((await q.query('SELECT hero_id FROM user_heroes WHERE user_id = $1', [req.userId])).rows.map((x) => x.hero_id));
      const out = [];
      for (const res of r.results) {
        const isNew = !owned.has(res.heroId);
        if (isNew) {
          owned.add(res.heroId);
          await q.query('INSERT INTO user_heroes (user_id, hero_id, stars) VALUES ($1, $2, $3)', [req.userId, res.heroId, res.rarity]);
        } else {
          await q.query('UPDATE user_heroes SET dupes = dupes + 1 WHERE user_id = $1 AND hero_id = $2', [req.userId, res.heroId]);
        }
        await q.query('INSERT INTO gacha_log (user_id, banner_id, hero_id, rarity, pity_hit) VALUES ($1, $2, $3, $4, $5)', [
          req.userId, bannerId, res.heroId, res.rarity, res.pityHit,
        ]);
        out.push({ ...res, isNew });
      }
      return out;
    });
    return { results, ...(await profile(db, req.userId)) };
  });

  app.get('/api/gacha/history', { preHandler: requireAuth }, async (req) => {
    const { rows } = await db.query(
      'SELECT banner_id, hero_id, rarity, pity_hit, created_at FROM gacha_log WHERE user_id = $1 ORDER BY id DESC LIMIT 100',
      [req.userId],
    );
    return {
      history: rows.map((r) => ({ banner: r.banner_id, heroId: r.hero_id, rarity: r.rarity, pityHit: r.pity_hit, at: r.created_at })),
    };
  });

  // ---------- Công cụ phát triển (tắt khi NODE_ENV=production) ----------
  if (opts.devTools) {
    app.post('/api/dev/grant', { preHandler: requireAuth }, async (req) => {
      const { gems = 0, scrolls = 0, coins = 0, stamina = 0, items = {} } = parse(grantSchema, req.body);
      await db.tx(async (q) => {
        await q.query('UPDATE users SET gems = gems + $2, scrolls = scrolls + $3, coins = coins + $4 WHERE id = $1', [req.userId, gems, scrolls, coins]);
        if (stamina) await changeStamina(q, req.userId, stamina);
        await addItems(q, req.userId, items);
      });
      return profile(db, req.userId);
    });
  }

  registerGameRoutes(app, db, requireAuth);
  registerArenaRoutes(app, db, requireAuth);
  registerGearRoutes(app, db, requireAuth, opts.devTools);
  const rta = registerRtaRoutes(app, db, secret, opts.rta);
  app.decorate('rta', rta);

  app.get('/api/health', async () => ({ ok: true, db: db.kind }));
  return app;
}
