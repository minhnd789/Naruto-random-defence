// Lớp truy cập CSDL: dùng PostgreSQL thật nếu có DATABASE_URL, nếu không thì PGlite
// (PostgreSQL biên dịch sang WASM, lưu dữ liệu vào thư mục server/data/pg).
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Queryable {
  query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  kind: 'postgres' | 'pglite';
}

export async function openDb(dataDir: string): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = new pg.Pool({ connectionString: url });
    return {
      kind: 'postgres',
      query: (sql, params) => pool.query(sql, params as any[]) as any,
      async tx(fn) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const r = await fn({ query: (s, p) => client.query(s, p as any[]) as any });
          await client.query('COMMIT');
          return r;
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  }
  const dir = resolve(dataDir, 'pg');
  mkdirSync(dir, { recursive: true });
  const lite = await PGlite.create(dir);
  return {
    kind: 'pglite',
    query: (sql, params) => lite.query(sql, params as any[]) as any,
    tx: (fn) => lite.transaction((t) => fn({ query: (s, p) => t.query(s, p as any[]) as any })),
    close: () => lite.close(),
  };
}

const MIGRATIONS: string[] = [
  `CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     username TEXT NOT NULL UNIQUE,
     display_name TEXT NOT NULL,
     password_hash TEXT NOT NULL,
     coins INT NOT NULL DEFAULT 0 CHECK (coins >= 0),
     gems INT NOT NULL DEFAULT 0 CHECK (gems >= 0),
     scrolls INT NOT NULL DEFAULT 0 CHECK (scrolls >= 0),
     last_daily DATE,
     team JSONB NOT NULL DEFAULT '[]',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE TABLE user_heroes (
     user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     hero_id TEXT NOT NULL,
     stars INT NOT NULL,
     level INT NOT NULL DEFAULT 1,
     dupes INT NOT NULL DEFAULT 0,
     obtained_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (user_id, hero_id)
   );
   CREATE TABLE gacha_pity (
     user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     banner_id TEXT NOT NULL,
     pity INT NOT NULL DEFAULT 0,
     total INT NOT NULL DEFAULT 0,
     PRIMARY KEY (user_id, banner_id)
   );
   CREATE TABLE gacha_log (
     id BIGSERIAL PRIMARY KEY,
     user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     banner_id TEXT NOT NULL,
     hero_id TEXT NOT NULL,
     rarity INT NOT NULL,
     pity_hit BOOLEAN NOT NULL DEFAULT false,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE INDEX gacha_log_user ON gacha_log (user_id, id DESC);`,
  // Giai đoạn 3: nâng cấp, thể lực, kho đồ, vượt ải, bí cảnh, trận đấu xác thực
  `ALTER TABLE users ADD COLUMN stamina INT NOT NULL DEFAULT 100;
   ALTER TABLE users ADD COLUMN stamina_at TIMESTAMPTZ NOT NULL DEFAULT now();
   ALTER TABLE user_heroes ADD COLUMN exp INT NOT NULL DEFAULT 0;
   ALTER TABLE user_heroes ADD COLUMN awaken INT NOT NULL DEFAULT 0;
   CREATE TABLE inventory (
     user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     item_id TEXT NOT NULL,
     qty INT NOT NULL DEFAULT 0 CHECK (qty >= 0),
     PRIMARY KEY (user_id, item_id)
   );
   CREATE TABLE stage_clears (
     user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     stage_id TEXT NOT NULL,
     clears INT NOT NULL DEFAULT 1,
     first_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (user_id, stage_id)
   );
   CREATE TABLE dungeon_clears (
     user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     dungeon_id TEXT NOT NULL,
     tier INT NOT NULL,
     clears INT NOT NULL DEFAULT 1,
     PRIMARY KEY (user_id, dungeon_id, tier)
   );
   CREATE TABLE battles (
     id TEXT PRIMARY KEY,
     user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     mode TEXT NOT NULL,
     target JSONB NOT NULL,
     seed BIGINT NOT NULL,
     team JSONB NOT NULL,
     enemy JSONB NOT NULL,
     status TEXT NOT NULL DEFAULT 'active',
     result JSONB,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     finished_at TIMESTAMPTZ
   );
   CREATE INDEX battles_user ON battles (user_id, created_at DESC);
   INSERT INTO inventory (user_id, item_id, qty) SELECT id, 'exp_book', 20 FROM users`,
  // Giai đoạn 4: đấu trường thường + RTA
  `ALTER TABLE users ADD COLUMN defense JSONB NOT NULL DEFAULT '[]';
   CREATE TABLE arena_players (
     user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     season INT NOT NULL,
     rating INT NOT NULL,
     wins INT NOT NULL DEFAULT 0,
     losses INT NOT NULL DEFAULT 0,
     tickets INT NOT NULL DEFAULT 5,
     tickets_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     opponents JSONB NOT NULL DEFAULT '[]',
     reward_claimed BOOLEAN NOT NULL DEFAULT false,
     PRIMARY KEY (user_id, season)
   );
   CREATE INDEX arena_rank ON arena_players (season, rating DESC);
   CREATE TABLE arena_log (
     id BIGSERIAL PRIMARY KEY,
     season INT NOT NULL,
     attacker INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     defender INT REFERENCES users(id) ON DELETE CASCADE,
     defender_name TEXT NOT NULL,
     win BOOLEAN NOT NULL,
     att_change INT NOT NULL,
     def_change INT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE INDEX arena_log_att ON arena_log (attacker, id DESC);
   CREATE INDEX arena_log_def ON arena_log (defender, id DESC);
   CREATE TABLE rta_players (
     user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     season INT NOT NULL,
     rating INT NOT NULL,
     wins INT NOT NULL DEFAULT 0,
     losses INT NOT NULL DEFAULT 0,
     PRIMARY KEY (user_id, season)
   );
   CREATE INDEX rta_rank ON rta_players (season, rating DESC);
   CREATE TABLE rta_matches (
     id TEXT PRIMARY KEY,
     season INT NOT NULL,
     a_user INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     b_user INT REFERENCES users(id) ON DELETE CASCADE,
     winner TEXT,
     a_change INT NOT NULL DEFAULT 0,
     b_change INT NOT NULL DEFAULT 0,
     data JSONB NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
];

export async function migrate(db: Db) {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version INT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const { rows } = await db.query<{ version: number }>('SELECT version FROM schema_migrations');
  const done = new Set(rows.map((r) => r.version));
  for (let i = 0; i < MIGRATIONS.length; i++) {
    const v = i + 1;
    if (done.has(v)) continue;
    await db.tx(async (q) => {
      // PGlite và pg đều chạy được nhiều câu lệnh khi không có tham số
      for (const stmt of MIGRATIONS[i].split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) await q.query(stmt);
      await q.query('INSERT INTO schema_migrations (version) VALUES ($1)', [v]);
    });
  }
}
