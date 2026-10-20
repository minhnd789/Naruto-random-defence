import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import type { WebSocket } from 'ws';
import { chooseAction, Choice } from '../../game/src/engine/ai';
import { Battle } from '../../game/src/engine/battle';
import { buildTeam, UnitSetup } from '../../game/src/engine/progression';
import { seasonOf } from '../../game/src/engine/ranking';
import { buildApp } from './app';
import { Db, migrate, openDb } from './db';

let db: Db;
let app: Awaited<ReturnType<typeof buildApp>>;
let dir: string;
const tokens: Record<string, string> = {};
const ids: Record<string, number> = {};
const TEAM = ['gaara', 'kisame', 'kakashi', 'sakura', 'hinata'];

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'ninja-arena-test-'));
  delete process.env.DATABASE_URL;
  db = await openDb(dir);
  await migrate(db);
  app = await buildApp(db, new TextEncoder().encode('test-secret-test-secret-test-secret'), {
    devTools: true,
    rta: { draftTimeoutMs: 400, turnTimeoutMs: 400, botDelayMs: [5, 15] },
  });
  await app.ready();
  for (const name of ['alice', 'bob', 'carol']) {
    const r = (await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: name, password: 'secret123' } })).json();
    tokens[name] = r.token;
    ids[name] = r.user.id;
    // Thêm ninja để đủ điều kiện vào RTA
    for (const h of ['naruto_sage', 'temari', 'lee']) await db.query('INSERT INTO user_heroes (user_id, hero_id, stars) VALUES ($1, $2, $3)', [r.user.id, h, h === 'naruto_sage' ? 5 : 3]);
  }
});
after(async () => {
  await app.close();
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

const call = (who: string, method: 'GET' | 'POST' | 'PUT', url: string, body?: unknown) =>
  app.inject({ method, url, payload: body as any, headers: { authorization: `Bearer ${tokens[who]}` } });

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
  return actions;
}

// ---------------- Đấu trường thường ----------------
test('đấu trường: hồ sơ mùa mới có 3 đối thủ và 5 vé', async () => {
  await call('bob', 'GET', '/api/arena'); // để bob có mặt trong mùa
  const a = (await call('alice', 'GET', '/api/arena')).json();
  assert.equal(a.season, seasonOf());
  assert.equal(a.me.rating, 1000);
  assert.equal(a.me.tickets, 5);
  assert.equal(a.opponents.length, 3);
  assert.ok(a.opponents.some((o: any) => o.id === `u:${ids.bob}`), 'người chơi thật có điểm gần nhau phải xuất hiện');
  assert.equal(a.defense.length, 5);
});

test('đấu trường: đánh người thật, cập nhật Elo hai bên, không đánh lại được', async () => {
  const opp = `u:${ids.bob}`;
  const s = (await call('alice', 'POST', '/api/battle/start', { mode: 'arena', opponentId: opp, team: TEAM })).json();
  assert.ok(s.battle, JSON.stringify(s));
  const actions = playLikeClient(s.battle.seed, s.battle.team, s.battle.enemies);
  const f = (await call('alice', 'POST', '/api/battle/finish', { battleId: s.battle.battleId, actions })).json();
  assert.ok(f.arena);
  assert.equal(Math.sign(f.arena.ratingChange), f.victory ? 1 : -1);
  const a = (await call('alice', 'GET', '/api/arena')).json();
  assert.equal(a.me.rating, 1000 + f.arena.ratingChange);
  assert.equal(a.me.tickets, 4);
  const b = (await call('bob', 'GET', '/api/arena')).json();
  assert.equal(Math.sign(b.me.rating - 1000), f.victory ? -1 : 1, 'người phòng thủ đổi điểm ngược chiều');
  const again = await call('alice', 'POST', '/api/battle/start', { mode: 'arena', opponentId: opp, team: TEAM });
  assert.equal(again.statusCode, 409);
});

test('đấu trường: bỏ trận giữa chừng bị tính thua', async () => {
  const a = (await call('alice', 'GET', '/api/arena')).json();
  const opp = a.opponents.find((o: any) => !o.fought);
  const before = a.me.rating;
  await call('alice', 'POST', '/api/battle/start', { mode: 'arena', opponentId: opp.id, team: TEAM });
  // Vào một trận khác thay vì kết thúc trận đấu trường
  await call('alice', 'POST', '/api/battle/start', { mode: 'stage', stageId: '1-1', team: TEAM });
  const after = (await call('alice', 'GET', '/api/arena')).json();
  assert.ok(after.me.rating < before);
  assert.equal(after.me.losses, a.me.losses + 1);
  const log = (await call('alice', 'GET', '/api/arena/log')).json();
  assert.equal(log.attacks.length, 2);
});

test('đấu trường: đội phòng thủ chỉ nhận ninja đã sở hữu', async () => {
  assert.equal((await call('alice', 'PUT', '/api/arena/defense', { team: ['madara', 'pain', 'itachi', 'minato', 'tsunade'] })).statusCode, 400);
  const r = await call('alice', 'PUT', '/api/arena/defense', { team: ['naruto_sage', 'gaara', 'kisame', 'sakura', 'hinata'] });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().defense[0].heroId, 'naruto_sage');
});

