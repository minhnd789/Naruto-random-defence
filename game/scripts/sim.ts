// Mô phỏng hàng loạt trận AI vs AI để kiểm tra engine và cân bằng
import { Battle } from '../src/engine/battle';
import { chooseAction } from '../src/engine/ai';
import { HEROES } from '../src/engine/heroes';
import { Rng } from '../src/engine/rng';

const N = Number(process.argv[2] ?? 2000);
const rng = new Rng(42);
const wins: Record<string, [number, number]> = {};
let turns = 0;
for (let i = 0; i < N; i++) {
  const pool = [...HEROES].sort(() => rng.next() - 0.5);
  const a = pool.slice(0, 5), b = pool.slice(5, 10);
  const battle = new Battle(a, b, i + 1);
  let guard = 0;
  while (!battle.over && guard++ < 500) {
    const t = battle.nextTurn()!;
    if (!t.canAct) continue;
    const c = chooseAction(battle, t.actor);
    battle.act(t.actor.uid, c.skillId, c.targetUid);
  }
  if (!battle.over) throw new Error('Trận không kết thúc, seed ' + (i + 1));
  turns += battle.turnCount;
  for (const h of a) { wins[h.id] ??= [0, 0]; wins[h.id][1]++; if (battle.winner === 'A') wins[h.id][0]++; }
  for (const h of b) { wins[h.id] ??= [0, 0]; wins[h.id][1]++; if (battle.winner === 'B') wins[h.id][0]++; }
}
console.log('Số lượt trung bình mỗi trận:', (turns / N).toFixed(1));
for (const [id, [w, n]] of Object.entries(wins).sort((x, y) => y[1][0] / y[1][1] - x[1][0] / x[1][1]))
  console.log(id.padEnd(12), ((w / n) * 100).toFixed(1) + '%');
