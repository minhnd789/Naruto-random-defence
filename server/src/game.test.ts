import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { chooseAction, Choice } from '../../game/src/engine/ai';
import { Battle } from '../../game/src/engine/battle';
import { buildTeam, UnitSetup } from '../../game/src/engine/progression';
import { buildApp } from './app';
import { Db, migrate, openDb } from './db';

let db: Db;
let app: Awaited<ReturnType<typeof buildApp>>;
let dir: string;
let token = '';
const TEAM = ['gaara', 'kisame', 'kakashi', 'sakura', 'hinata'];

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'ninja-game-test-'));
  delete process.env.DATABASE_URL;
  db = await openDb(dir);
  await migrate(db);
  app = await buildApp(db, new TextEncoder().encode('test-secret-test-secret-test-secret'), { devTools: true });
  const r = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: 'tester', password: 'secret123' } });
  token = r.json().token;
});
after(async () => {
  await app.close();
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

const call = (method: 'GET' | 'POST', url: string, body?: unknown) =>
  app.inject({ method, url, payload: body as any, headers: { authorization: `Bearer ${token}` } });
const me = async () => (await call('GET', '/api/me')).json();
const hero = (p: any, id: string) => p.heroes.find((h: any) => h.heroId === id);

/** Mô phỏng client: đánh bằng AI với đúng seed/đội server cấp, ghi lại lựa chọn đội A. */
function playLikeClient(seed: number, team: UnitSetup[], enemies: UnitSetup[]) {
  const b = new Battle(buildTeam(team), buildTeam(enemies), seed);
  const actions: Choice[] = [];
  while (!b.over) {
    const t = b.nextTurn()!;
    if (!t.canAct) continue;
    const c = chooseAction(b, t.actor);
    if (t.actor.team === 'A') actions.push(c);
    b.act(t.actor.uid, c.skillId, c.targetUid);
  }
  return { actions, winner: b.winner };
}

test('tài khoản mới có thể lực đầy và 20 Cuộn Kinh Nghiệm', async () => {
  const p = await me();
  assert.equal(p.user.stamina, 100);
  assert.equal(p.inventory.exp_book, 20);
  assert.deepEqual(p.stageClears, []);
});

test('lên cấp bằng Cuộn Kinh Nghiệm: trừ sách và Xu', async () => {
  const before = await me();
  const r = await call('POST', '/api/hero/kakashi/level', { books: 5 });
  assert.equal(r.statusCode, 200, r.body);
  const p = r.json();
  assert.ok(hero(p, 'kakashi').level > 1);
  assert.equal(p.inventory.exp_book, 15);
  assert.equal(p.user.coins, before.user.coins - 5 * 300);
});

test('lên cấp không vượt quá giới hạn của số sao, chỉ trừ đúng số sách cần', async () => {
  await call('POST', '/api/dev/grant', { items: { exp_book: 500 }, coins: 1_000_000 });
  const p = (await call('POST', '/api/hero/kakashi/level', { books: 1000 })).json();
  assert.equal(hero(p, 'kakashi').level, 40);
  assert.ok(p.inventory.exp_book > 400, 'không được dùng thừa sách');
  assert.equal((await call('POST', '/api/hero/kakashi/level', { books: 1 })).statusCode, 400);
});

test('nâng sao cần mảnh, có thể dùng Linh Hồn Thạch thay thế', async () => {
  assert.equal((await call('POST', '/api/hero/sakura/star')).statusCode, 400, 'chưa đạt cấp tối đa');
  assert.equal((await call('POST', '/api/hero/kakashi/star')).statusCode, 400, 'chưa có mảnh');
  await call('POST', '/api/dev/grant', { items: { soul_stone: 5 } });
  const r = await call('POST', '/api/hero/kakashi/star');
  assert.equal(r.statusCode, 200, r.body);
  const p = r.json();
  assert.equal(hero(p, 'kakashi').stars, 5);
  assert.equal(hero(p, 'kakashi').level, 40);
  assert.equal(p.inventory.soul_stone ?? 0, 0);
});

test('thức tỉnh cần Ấn Chú đúng hệ', async () => {
  assert.equal((await call('POST', '/api/hero/kakashi/awaken')).statusCode, 400);
  await call('POST', '/api/dev/grant', { items: { rune_fire: 50 } });
  assert.equal((await call('POST', '/api/hero/kakashi/awaken')).statusCode, 400, 'sai hệ');
  await call('POST', '/api/dev/grant', { items: { rune_lightning: 4 } });
  const r = await call('POST', '/api/hero/kakashi/awaken');
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(hero(r.json(), 'kakashi').awaken, 1);
});

test('ải chưa mở khóa thì không vào được', async () => {
  const r = await call('POST', '/api/battle/start', { mode: 'stage', stageId: '1-2', team: TEAM });
  assert.equal(r.statusCode, 403);
});

test('vượt ải 1-1: server chạy lại trận, trao thưởng và thưởng lần đầu', async () => {
  const start = await call('POST', '/api/battle/start', { mode: 'stage', stageId: '1-1', team: TEAM });
  assert.equal(start.statusCode, 200, start.body);
  const r0 = start.json();
  const s = { ...r0.battle, user: r0.user };
  assert.equal(s.user.stamina, 96);
  // Server dùng chỉ số thật của Kakashi đã nâng cấp
  assert.equal(s.team.find((u: any) => u.heroId === 'kakashi').stars, 5);
  const play = playLikeClient(s.seed, s.team, s.enemies);
  assert.equal(play.winner, 'A');
  const gemsBefore = s.user.gems;
  const fin = await call('POST', '/api/battle/finish', { battleId: s.battleId, actions: play.actions });
  assert.equal(fin.statusCode, 200, fin.body);
  const f = fin.json();
  assert.equal(f.victory, true);
  assert.ok(f.reward.coins > 0);
  assert.equal(f.firstClear.gems, 50);
  assert.equal(f.user.gems, gemsBefore + 50);
  assert.deepEqual(f.stageClears, ['1-1']);
  // Gửi lại lần nữa để nhận thưởng kép: bị chặn
  assert.equal((await call('POST', '/api/battle/finish', { battleId: s.battleId, actions: play.actions })).statusCode, 409);
});

test('gian lận: nhật ký rỗng hoặc kỹ năng giả không được tính thắng', async () => {
  const s = (await call('POST', '/api/battle/start', { mode: 'stage', stageId: '1-2', team: TEAM })).json().battle;
  const f = (await call('POST', '/api/battle/finish', { battleId: s.battleId, actions: [] })).json();
  assert.equal(f.victory, false);
  assert.equal(f.reward, null);

  const s2 = (await call('POST', '/api/battle/start', { mode: 'stage', stageId: '1-2', team: TEAM })).json().battle;
  const fake = Array.from({ length: 50 }, () => ({ skillId: 'madara_s3', targetUid: 'B0' }));
  const f2 = (await call('POST', '/api/battle/finish', { battleId: s2.battleId, actions: fake })).json();
  assert.equal(f2.victory, false);
  assert.ok(f2.error);
  assert.ok(!f2.stageClears.includes('1-2'));
});

test('gian lận: dùng nhật ký của seed khác không thắng được', async () => {
  const s = (await call('POST', '/api/battle/start', { mode: 'stage', stageId: '1-2', team: TEAM })).json().battle;
  const other = playLikeClient(s.seed + 1, s.team, s.enemies);
  const truth = playLikeClient(s.seed, s.team, s.enemies);
  const f = (await call('POST', '/api/battle/finish', { battleId: s.battleId, actions: other.actions })).json();
  // Chỉ thắng nếu nhật ký tình cờ trùng hoàn toàn với trận thật
  const same = JSON.stringify(other.actions) === JSON.stringify(truth.actions);
  if (!same) assert.equal(f.victory, false);
});

test('bí cảnh: bậc 2 bị khóa, bậc 1 thắng thì nhận Cuộn Kinh Nghiệm', async () => {
  assert.equal((await call('POST', '/api/battle/start', { mode: 'dungeon', dungeon: 'exp', tier: 2, team: TEAM })).statusCode, 403);
  assert.equal((await call('POST', '/api/battle/start', { mode: 'dungeon', dungeon: 'rune', tier: 1, team: TEAM })).statusCode, 400);
  const r0 = (await call('POST', '/api/battle/start', { mode: 'dungeon', dungeon: 'exp', tier: 1, team: TEAM })).json();
  const s = r0.battle;
  const play = playLikeClient(s.seed, s.team, s.enemies);
  const booksBefore = r0.inventory.exp_book;
  const f = (await call('POST', '/api/battle/finish', { battleId: s.battleId, actions: play.actions })).json();
  assert.equal(f.victory, play.winner === 'A');
  if (f.victory) {
    assert.ok(f.inventory.exp_book >= booksBefore + 4);
    assert.equal(f.dungeonClears.exp, 1);
  }
});

test('không đủ thể lực thì không vào trận', async () => {
  const p = await me();
  // Tiêu gần hết thể lực bằng cách mở trận liên tục (mỗi lần 4)
  let st = p.user.stamina;
  while (st >= 4) {
    const r = (await call('POST', '/api/battle/start', { mode: 'stage', stageId: '1-1', team: TEAM })).json();
    st = r.user.stamina;
  }
  const r = await call('POST', '/api/battle/start', { mode: 'stage', stageId: '1-1', team: TEAM });
  assert.equal(r.statusCode, 400);
  assert.match(r.json().error, /thể lực/);
});