test('đấu trường: thưởng cuối mùa nhận đúng một lần', async () => {
  await db.query('INSERT INTO arena_players (user_id, season, rating) VALUES ($1, $2, 1350)', [ids.carol, seasonOf() - 1]);
  const st = (await call('carol', 'GET', '/api/arena')).json();
  assert.equal(st.pendingReward.tier, 'gold');
  assert.ok(st.me.rating > 1000, 'mùa mới giữ lại một nửa chênh lệch điểm');
  const before = (await call('carol', 'GET', '/api/me')).json().user.gems;
  const c = (await call('carol', 'POST', '/api/arena/claim')).json();
  assert.equal(c.user.gems, before + 400);
  assert.equal((await call('carol', 'POST', '/api/arena/claim')).statusCode, 409);
});

test('bảng xếp hạng đấu trường', async () => {
  const r = (await call('alice', 'GET', '/api/leaderboard?type=arena')).json();
  assert.ok(r.rows.length >= 3);
  assert.ok(r.rows[0].rating >= r.rows[r.rows.length - 1].rating);
});

// ---------------- RTA ----------------
interface Client {
  ws: WebSocket;
  msgs: any[];
  wait: (pred: (m: any) => boolean, ms?: number) => Promise<any>;
  send: (m: unknown) => void;
}

async function connect(who: string): Promise<Client> {
  const ws = (await (app as any).injectWS(`/api/rta/ws?token=${tokens[who]}`)) as WebSocket;
  const msgs: any[] = [];
  const waiters: { pred: (m: any) => boolean; resolve: (m: any) => void }[] = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    msgs.push(m);
    for (const w of [...waiters]) if (w.pred(m)) {
      waiters.splice(waiters.indexOf(w), 1);
      w.resolve(m);
    }
  });
  return {
    ws,
    msgs,
    send: (m) => ws.send(JSON.stringify(m)),
    wait: (pred, ms = 20000) =>
      new Promise((resolve, reject) => {
        const found = msgs.find(pred);
        if (found) return resolve(found);
        const t = setTimeout(() => reject(new Error('Hết thời gian chờ tin nhắn')), ms);
        waiters.push({ pred, resolve: (m) => (clearTimeout(t), resolve(m)) });
      }),
  };
}

/** Client phát lại trận từ 'start' + chuỗi 'action', kết quả phải trùng với server. */
function mirror(msgs: any[]) {
  const start = msgs.find((m) => m.t === 'start');
  const b = new Battle(buildTeam(start.teamA), buildTeam(start.teamB), start.seed);
  for (const a of msgs.filter((m) => m.t === 'action')) {
    let t = b.nextTurn()!;
    while (!t.canAct) t = b.nextTurn()!;
    assert.equal(t.actor.uid, a.actorUid, 'thứ tự lượt phải khớp server');
    b.act(a.actorUid, a.skillId, a.targetUid);
  }
  return b;
}

test('RTA: không đủ ninja thì không vào hàng chờ', async () => {
  const r = (await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: 'newbie', password: 'secret123' } })).json();
  tokens.newbie = r.token;
  const c = await connect('newbie');
  c.send({ t: 'queue', mode: 'pvp' });
  const e = await c.wait((m) => m.t === 'error');
  assert.match(e.message, /ít nhất/);
  c.ws.close();
});

