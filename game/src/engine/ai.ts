import { Battle, elementRelation } from './battle';
import { SkillDef, Unit } from './types';

export interface Choice {
  skillId: string;
  targetUid?: string;
}

function isHealSkill(s: SkillDef) {
  return s.effects.some((e) => e.kind === 'heal') && !s.effects.some((e) => e.kind === 'damage');
}

/** AI đơn giản: ưu tiên tuyệt kỹ, hồi máu khi cần, đánh mục tiêu yếu / bị khắc hệ. */
export function chooseAction(b: Battle, actor: Unit): Choice {
  const [s1, s2, s3] = actor.hero.skills;
  const allies = b.alive(actor.team);
  const lowestAllyPct = Math.min(...allies.map((u) => u.hp / u.maxHp));

  const candidates: SkillDef[] = [];
  for (const s of [s3, s2]) {
    if (!b.skillReady(actor, s)) continue;
    // Kỹ năng thuần hồi máu chỉ dùng khi có đồng đội dưới 75% máu
    if (isHealSkill(s) && lowestAllyPct > 0.75) continue;
    candidates.push(s);
  }
  const skill = candidates[0] ?? s1;
  return { skillId: skill.id, targetUid: pickTarget(b, actor, skill) };
}

export function pickTarget(b: Battle, actor: Unit, skill: SkillDef): string | undefined {
  const valid = b.validTargets(actor, skill);
  if (!valid.length) return undefined;
  if (skill.target === 'ally') {
    return [...valid].sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0].uid;
  }
  const score = (u: Unit) => {
    const rel = elementRelation(actor.hero.element, u.hero.element);
    let s = u.hp / u.maxHp;
    if (rel === 'adv') s -= 0.3;
    if (rel === 'dis') s += 0.3;
    return s;
  };
  return [...valid].sort((x, y) => score(x) - score(y))[0].uid;
}
