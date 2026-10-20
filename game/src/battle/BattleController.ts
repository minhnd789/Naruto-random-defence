// Vòng lặp trận đấu: lấy lượt từ engine, hỏi người chơi hoặc AI, phát hoạt cảnh
import { chooseAction, Choice } from '../engine/ai';
import { Battle, RAGE_START } from '../engine/battle';
import { HeroDef, SkillDef, TeamId, Unit } from '../engine/types';
import { BattleScene } from './BattleScene';

export interface HudUnit {
  uid: string;
  team: TeamId;
  hero: HeroDef;
  hp: number;
  maxHp: number;
  cr: number; // 0..1
  alive: boolean;
}

export interface HudState {
  ready: boolean;
  mySide: TeamId;
  units: HudUnit[];
  order: string[];
  activeUid: string | null;
  awaitingInput: boolean;
  selectedSkillId: string | null;
  cooldowns: Record<string, number>;
  auto: boolean;
  speed: number;
  turn: number;
  rage: number; // % sát thương cộng thêm
  over: boolean;
  winner: TeamId | null;
  damage: Record<string, number>;
  healing: Record<string, number>;
}

/** Trận RTA: mọi hành động do server công bố; lựa chọn của mình được gửi lên server. */
export interface RemoteDriver {
  /** Chờ server công bố hành động của nhân vật đang tới lượt. */
  nextAction(actorUid: string): Promise<Choice>;
  send(choice: Choice): void;
}

export class BattleController {
  battle: Battle;
  scene?: BattleScene;
  auto = false;
  speed = 1;
  private selected: SkillDef | null = null;
  private pending: { actor: Unit; resolve: (c: Choice) => void } | null = null;
  private disposed = false;
  private damage: Record<string, number> = {};
  private healing: Record<string, number> = {};
  private ready = false;
  /** Nhật ký lựa chọn của đội A, gửi lên server để chạy lại và xác thực. */
  actions: Choice[] = [];
  onOver?: (actions: Choice[]) => void;
  /** Phe của người đang xem (RTA có thể là B). */
  mySide: TeamId = 'A';
  remote?: RemoteDriver;

  constructor(teamA: HeroDef[], teamB: HeroDef[], seed: number, private onState: (s: HudState) => void) {
    this.battle = new Battle(teamA, teamB, seed);
  }

  async start(host: HTMLElement) {
    this.scene = await BattleScene.create(host, this.battle, this.mySide);
    if (this.disposed) return this.scene.destroy();
    this.scene.setSpeed(this.speed);
    this.scene.onUnitClick = (uid) => this.clickUnit(uid);
    this.ready = true;
    this.emit();
    await this.scene.intro();
    await this.loop();
  }

  private async loop() {
    const b = this.battle;
    const scene = this.scene!;
    while (!b.over && !this.disposed) {
      const turn = b.nextTurn();
      if (!turn) break;
      this.track(turn.events);
      this.emit(turn.actor.uid);
      await scene.playTurnStart(turn.events);
      scene.refresh(b);
      if (this.disposed) return;
      if (!turn.canAct) continue;

      let choice: Choice;
      const mine = turn.actor.team === this.mySide;
      if (this.remote) {
        // Server là nguồn sự thật: gửi lựa chọn của mình rồi chờ server công bố
        const announced = this.remote.nextAction(turn.actor.uid);
        if (mine) {
          if (this.auto) this.remote.send(chooseAction(b, turn.actor));
          else this.waitForPlayer(turn.actor).then((c) => c && this.remote?.send(c));
        }
        choice = await announced;
        this.cancelPending();
      } else if (mine && !this.auto) {
        choice = (await this.waitForPlayer(turn.actor))!;
      } else {
        await scene.tw.wait(220);
        choice = chooseAction(b, turn.actor);
      }
      if (this.disposed) return;
      if (mine) this.actions.push({ skillId: choice.skillId, targetUid: choice.targetUid });
      scene.setTargets([]);
      const events = b.act(turn.actor.uid, choice.skillId, choice.targetUid);
      this.track(events);
      this.emit(turn.actor.uid);
      await scene.playAction(events);
      scene.refresh(b);
      this.emit(null);
    }
    scene.setActive(null);
    this.emit(null);
    if (b.over && !this.disposed) this.onOver?.(this.actions);
  }

