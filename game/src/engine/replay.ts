// Chạy lại trận đấu từ seed + nhật ký lựa chọn của đội A (server dùng để xác thực)
import { chooseAction, Choice } from './ai';
import { Battle } from './battle';
import { HeroDef, TeamId } from './types';

export const MAX_TURNS = 400;

export interface ReplayResult {
  winner: TeamId | null; // null = trận chưa kết thúc (bỏ cuộc giữa chừng)
  turns: number;
  error?: string;
}

export function replayBattle(teamA: HeroDef[], teamB: HeroDef[], seed: number, actions: Choice[]): ReplayResult {
  const b = new Battle(teamA, teamB, seed);
  let ai = 0;
  try {
    while (!b.over && b.turnCount < MAX_TURNS) {
      const t = b.nextTurn();
      if (!t) break;
      if (!t.canAct) continue;
      let c: Choice;
      if (t.actor.team === 'A') {
        if (ai >= actions.length) return { winner: null, turns: b.turnCount };
        c = actions[ai++];
        if (typeof c?.skillId !== 'string' || !t.actor.hero.skills.some((s) => s.id === c.skillId)) {
          return { winner: null, turns: b.turnCount, error: `Lượt ${b.turnCount}: kỹ năng không hợp lệ` };
        }
      } else {
        c = chooseAction(b, t.actor);
      }
      b.act(t.actor.uid, c.skillId, typeof c.targetUid === 'string' ? c.targetUid : undefined);
    }
  } catch (e) {
    return { winner: null, turns: b.turnCount, error: (e as Error).message };
  }
  if (ai < actions.length) return { winner: null, turns: b.turnCount, error: 'Nhật ký có hành động thừa' };
  return { winner: b.winner, turns: b.turnCount };
}