test('RTA với bot: cấm/chọn và đánh tay, client phát lại khớp server', async () => {
  const c = await connect('alice');
  c.send({ t: 'queue', mode: 'bot' });
  const match = await c.wait((m) => m.t === 'match');
  assert.equal(match.you, 'A');
  assert.equal(match.ranked, false);
  await c.wait((m) => m.t === 'draft' && m.phase === 'preban');
  c.send({ t: 'ban', heroId: 'madara' });
  // Lượt chọn đầu tiên của A
  const firstPick = await c.wait((m) => m.t === 'draft' && m.phase === 'pick' && m.turn === 'A');
  assert.deepEqual(firstPick.prebans.A, 'madara');
  c.send({ t: 'pick', heroId: 'naruto_sage' });
  await c.wait((m) => m.t === 'draft' && m.picks?.A?.includes('naruto_sage'));
  // Không chọn được ninja không sở hữu
  c.send({ t: 'pick', heroId: 'pain' });
  const start = await c.wait((m) => m.t === 'start', 30000);
  assert.equal(start.teamA.length, 4);
  assert.equal(start.teamB.length, 4);
  assert.ok(!start.teamA.some((u: any) => u.heroId === 'pain'));

  // Đánh tay: mỗi khi tới lượt A thì gửi lựa chọn của AI phía client
  const local = new Battle(buildTeam(start.teamA), buildTeam(start.teamB), start.seed);
  let manual = 0;
  const onMsg = (d: any) => {
    const m = JSON.parse(d.toString());
    if (m.t === 'action') {
      let t = local.nextTurn()!;
      while (!t.canAct) t = local.nextTurn()!;
      local.act(m.actorUid, m.skillId, m.targetUid);
    }
    if (m.t === 'turn' && m.actorUid.startsWith('A')) {
      // Mô phỏng tới đúng lượt để chọn kỹ năng
      const probe = new Battle(buildTeam(start.teamA), buildTeam(start.teamB), start.seed);
      for (const a of c.msgs.filter((x) => x.t === 'action')) {
        let t = probe.nextTurn()!;
        while (!t.canAct) t = probe.nextTurn()!;
        probe.act(a.actorUid, a.skillId, a.targetUid);
      }
      let t = probe.nextTurn()!;
      while (!t.canAct) t = probe.nextTurn()!;
      const ch = chooseAction(probe, t.actor);
      c.send({ t: 'act', skillId: ch.skillId, targetUid: ch.targetUid });
      manual++;
    }
  };
  c.ws.on('message', onMsg);
  const end = await c.wait((m) => m.t === 'end', 60000);
  assert.ok(manual > 0);
  assert.deepEqual(end.changes, { A: 0, B: 0 }, 'đấu bot không tính điểm');
  const b = mirror(c.msgs);
  assert.equal(b.over, true);
  assert.equal(b.winner, end.winner);
  c.ws.close();
});

test('RTA PvP: ghép hai người, hết giờ tự đánh, cập nhật điểm', async () => {
  const a = await connect('alice');
  const b = await connect('bob');
  a.send({ t: 'queue', mode: 'pvp' });
  await a.wait((m) => m.t === 'queued');
  b.send({ t: 'queue', mode: 'pvp' });
  const ma = await a.wait((m) => m.t === 'match');
  const mb = await b.wait((m) => m.t === 'match');
  assert.equal(ma.ranked, true);
  assert.notEqual(ma.you, mb.you);
  // Không ai thao tác: server tự cấm/chọn/đánh khi hết giờ
  const end = await a.wait((m) => m.t === 'end', 120000);
  const endB = await b.wait((m) => m.t === 'end');
  assert.equal(end.winner, endB.winner);
  assert.ok(end.changes.A !== 0 && end.changes.B !== 0);
  assert.equal(Math.sign(end.changes.A), end.winner === 'A' ? 1 : -1);
  assert.equal(mirror(a.msgs).winner, end.winner);
  const lb = (await call('alice', 'GET', '/api/leaderboard?type=rta')).json();
  assert.equal(lb.rows.length, 2);
  a.ws.close();
  b.ws.close();
});
