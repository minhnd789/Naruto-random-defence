import { Rng } from './rng';
import {
  BattleEvent,
  CR_MAX,
  DEBUFFS,
  Effect,
  Element,
  HeroDef,
  SkillDef,
  Status,
  StatusType,
  TeamId,
  Unit,
} from './types';

// Vòng khắc chế ngũ hành: Hỏa > Phong > Lôi > Thổ > Thủy > Hỏa. Âm và Dương khắc nhau.
const BEATS: Partial<Record<Element, Element>> = {
  fire: 'wind',
  wind: 'lightning',
  lightning: 'earth',
  earth: 'water',
  water: 'fire',
  yin: 'yang',
  yang: 'yin',
};

export function elementRelation(att: Element, def: Element): 'adv' | 'dis' | 'none' {
  if (BEATS[att] === def) return 'adv';
  if (BEATS[def] === att) return 'dis';
  return 'none';
}

export const FRONT_SLOTS = [0, 1];
export const RAGE_START = 60;

export class Battle {
  units: Unit[] = [];
  rng: Rng;
  over = false;
  winner: TeamId | null = null;
  turnCount = 0;
  private actorUid: string | null = null;

  constructor(teamA: HeroDef[], teamB: HeroDef[], seed: number) {
    this.rng = new Rng(seed);
    const make = (h: HeroDef, team: TeamId, slot: number): Unit => ({
      uid: `${team}${slot}`,
      hero: h,
      team,
      slot,
      maxHp: h.stats.hp,
      hp: h.stats.hp,
      cr: 0,
      cooldowns: {},
      statuses: [],
      alive: true,
    });
    teamA.forEach((h, i) => this.units.push(make(h, 'A', i)));
    teamB.forEach((h, i) => this.units.push(make(h, 'B', i)));
    // Thanh hành động khởi đầu ngẫu nhiên nhẹ, tốc độ cao vẫn có lợi thế
    for (const u of this.units) u.cr = this.rng.range(0, 0.25) * CR_MAX;
  }

  // ---------- Truy vấn ----------
  unit(uid: string): Unit {
    const u = this.units.find((x) => x.uid === uid);
    if (!u) throw new Error('Không tìm thấy unit ' + uid);
    return u;
  }
  alive(team: TeamId): Unit[] {
    return this.units.filter((u) => u.team === team && u.alive);
  }
  enemiesOf(u: Unit): Unit[] {
    return this.alive(u.team === 'A' ? 'B' : 'A');
  }
  has(u: Unit, s: StatusType): boolean {
    return u.statuses.some((x) => x.type === s);
  }
  skillReady(u: Unit, s: SkillDef): boolean {
    return (u.cooldowns[s.id] ?? 0) <= 0;
  }

  spd(u: Unit): number {
    let m = 1;
    if (this.has(u, 'spdUp')) m += 0.3;
    if (this.has(u, 'spdDown')) m -= 0.3;
    return u.hero.stats.spd * m;
  }
  atk(u: Unit): number {
    let m = 1;
    if (this.has(u, 'atkUp')) m += 0.5;
    if (this.has(u, 'atkDown')) m -= 0.5;
    return u.hero.stats.atk * m;
  }
  def(u: Unit): number {
    let m = 1;
    if (this.has(u, 'defUp')) m += 0.6;
    if (this.has(u, 'defDown')) m -= 0.7;
    return u.hero.stats.def * m;
  }

  /** Bạo Nộ: sau lượt RAGE_START, sát thương tăng 5% mỗi lượt để trận không kéo dài vô tận. */
  rageMult(): number {
    return 1 + Math.max(0, this.turnCount - RAGE_START) * 0.05;
  }

  /** Mục tiêu hợp lệ. Đòn đơn mục tiêu phải đánh hàng trước nếu hàng trước còn người. */
  validTargets(actor: Unit, skill: SkillDef): Unit[] {
    if (skill.target === 'enemy') {
      const enemies = this.enemiesOf(actor);
      const front = enemies.filter((e) => FRONT_SLOTS.includes(e.slot));
      return front.length ? front : enemies;
    }
    if (skill.target === 'ally') return this.alive(actor.team);
    return [];
  }

