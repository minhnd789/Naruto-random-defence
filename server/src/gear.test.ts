import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { chooseAction, Choice } from '../../game/src/engine/ai';
import { Battle } from '../../game/src/engine/battle';
import { computeStats, buildTeam, UnitSetup } from '../../game/src/engine/progression';
import { heroById } from '../../game/src/engine/heroes';
import { buildApp } from './app';
import { Db, migrate, openDb } from './db';
import { defenseOf } from './arena';
import { backfillGearVariants, backfillStarterGear } from './gear';
import { GEAR_SLOTS, GEAR_VARIANTS, Rarity, applyGear, gearVariant, rollGear, variantsFor } from '../../game/src/engine/gear';

let db: Db;
let app: Awaited<ReturnType<typeof buildApp>>;
let dir: string;
let token = '';
let userId = 0;
const TEAM = ['gaara', 'kisame', 'kakashi', 'sakura', 'hinata'];

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'ninja-gear-test-'));
  delete process.env.DATABASE_URL;
  db = await openDb(dir);
  await migrate(db);
  app = await buildApp(db, new TextEncoder().encode('test-secret-test-secret-test-secret'), { devTools: true });
  const r = (await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: 'gearman', password: 'secret123' } })).json();
  token = r.token;
  userId = r.user.id;
});
after(async () => {
  await app.close();
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

const call = (method: 'GET' | 'POST', url: string, body?: unknown) =>
  app.inject({ method, url, payload: body as any, headers: { authorization: `Bearer ${token}` } });

function play(seed: number, team: UnitSetup[], enemies: UnitSetup[]) {
  const b = new Battle(buildTeam(team), buildTeam(enemies), seed);
  const actions: Choice[] = [];
  while (!b.over) {
    const t = b.nextTurn()!;
    if (!t.canAct) continue;
    const c = chooseAction(b, t.actor);
    if (t.actor.team === 'A') actions.push(c);
    b.act(t.actor.uid, c.skillId, c.targetUid);
  }
  return actions;
}

test('tài khoản mới có 4 món Tinh Anh, chưa mặc', async () => {
  const g = (await call('GET', '/api/gear')).json().gear;
  assert.equal(g.length, 4);
  assert.ok(g.every((x: any) => x.rarity === 1 && x.heroId === null));
  assert.deepEqual(g.map((x: any) => x.slot).sort(), ['armor', 'boots', 'helmet', 'weapon']);
});

test('mặc vũ khí: chỉ số vào trận do server chụp có cộng trang bị', async () => {
  const g = (await call('GET', '/api/gear')).json().gear;
  const weapon = g.find((x: any) => x.slot === 'weapon');
  const r = await call('POST', `/api/gear/${weapon.id}/equip`, { heroId: 'kakashi' });
  assert.equal(r.statusCode, 200, r.body);
  const s = (await call('POST', '/api/battle/start', { mode: 'stage', stageId: '1-1', team: TEAM })).json().battle;
  const kakashi = s.team.find((u: any) => u.heroId === 'kakashi');
  assert.ok(kakashi.gear.atk > 0);
  const base = computeStats(heroById('kakashi'), { level: 1, stars: 4, awaken: 0 });
  const geared = computeStats(heroById('kakashi'), kakashi);
  assert.deepEqual(geared, applyGear(base, kakashi.gear));
  assert.ok(geared.atk > base.atk);
  // Trận vẫn xác thực được với chỉ số có trang bị
  const fin = (await call('POST', '/api/battle/finish', { battleId: s.battleId, actions: play(s.seed, s.team, s.enemies) })).json();
  assert.equal(fin.victory, true);
  assert.ok(Array.isArray(fin.gearDrops));
});

test('mặc món khác cùng ô thì món cũ tự tháo; đổi sang ninja khác thì chuyển theo', async () => {
  await call('POST', '/api/dev/gear', { count: 1, slot: 'weapon', rarity: 3, ilvl: 10 });
  let g = (await call('GET', '/api/gear')).json().gear;
  const [epic, old] = [g.find((x: any) => x.slot === 'weapon' && x.rarity === 3), g.find((x: any) => x.slot === 'weapon' && x.rarity === 1)];
  assert.equal(epic.subs.length, 3);
  g = (await call('POST', `/api/gear/${epic.id}/equip`, { heroId: 'kakashi' })).json().gear;
  assert.equal(g.find((x: any) => x.id === epic.id).heroId, 'kakashi');
  assert.equal(g.find((x: any) => x.id === old.id).heroId, null);
  g = (await call('POST', `/api/gear/${epic.id}/equip`, { heroId: 'gaara' })).json().gear;
  assert.equal(g.find((x: any) => x.id === epic.id).heroId, 'gaara');
  assert.equal(g.filter((x: any) => x.heroId === 'kakashi').length, 0);
  assert.equal((await call('POST', `/api/gear/${epic.id}/equip`, { heroId: 'madara' })).statusCode, 400, 'chưa sở hữu Madara');
});

test('phân giải: không được phân giải đồ đang mặc; đồ thừa đổi ra Xu', async () => {
  const g = (await call('GET', '/api/gear')).json().gear;
  const worn = g.find((x: any) => x.heroId);
  assert.equal((await call('POST', '/api/gear/salvage', { ids: [worn.id] })).statusCode, 400);
  const free = g.filter((x: any) => !x.heroId);
  const coinsBefore = (await call('GET', '/api/me')).json().user.coins;
  const r = (await call('POST', '/api/gear/salvage', { ids: free.map((x: any) => x.id) })).json();
  assert.equal(r.coins, free.reduce((s: number, x: any) => s + [200, 500, 1200, 3000, 8000, 20000][x.rarity], 0));
  assert.equal(r.user.coins, coinsBefore + r.coins);
  assert.equal(r.gear.length, g.length - free.length);
});

test('tháo đồ', async () => {
  const g = (await call('GET', '/api/gear')).json().gear;
  const worn = g.find((x: any) => x.heroId);
  const after = (await call('POST', `/api/gear/${worn.id}/unequip`)).json().gear;
  assert.equal(after.find((x: any) => x.id === worn.id).heroId, null);
});

test('đội phòng thủ đấu trường tính trang bị', async () => {
  const g = (await call('GET', '/api/gear')).json().gear;
  await call('POST', `/api/gear/${g[0].id}/equip`, { heroId: 'gaara' });
  const def = await defenseOf(db, userId);
  assert.ok(def.find((u) => u.heroId === 'gaara')!.gear);
});

test('đánh trùm 1-6 chắc chắn rơi trang bị', async () => {
  // Mở khóa tới 1-6 cho nhanh
  for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5']) await db.query('INSERT INTO stage_clears (user_id, stage_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, id]);
  await call('POST', '/api/dev/grant', { stamina: 50 });
  // Đội mạnh để chắc thắng
  await db.query("UPDATE user_heroes SET level = 40, stars = 4 WHERE user_id = $1", [userId]);
  const s = (await call('POST', '/api/battle/start', { mode: 'stage', stageId: '1-6', team: TEAM })).json().battle;
  const fin = (await call('POST', '/api/battle/finish', { battleId: s.battleId, actions: play(s.seed, s.team, s.enemies) })).json();
  assert.equal(fin.victory, true);
  assert.equal(fin.gearDrops.length, 1);
  assert.equal(fin.gearDrops[0].ilvl, 9);
});

test('tặng bù đồ khởi đầu cho tài khoản cũ: đúng một lần, không tặng lại sau khi phân giải', async () => {
  // Giả lập tài khoản tạo trước khi có trang bị
  const old = (await db.query(
    "INSERT INTO users (username, display_name, password_hash, starter_gear) VALUES ('oldie', 'Oldie', 'x', false) RETURNING id",
  )).rows[0].id;
  const count = async () => (await db.query('SELECT COUNT(*)::int AS n FROM gear WHERE user_id = $1', [old])).rows[0].n;
  assert.equal(await count(), 0);
  assert.equal(await backfillStarterGear(db), 1, 'chỉ tài khoản cũ được tặng; tài khoản mới đã nhận lúc đăng ký');
  assert.equal(await count(), 4);
  const g = (await db.query('SELECT rarity, slot FROM gear WHERE user_id = $1', [old])).rows;
  assert.ok(g.every((x) => x.rarity === 1));
  assert.equal(await backfillStarterGear(db), 0, 'chạy lại không tặng thêm');
  await db.query('DELETE FROM gear WHERE user_id = $1', [old]);
  assert.equal(await backfillStarterGear(db), 0, 'phân giải hết đồ cũng không được tặng lại');
  assert.equal(await count(), 0);
});

test('mẫu đồ: ô nào phẩm chất nào cũng có mẫu; pháp khí cũ (Công% + Máu%) cũng gán được mẫu', () => {
  for (const slot of GEAR_SLOTS) {
    for (let r = 0; r <= 5; r++) {
      assert.ok(variantsFor(slot, r as Rarity).length > 0, `${slot} phẩm ${r}`);
      if (slot === 'artifact') assert.ok(variantsFor(slot, r as Rarity, ['atkPct', 'hpPct']).length > 0, `pháp khí cũ phẩm ${r}`);
    }
  }
  assert.equal(new Set(GEAR_VARIANTS.map((v) => v.id)).size, GEAR_VARIANTS.length, 'id mẫu không trùng');
  // Thần khí mang đúng chỉ số chính riêng
  const fan = rollGear(Math.random, 'artifact', 5, 10, 'artifact_bashosen');
  assert.deepEqual(fan.main.map((l) => l.stat), ['atkPct', 'eff']);
  assert.equal(gearVariant(fan)!.name, 'Quạt Ba Tiêu');
});

test('đồ rơi ra có mẫu; đồ cũ chưa có mẫu được gán lúc khởi động, chỉ số giữ nguyên', async () => {
  const g = (await call('POST', '/api/dev/gear', { count: 5, ilvl: 5 })).json().gear;
  assert.ok(g.every((x: any) => GEAR_VARIANTS.some((v) => v.id === x.variant && v.slot === x.slot)));
  const old = g.find((x: any) => !x.heroId);
  await db.query("UPDATE gear SET variant = NULL, slot = 'artifact', main = $2 WHERE id = $1", [
    old.id,
    JSON.stringify([{ stat: 'atkPct', value: 0.1 }, { stat: 'hpPct', value: 0.1 }]),
  ]);
  assert.ok((await backfillGearVariants(db)) >= 1);
  const fixed = (await call('GET', '/api/gear')).json().gear.find((x: any) => x.id === old.id);
  assert.equal(gearVariant(fixed)!.slot, 'artifact');
  assert.deepEqual(gearVariant(fixed)!.main, ['atkPct', 'hpPct']);
  assert.equal(fixed.main[0].value, 0.1);
  assert.equal(await backfillGearVariants(db), 0);
});