  private track(events: ReturnType<Battle['act']>) {
    for (const e of events) {
      if (e.t === 'damage' && e.src) this.damage[e.src] = (this.damage[e.src] ?? 0) + e.amount + e.shieldAbsorb;
      if (e.t === 'heal') {
        const src = events.find((x) => x.t === 'skill');
        if (src && src.t === 'skill') this.healing[src.uid] = (this.healing[src.uid] ?? 0) + e.amount;
      }
    }
  }

  private waitForPlayer(actor: Unit): Promise<Choice> {
    return new Promise((resolve) => {
      this.pending = { actor, resolve };
      const [s1, , s3] = actor.hero.skills;
      // Mặc định chọn tuyệt kỹ nếu sẵn sàng, không thì đòn thường
      this.selectSkill(this.battle.skillReady(actor, s3) ? s3.id : s1.id);
    });
  }

  selectSkill(skillId: string) {
    if (!this.pending) return;
    const actor = this.pending.actor;
    const skill = actor.hero.skills.find((s) => s.id === skillId);
    if (!skill || !this.battle.skillReady(actor, skill)) return;
    this.selected = skill;
    const b = this.battle;
    let targets: Unit[];
    if (skill.target === 'enemy' || skill.target === 'ally') targets = b.validTargets(actor, skill);
    else if (skill.target === 'allEnemies') targets = b.enemiesOf(actor);
    else if (skill.target === 'allAllies') targets = b.alive(actor.team);
    else targets = [actor];
    this.scene?.setTargets(targets.map((t) => t.uid));
    this.emit(actor.uid);
  }

  private clickUnit(uid: string) {
    if (!this.pending || !this.selected) return;
    const b = this.battle;
    const actor = this.pending.actor;
    const s = this.selected;
    let valid: string[];
    if (s.target === 'enemy' || s.target === 'ally') valid = b.validTargets(actor, s).map((u) => u.uid);
    else if (s.target === 'allEnemies') valid = b.enemiesOf(actor).map((u) => u.uid);
    else valid = b.alive(actor.team).map((u) => u.uid);
    if (!valid.includes(uid)) return;
    this.resolvePending({ skillId: s.id, targetUid: uid });
  }

  /** Server đã tự đánh thay (hết giờ): bỏ giao diện chọn kỹ năng đang mở. */
  private cancelPending() {
    if (!this.pending) return;
    this.pending = null;
    this.selected = null;
    this.scene?.setTargets([]);
  }

  private resolvePending(c: Choice) {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    this.selected = null;
    p.resolve(c);
  }

  setAuto(on: boolean) {
    this.auto = on;
    if (on && this.pending) this.resolvePending(chooseAction(this.battle, this.pending.actor));
    this.emit();
  }

  setSpeed(x: number) {
    this.speed = x;
    this.scene?.setSpeed(x);
    this.emit();
  }

  private lastActive: string | null = null;
  private emit(activeUid?: string | null) {
    if (activeUid !== undefined) this.lastActive = activeUid;
    const b = this.battle;
    const active = this.lastActive ? b.unit(this.lastActive) : null;
    this.onState({
      ready: this.ready,
      mySide: this.mySide,
      units: b.units.map((u) => ({ uid: u.uid, team: u.team, hero: u.hero, hp: u.hp, maxHp: u.maxHp, cr: Math.min(1, u.cr / 1000), alive: u.alive })),
      order: b.turnOrder(8),
      activeUid: this.lastActive,
      awaitingInput: !!this.pending,
      selectedSkillId: this.selected?.id ?? null,
      cooldowns: active ? { ...active.cooldowns } : {},
      auto: this.auto,
      speed: this.speed,
      turn: b.turnCount,
      rage: Math.round((b.rageMult() - 1) * 100),
      over: b.over,
      winner: b.winner,
      damage: { ...this.damage },
      healing: { ...this.healing },
    });
  }

  get rageStart() {
    return RAGE_START;
  }

  dispose() {
    this.disposed = true;
    if (this.pending) this.resolvePending({ skillId: this.pending.actor.hero.skills[0].id });
    this.scene?.destroy();
  }
}