  /** Dự đoán thứ tự ra đòn (không thay đổi trạng thái). */
  turnOrder(count = 10): string[] {
    const sim = this.units.filter((u) => u.alive).map((u) => ({ uid: u.uid, cr: u.cr, spd: this.spd(u) }));
    const out: string[] = [];
    if (!sim.length) return out;
    for (let i = 0; i < count; i++) {
      let best = sim[0];
      let bestT = Infinity;
      for (const s of sim) {
        const t = Math.max(0, (CR_MAX - s.cr) / s.spd);
        if (t < bestT || (t === bestT && s.spd > best.spd)) {
          bestT = t;
          best = s;
        }
      }
      for (const s of sim) s.cr += s.spd * bestT;
      out.push(best.uid);
      best.cr = 0;
    }
    return out;
  }

  // ---------- Vòng lượt ----------
  /**
   * Đẩy thời gian tới khi có người đầy thanh hành động.
   * canAct = false khi người đó bị choáng hoặc chết vì bỏng (lượt đã kết thúc).
   */
  nextTurn(): { actor: Unit; canAct: boolean; events: BattleEvent[] } | null {
    if (this.over) return null;
    const alive = this.units.filter((u) => u.alive);
    let actor = alive[0];
    let bestT = Infinity;
    for (const u of alive) {
      const t = Math.max(0, (CR_MAX - u.cr) / this.spd(u));
      if (t < bestT || (t === bestT && this.spd(u) > this.spd(actor))) {
        bestT = t;
        actor = u;
      }
    }
    for (const u of alive) u.cr = Math.min(CR_MAX, u.cr + this.spd(u) * bestT);
    actor.cr = CR_MAX;
    this.turnCount++;
    this.actorUid = actor.uid;

    const events: BattleEvent[] = [{ t: 'turnStart', uid: actor.uid }];
    for (const k of Object.keys(actor.cooldowns)) actor.cooldowns[k] = Math.max(0, actor.cooldowns[k] - 1);

    // Bỏng gây sát thương đầu lượt (bỏ qua phòng thủ)
    for (const s of actor.statuses.filter((x) => x.type === 'burn')) {
      this.applyDamage(actor, Math.round(s.value ?? 0), false, 'none', events, undefined, true);
      if (!actor.alive) break;
    }
    if (!actor.alive) {
      this.checkEnd(events);
      return { actor, canAct: false, events };
    }
    if (this.has(actor, 'stun')) {
      events.push({ t: 'stunned', uid: actor.uid });
      this.endTurn(actor, events);
      return { actor, canAct: false, events };
    }
    return { actor, canAct: true, events };
  }

  /** Thực hiện kỹ năng của actor hiện tại. */
  act(actorUid: string, skillId: string, targetUid?: string): BattleEvent[] {
    const actor = this.unit(actorUid);
    if (actor.uid !== this.actorUid) throw new Error('Không phải lượt của ' + actorUid);
    const skill = actor.hero.skills.find((s) => s.id === skillId);
    if (!skill) throw new Error('Không có kỹ năng ' + skillId);
    if (!this.skillReady(actor, skill)) throw new Error('Kỹ năng đang hồi');

    // Xác định mục tiêu
    let targets: Unit[];
    let primary: Unit | undefined;
    if (skill.target === 'enemy' || skill.target === 'ally') {
      const valid = this.validTargets(actor, skill);
      primary = valid.find((u) => u.uid === targetUid) ?? valid[0];
      targets = primary ? [primary] : [];
    } else if (skill.target === 'allEnemies') targets = this.enemiesOf(actor);
    else if (skill.target === 'allAllies') targets = this.alive(actor.team);
    else targets = [actor];

    const events: BattleEvent[] = [{ t: 'skill', uid: actor.uid, skillId, targets: targets.map((t) => t.uid) }];
    if (skill.cd > 0) actor.cooldowns[skill.id] = skill.cd;

    // Chí mạng tính một lần cho cả kỹ năng
    let extraTurn = false;
    const hitTargets: Unit[] = [];
    for (const eff of skill.effects) {
      if (this.over) break;
      if (eff.kind === 'damage') this.doDamage(actor, targets, eff, events, hitTargets);
      else if (eff.kind === 'heal') this.doHeal(actor, targets, eff, events);
      else if (eff.kind === 'status') this.doStatus(actor, targets, hitTargets, eff, events);
      else if (eff.kind === 'cr') this.doCr(actor, targets, hitTargets, eff, events);
      else if (eff.kind === 'cleanse') {
        const list = eff.to === 'allAllies' ? this.alive(actor.team) : targets;
        for (const u of list) {
          const before = u.statuses.length;
          u.statuses = u.statuses.filter((s) => !DEBUFFS.includes(s.type));
          if (u.statuses.length !== before) events.push({ t: 'cleanse', uid: u.uid });
        }
      } else if (eff.kind === 'extraTurn') {
        if (this.rng.chance(eff.chance)) extraTurn = true;
      }
    }

    if (!this.over) {
      this.endTurn(actor, events);
      if (extraTurn && actor.alive) {
        actor.cr = CR_MAX + 1;
        events.push({ t: 'extraTurn', uid: actor.uid });
      }
    }
    return events;
  }

