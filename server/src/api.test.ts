import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { buildApp } from './app';
import { migrate, openDb, Db } from './db';

let db: Db;
let app: Awaited<ReturnType<typeof buildApp>>;
let dir: string;
let token = '';

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'ninja-test-'));
  delete process.env.DATABASE_URL;
  db = await openDb(dir);
  await migrate(db);
  app = await buildApp(db, new TextEncoder().encode('test-secret-test-secret-test-secret'), { devTools: true });
});
after(async () => {
  await app.close();
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

const call = (method: 'GET' | 'POST' | 'PUT', url: string, body?: unknown, tk = token) =>
  app.inject({ method, url, payload: body as any, headers: tk ? { authorization: `Bearer ${tk}` } : {} });

test('đăng ký tạo tài khoản với ví và 5 tướng khởi đầu', async () => {
  const r = await call('POST', '/api/auth/register', { username: 'KingZun', password: 'secret123' }, '');
  assert.equal(r.statusCode, 200, r.body);
  const j = r.json();
  token = j.token;
  assert.equal(j.user.displayName, 'KingZun');
  assert.equal(j.user.gems, 3000);
  assert.equal(j.heroes.length, 5);
  assert.equal(j.team.length, 5);
});

test('không cho đăng ký trùng tên (không phân biệt hoa thường)', async () => {
  const r = await call('POST', '/api/auth/register', { username: 'kingzun', password: 'abcdef' }, '');
  assert.equal(r.statusCode, 409);
});

test('đăng nhập sai mật khẩu bị từ chối, đúng thì được token', async () => {
  assert.equal((await call('POST', '/api/auth/login', { username: 'kingzun', password: 'wrongpw' }, '')).statusCode, 401);
  const ok = await call('POST', '/api/auth/login', { username: 'KINGZUN', password: 'secret123' }, '');
  assert.equal(ok.statusCode, 200);
  assert.ok(ok.json().token);
});

test('API cần token', async () => {
  assert.equal((await call('GET', '/api/me', undefined, '')).statusCode, 401);
  assert.equal((await call('GET', '/api/me', undefined, 'abc.def.ghi')).statusCode, 401);
});

test('quà hằng ngày chỉ nhận được một lần', async () => {
  const a = await call('POST', '/api/daily');
  assert.equal(a.statusCode, 200);
  assert.equal(a.json().user.gems, 3300);
  assert.equal((await call('POST', '/api/daily')).statusCode, 409);
});

test('quay x10 cao cấp trừ đúng ngọc và cập nhật bảo hiểm', async () => {
  const r = await call('POST', '/api/gacha/pull', { banner: 'premium', count: 10 });
  assert.equal(r.statusCode, 200, r.body);
  const j = r.json();
  assert.equal(j.results.length, 10);
  assert.equal(j.user.gems, 2300);
  assert.ok(j.results.some((x: any) => x.rarity >= 4));
  const has5 = j.results.some((x: any) => x.rarity === 5);
  if (!has5) assert.equal(j.pity.premium.pity, 10);
  assert.equal(j.pity.premium.total, 10);
});

test('không đủ tiền thì không quay và không trừ gì', async () => {
  const before = (await call('GET', '/api/me')).json();
  const r = await call('POST', '/api/gacha/pull', { banner: 'normal', count: 10 }); // có 25 cuộn
  assert.equal(r.statusCode, 200);
  await call('POST', '/api/gacha/pull', { banner: 'normal', count: 10 });
  const fail = await call('POST', '/api/gacha/pull', { banner: 'normal', count: 10 });
  assert.equal(fail.statusCode, 400);
  const after = (await call('GET', '/api/me')).json();
  assert.equal(after.user.scrolls, before.user.scrolls - 20);
});

test('bảo hiểm 120 lượt qua API: luôn có ít nhất một 5★ trong 120 lượt', async () => {
  await call('POST', '/api/dev/grant', { gems: 20000 });
  const startPity = (await call('GET', '/api/me')).json().pity.premium.pity;
  let got5 = false;
  let pulls = 0;
  while (pulls < 120 - startPity + 10 && !got5) {
    const j = (await call('POST', '/api/gacha/pull', { banner: 'premium', count: 10 })).json();
    pulls += 10;
    if (j.results.some((x: any) => x.rarity === 5)) got5 = true;
  }
  assert.ok(got5, 'phải ra 5★ trước khi vượt bảo hiểm');
  const hist = (await call('GET', '/api/gacha/history')).json().history;
  assert.ok(hist.length > 0);
});

test('đội hình chỉ chấp nhận tướng đã sở hữu, không trùng', async () => {
  const me = (await call('GET', '/api/me')).json();
  const owned = me.heroes.map((h: any) => h.heroId);
  assert.equal((await call('PUT', '/api/team', { team: owned.slice(0, 5) })).statusCode, 200);
  const notOwned = ['madara', 'pain', 'itachi', 'minato', 'naruto_sage'].find((id) => !owned.includes(id));
  if (notOwned) assert.equal((await call('PUT', '/api/team', { team: [...owned.slice(0, 4), notOwned] })).statusCode, 400);
  assert.equal((await call('PUT', '/api/team', { team: [owned[0], owned[0], owned[1], owned[2], owned[3]] })).statusCode, 400);
});

test('tướng trùng được cộng mảnh, không tạo bản ghi mới', async () => {
  const me = (await call('GET', '/api/me')).json();
  const totalPulls = me.pity.premium.total + me.pity.normal.total;
  const dupes = me.heroes.reduce((s: number, h: any) => s + h.dupes, 0);
  assert.equal(me.heroes.length - 5 + dupes, totalPulls);
});