  // ---------- Hiệu ứng ----------
  private doDamage(actor: Unit, targets: Unit[], eff: Extract<Effect, { kind: 'damage' }>, events: BattleEvent[], hit: Unit[]) {
    const hits = eff.hits ?? 1;
    for (const tgt of targets) {
      if (!tgt.alive) continue;
      const rel = elementRelation(actor.hero.element, tgt.hero.element);
      // Bị khắc hệ: 15% trượt
      if (rel === 'dis' && this.rng.chance(0.15)) {
        events.push({ t: 'damage', uid: tgt.uid, src: actor.uid, amount: 0, crit: false, adv: rel, shieldAbsorb: 0, miss: true });
        continue;
      }
      const critChance = actor.hero.stats.crit + (rel === 'adv' ? 0.15 : 0);
      const crit = this.rng.chance(critChance);
      const scaleVal =
        eff.scale === 'hp' ? actor.maxHp : eff.scale === 'def' ? this.def(actor) : this.atk(actor);
      const defEff = Math.max(0, this.def(tgt) * (1 - (eff.pierce ?? 0)));
      let dmg = scaleVal * eff.mult * 2.0 * (400 / (400 + defEff));
      if (rel === 'adv') dmg *= 1.3;
      if (rel === 'dis') dmg *= 0.85;
      if (crit) dmg *= actor.hero.stats.critDmg;
      dmg *= this.rageMult();
      dmg *= this.rng.range(0.95, 1.05);
      const per = Math.max(1, Math.round(dmg / hits));
      for (let i = 0; i < hits && tgt.alive; i++) this.applyDamage(tgt, per, crit, rel, events, actor.uid);
      hit.push(tgt);
    }
    this.checkEnd(events);
  }

  private applyDamage(tgt: Unit, amount: number, crit: boolean, adv: 'adv' | 'dis' | 'none', events: BattleEvent[], src?: string, dot = false) {
    let absorb = 0;
    const shield = tgt.statuses.find((s) => s.type === 'shield');
    if (shield && shield.value) {
      absorb = Math.min(shield.value, amount);
      shield.value -= absorb;
      if (shield.value <= 0) tgt.statuses = tgt.statuses.filter((s) => s !== shield);
    }
    const real = amount - absorb;
    tgt.hp = Math.max(0, tgt.hp - real);
    events.push({ t: 'damage', uid: tgt.uid, src, amount: real, crit, adv, shieldAbsorb: absorb, dot });
    if (tgt.hp <= 0 && tgt.alive) {
      tgt.alive = false;
      tgt.statuses = [];
      tgt.cr = 0;
      events.push({ t: 'death', uid: tgt.uid });
    }
  }

  private doHeal(actor: Unit, targets: Unit[], eff: Extract<Effect, { kind: 'heal' }>, events: BattleEvent[]) {
    const base = eff.scale === 'maxHp' ? actor.maxHp * eff.mult : this.atk(actor) * eff.mult;
    let list: Unit[];
    if (eff.to === 'allAllies') list = this.alive(actor.team);
    else if (eff.to === 'self') list = [actor];
    else if (eff.to === 'lowestAlly') {
      const a = this.alive(actor.team).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp);
      list = a.slice(0, 1);
    } else list = targets;
    for (const u of list) {
      if (!u.alive) continue;
      const amount = Math.round(Math.min(u.maxHp - u.hp, base * this.rng.range(0.97, 1.03)));
      u.hp += amount;
      events.push({ t: 'heal', uid: u.uid, amount });
    }
  }

  private resolveTo(actor: Unit, targets: Unit[], hit: Unit[], to: string): Unit[] {
    if (to === 'self') return [actor];
    if (to === 'allAllies') return this.alive(actor.team);
    if (to === 'allEnemies') return this.enemiesOf(actor);
    // 'target': nếu kỹ năng có gây sát thương thì chỉ áp lên người trúng đòn
    const base = hit.length ? hit : targets;
    return base.filter((u) => u.alive);
  }

  private doStatus(actor: Unit, targets: Unit[], hit: Unit[], eff: Extract<Effect, { kind: 'status' }>, events: BattleEvent[]) {
    const isDebuff = DEBUFFS.includes(eff.status);
    for (const u of this.resolveTo(actor, targets, hit, eff.to)) {
      if (!this.rng.chance(eff.chance)) continue;
      if (isDebuff && u.team !== actor.team) {
        const resist = Math.max(0.05, Math.min(0.85, u.hero.stats.res - actor.hero.stats.eff));
        if (this.rng.chance(resist)) {
          events.push({ t: 'status', uid: u.uid, status: eff.status, resisted: true });
          continue;
        }
      }
      // Hiệu ứng tự áp trong lượt của mình được +1 lượt vì sẽ bị trừ ngay cuối lượt này
      const turns = eff.turns + (u.uid === actor.uid ? 1 : 0);
      let value: number | undefined;
      if (eff.status === 'shield') value = Math.round(actor.maxHp * (eff.value ?? 0.15));
      if (eff.status === 'burn') value = Math.round(this.atk(actor) * (eff.value ?? 0.3));
      const existing = u.statuses.find((s) => s.type === eff.status);
      if (existing) {
        existing.turns = Math.max(existing.turns, turns);
        if (value !== undefined) existing.value = Math.max(existing.value ?? 0, value);
      } else u.statuses.push({ type: eff.status, turns, value, sourceUid: actor.uid } as Status);
      events.push({ t: 'status', uid: u.uid, status: eff.status });
    }
  }

  private doCr(actor: Unit, targets: Unit[], hit: Unit[], eff: Extract<Effect, { kind: 'cr' }>, events: BattleEvent[]) {
    for (const u of this.resolveTo(actor, targets, hit, eff.to)) {
      if (eff.chance !== undefined && !this.rng.chance(eff.chance)) continue;
      if (eff.amount < 0 && u.team !== actor.team) {
        const resist = Math.max(0.05, Math.min(0.85, u.hero.stats.res - actor.hero.stats.eff));
        if (this.rng.chance(resist)) continue;
      }
      if (u.uid === actor.uid) continue; // CR của người đang hành động sẽ về 0 cuối lượt
      const before = u.cr;
      u.cr = Math.max(0, Math.min(CR_MAX, u.cr + eff.amount * CR_MAX));
      if (u.cr !== before) events.push({ t: 'cr', uid: u.uid, delta: (u.cr - before) / CR_MAX });
    }
  }

  private endTurn(actor: Unit, events: BattleEvent[]) {
    actor.cr = 0;
    for (const s of actor.statuses) if (s.type !== 'shield' || s.turns > 0) s.turns--;
    const expired = actor.statuses.filter((s) => s.turns <= 0);
    actor.statuses = actor.statuses.filter((s) => s.turns > 0);
    for (const s of expired) events.push({ t: 'statusExpire', uid: actor.uid, status: s.type });
    this.actorUid = null;
  }

  private checkEnd(events: BattleEvent[]) {
    if (this.over) return;
    const a = this.alive('A').length;
    const b = this.alive('B').length;
    if (a === 0 || b === 0) {
      this.over = true;
      this.winner = a === 0 ? 'B' : 'A';
      events.push({ t: 'end', winner: this.winner });
    }
  }
}
