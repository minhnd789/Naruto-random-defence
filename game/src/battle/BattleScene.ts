// Cảnh chiến đấu PixiJS: nhân vật, thanh máu, hiệu ứng đòn đánh, cut-in tuyệt kỹ
import { Application, Assets, ColorMatrixFilter, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { Battle } from '../engine/battle';
import { ELEMENT_INFO } from '../engine/heroes';
import { BattleEvent, SkillDef, StatusType, Unit } from '../engine/types';
import { HORIZON, STAGE_H, STAGE_W, makeBackdrop, makeGlowTexture, makeStreakTexture } from './backdrop';
import { SkillFx, fxNeeded, skillFx } from './skillFx';
import { Tweener, ease } from './tween';
import { FxInstance, FxPlayer, fxLibrary } from './vfx';

export type BattleTheme = 'konoha' | 'forest' | 'rain' | 'valley' | 'desert' | 'arena' | 'rta';

/** Ảnh nền: `ground` = tỉ lệ chiều cao nơi mặt đất phẳng bắt đầu, để căn chỗ đứng của nhân vật. */
const THEMES: Record<BattleTheme, { ground: number; ambient: 'petals' | 'fireflies' | 'rain' | 'mist' | 'sand' | 'embers' | 'sparkles' }> = {
  konoha: { ground: 0.55, ambient: 'petals' },
  forest: { ground: 0.6, ambient: 'fireflies' },
  rain: { ground: 0.62, ambient: 'rain' },
  valley: { ground: 0.8, ambient: 'mist' },
  desert: { ground: 0.66, ambient: 'sand' },
  arena: { ground: 0.66, ambient: 'embers' },
  rta: { ground: 0.72, ambient: 'sparkles' },
};
/** Độ cao (trong khung 1280x720) mà mặt đất của ảnh nền nên trùng vào: ngay trên hàng sau. */
const GROUND_STAGE_Y = 330;

export const FONT = '"Be Vietnam Pro", system-ui, sans-serif';
export const heroUrl = (img: string) => `/heroes/${img}`;

// Vị trí chân nhân vật đội A (đội B đối xứng). Slot 0-1 hàng trước, 2-4 hàng sau.
const POS_A: [number, number][] = [
  [478, 445],
  [438, 622],
  [282, 372],
  [240, 512],
  [196, 662],
];
const UNIT_H = 218;
const BAR_W = 116;

const STATUS_BADGE: Record<StatusType, { label: string; color: number; buff: boolean; name: string }> = {
  atkUp: { label: 'C▲', color: 0xe8553d, buff: true, name: 'Tăng công' },
  defUp: { label: 'T▲', color: 0x3d7be8, buff: true, name: 'Tăng thủ' },
  spdUp: { label: 'S▲', color: 0x2fb36a, buff: true, name: 'Tăng tốc' },
  shield: { label: '盾', color: 0x8fd3ff, buff: true, name: 'Khiên' },
  atkDown: { label: 'C▼', color: 0x7a2a8a, buff: false, name: 'Giảm công' },
  defDown: { label: 'T▼', color: 0x7a2a8a, buff: false, name: 'Giảm thủ' },
  spdDown: { label: 'S▼', color: 0x7a2a8a, buff: false, name: 'Giảm tốc' },
  stun: { label: '✦', color: 0xd4a017, buff: false, name: 'Choáng' },
  burn: { label: '火', color: 0xd9481c, buff: false, name: 'Bỏng' },
};

/** Vị trí chân: phe của người xem luôn ở bên trái. */
export function homeOf(left: boolean, slot: number) {
  const [x, y] = POS_A[slot];
  return { x: left ? x : STAGE_W - x, y };
}
const depthScale = (y: number) => 0.8 + ((y - 360) / 300) * 0.24;

class UnitView {
  root = new Container();
  body = new Container();
  sprite: Sprite;
  shadow = new Graphics();
  ring = new Graphics();
  marker = new Graphics();
  ui = new Container();
  bar = new Graphics();
  statusRow = new Container();
  flash = new ColorMatrixFilter();
  home: { x: number; y: number };
  scale: number;
  dir: number; // hướng tấn công: +1 sang phải, -1 sang trái
  hp: number;
  lagHp: number;
  shield = 0;
  targetable = false;
  dead = false;
  numStack = 0;

  constructor(public unit: Unit, tex: Texture, public mine: boolean) {
    this.home = homeOf(mine, unit.slot);
    this.scale = depthScale(this.home.y);
    this.dir = mine ? 1 : -1;
    this.hp = this.lagHp = unit.hp;
    const elColor = ELEMENT_INFO[unit.hero.element].color;

    this.root.position.set(this.home.x, this.home.y);
    this.shadow.ellipse(0, 0, 62 * this.scale, 16 * this.scale).fill({ color: 0x000000, alpha: 0.45 });
    this.ring.ellipse(0, 0, 78 * this.scale, 22 * this.scale).stroke({ width: 4, color: elColor, alpha: 1 });
    this.ring.ellipse(0, 0, 66 * this.scale, 17 * this.scale).fill({ color: elColor, alpha: 0.18 });
    this.ring.visible = false;

    this.sprite = new Sprite(tex);
    this.sprite.anchor.set(0.5, 1);
    const s = (UNIT_H * this.scale) / tex.height;
    this.sprite.scale.set(mine ? s : -s, s);
    this.sprite.eventMode = 'static';
    this.sprite.cursor = 'default';
    this.body.addChild(this.sprite);
    this.root.addChild(this.shadow, this.ring, this.body);

    // Thanh máu + huy hiệu hệ + tên
    const top = -UNIT_H * this.scale - 22;
    this.ui.position.set(0, top);
    const badge = new Graphics()
      .circle(-BAR_W / 2 - 8, 4, 13)
      .fill({ color: 0x120a14 })
      .circle(-BAR_W / 2 - 8, 4, 13)
      .stroke({ width: 2, color: elColor });
    const kanji = new Text({
      text: ELEMENT_INFO[unit.hero.element].icon,
      style: { fontFamily: FONT, fontSize: 14, fontWeight: '900', fill: elColor },
    });
    kanji.anchor.set(0.5);
    kanji.position.set(-BAR_W / 2 - 8, 4);
    const name = new Text({
      text: unit.hero.name,
      style: { fontFamily: FONT, fontSize: 13, fontWeight: '800', fill: 0xffffff, stroke: { color: 0x000000, width: 4 } },
    });
    name.position.set(-BAR_W / 2 + 6, -15);
    this.statusRow.position.set(-BAR_W / 2 + 6, 13);
    this.ui.addChild(this.bar, badge, kanji, name, this.statusRow);
    this.marker.poly([-11, -14, 11, -14, 0, 0]).fill({ color: 0xffd23f }).stroke({ width: 2, color: 0x000000 });
    this.marker.position.set(0, -34);
    this.marker.visible = false;
    this.ui.addChild(this.marker);
    this.root.addChild(this.ui);
    this.drawBar();
  }

  get chestY() {
    return this.home.y - UNIT_H * this.scale * 0.55;
  }

  drawBar() {
    const max = this.unit.maxHp;
    const g = this.bar;
    if (g.destroyed) return;
    const w = BAR_W, h = 10;
    g.clear();
    g.roundRect(-w / 2 - 2, -2, w + 4, h + 4, 4).fill({ color: 0x000000, alpha: 0.75 });
    const lag = Math.max(0, this.lagHp / max) * w;
    if (lag > 0) g.rect(-w / 2, 0, lag, h).fill({ color: 0xfff1b8 });
    const cur = Math.max(0, this.hp / max) * w;
    if (cur > 0) {
      g.rect(-w / 2, 0, cur, h).fill({ color: this.mine ? 0x35d07f : 0xf0434f });
      g.rect(-w / 2, 0, cur, 3).fill({ color: 0xffffff, alpha: 0.3 });
    }
    if (this.shield > 0) {
      const sw = Math.min(w, (this.shield / max) * w);
      g.rect(-w / 2, h - 3, sw, 3).fill({ color: 0xbfe8ff });
    }
    // vạch chia mỗi 1000 máu
    for (let v = 1000; v < max; v += 1000) {
      const x = -w / 2 + (v / max) * w;
      g.rect(x, 0, 1, h).fill({ color: 0x000000, alpha: 0.35 });
    }
  }

  refreshStatuses() {
    this.statusRow.removeChildren().forEach((c) => c.destroy());
    this.unit.statuses.forEach((s, i) => {
      const info = STATUS_BADGE[s.type];
      const c = new Container();
      c.addChild(new Graphics().roundRect(0, 0, 24, 16, 4).fill({ color: info.color }).stroke({ width: 1.5, color: 0x000000 }));
      const t = new Text({
        text: info.label,
        style: { fontFamily: FONT, fontSize: 10, fontWeight: '900', fill: 0xffffff },
      });
      t.anchor.set(0.5);
      t.position.set(12, 8);
      c.addChild(t);
      if (s.type !== 'shield') {
        const n = new Text({ text: String(s.turns), style: { fontFamily: FONT, fontSize: 9, fontWeight: '900', fill: 0xffffff, stroke: { color: 0, width: 3 } } });
        n.position.set(17, 6);
        c.addChild(n);
      }
      c.position.set(i * 26, 0);
      this.statusRow.addChild(c);
    });
  }
}

interface Particle {
  s: Sprite;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  grow: number;
  baseScale: number;
  loop?: boolean;
  /** Hạt lặp lại: đặt lại vị trí khi hết vòng đời (mưa rơi từ trên, đom đóm bay quanh…). */
  reset?: (p: Particle) => void;
  spin?: number;
}

export class BattleScene {
  app = new Application();
  tw = new Tweener();
  root = new Container(); // khung 1280x720, co giãn vừa màn hình
  world = new Container(); // phần bị rung khi va chạm
  bgSprite!: Sprite;
  ambient = new Container();
  groundFx = new Container(); // hiệu ứng dưới chân (vòng ấn chú)
  unitLayer = new Container();
  fxLayer = new Container();
  weather = new Container(); // mưa, cánh hoa, cát bay: phía trước nhân vật
  fx = new FxPlayer(fxLibrary);
  theme: BattleTheme = 'konoha';
  private curFx: SkillFx | null = null;
  private allyFxDone = new Set<string>();
  private statusFx = new Map<string, Partial<Record<'stun' | 'burn' | 'shield', FxInstance>>>();
  private bgDrift = 0;
  textLayer = new Container();
  overlay = new Container();
  views = new Map<string, UnitView>();
  particles: Particle[] = [];
  glowTex!: Texture;
  streakTex!: Texture;
  textures = new Map<string, Texture>();
  onUnitClick?: (uid: string) => void;
  mySide: 'A' | 'B' = 'A';
  private time = 0;
  private destroyed = false;

  static async create(host: HTMLElement, battle: Battle, mySide: 'A' | 'B' = 'A', theme: BattleTheme = 'konoha'): Promise<BattleScene> {
    const s = new BattleScene();
    s.mySide = mySide;
    s.theme = theme;
    await s.init(host, battle);
    return s;
  }

  private async init(host: HTMLElement, battle: Battle) {
    await this.app.init({
      resizeTo: host,
      backgroundColor: 0x0a0710,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    if (this.destroyed) return;
    host.appendChild(this.app.canvas);
    await document.fonts.load('900 20px "Be Vietnam Pro"').catch(() => {});

    const urls = [...new Set(battle.units.map((u) => heroUrl(u.hero.image)))];
    const skills = battle.units.flatMap((u) => u.hero.skills.map((skill) => ({ skill, element: u.hero.element })));
    // Tải song song: ảnh nhân vật, spritesheet hiệu ứng cần cho trận này, ảnh nền
    const [loaded, , bgTex] = await Promise.all([
      Assets.load(urls),
      fxLibrary.load(fxNeeded(skills)),
      Assets.load<Texture>(`/bg/bg_${this.theme}.webp`).catch(() => null),
    ]);
    for (const u of urls) this.textures.set(u, loaded[u]);

    this.glowTex = makeGlowTexture();
    this.streakTex = makeStreakTexture();
    this.bgSprite = new Sprite(bgTex ?? makeBackdrop());
    this.bgSprite.anchor.set(0.5, 0);
    this.app.stage.addChild(this.bgSprite, this.root);
    this.world.addChild(this.ambient, this.groundFx, this.unitLayer, this.fxLayer, this.weather, this.textLayer);
    this.root.addChild(this.world, this.overlay);

    for (const u of battle.units) {
      const v = new UnitView(u, this.textures.get(heroUrl(u.hero.image))!, u.team === this.mySide);
      v.sprite.on('pointertap', () => this.onUnitClick?.(u.uid));
      v.sprite.on('pointerover', () => {
        if (v.targetable) v.sprite.alpha = 0.85;
      });
      v.sprite.on('pointerout', () => (v.sprite.alpha = 1));
      this.views.set(u.uid, v);
      this.unitLayer.addChild(v.root);
    }
    this.sortUnits();
    this.spawnAmbient();

    this.app.ticker.add((t) => this.tick(t.deltaMS));
    this.app.renderer.on('resize', () => this.layout());
    this.layout();
  }

  setSpeed(x: number) {
    this.tw.speed = x;
  }

  private layout() {
    const w = this.app.screen.width, h = this.app.screen.height;
    const s = Math.min(w / STAGE_W, h / STAGE_H);
    this.root.scale.set(s);
    this.root.position.set((w - STAGE_W * s) / 2, (h - STAGE_H * s) / 2);
    // Ảnh nền phủ kín màn hình, rồi dời dọc để mặt đất của ảnh trùng chỗ đứng của nhân vật.
    // Không phóng quá 1.4 lần mức phủ kín; ảnh có mặt đất thấp (Thung Lũng) thì nhân vật đứng trên mặt nước.
    const tex = this.bgSprite.texture;
    const g = THEMES[this.theme].ground;
    const groundScreen = this.root.y + GROUND_STAGE_Y * s;
    const cover = Math.max(w / tex.width, h / tex.height);
    const want = Math.max(cover, (h - groundScreen) / ((1 - g) * tex.height), groundScreen / (g * tex.height));
    const bs = Math.min(want, cover * 1.4) * 1.02; // dư 2% cho hiệu ứng trôi nhẹ
    const hd = tex.height * bs;
    this.bgSprite.scale.set(bs);
    this.bgSprite.x = w / 2;
    this.bgSprite.y = Math.min(0, Math.max(h - hd, groundScreen - g * hd));
  }

  private sortUnits() {
    this.unitLayer.children.sort((a, b) => a.y - b.y);
  }

  private tick(dtMs: number) {
    this.tw.update(dtMs);
    const dt = dtMs * this.tw.speed;
    this.time += dt;
    this.fx.update(dt);
    // Nền trôi rất nhẹ cho cảm giác sống động
    this.bgDrift += dtMs;
    if (this.bgSprite) this.bgSprite.x = this.app.screen.width / 2 + Math.sin(this.bgDrift / 6000) * this.app.screen.width * 0.008;
    // Hiệu ứng trạng thái bám theo nhân vật khi họ lao đi
    for (const [uid, m] of this.statusFx) {
      const v = this.views.get(uid)!;
      const top = v.root.y - UNIT_H * v.scale;
      m.stun?.sprite.position.set(v.root.x, top - 6);
      m.burn?.sprite.position.set(v.root.x, v.root.y + 4);
      m.shield?.sprite.position.set(v.root.x, v.root.y - UNIT_H * v.scale * 0.5);
    }
    for (const v of this.views.values()) {
      if (v.dead) continue;
      const ph = this.time / 520 + v.unit.slot * 1.3 + (v.mine ? 0 : 2);
      v.body.scale.y = 1 + Math.sin(ph) * 0.013;
      v.body.scale.x = 1 - Math.sin(ph) * 0.006;
      if (v.ring.visible) v.ring.alpha = 0.65 + Math.sin(this.time / 160) * 0.3;
      if (v.marker.visible) v.marker.y = -34 + Math.sin(this.time / 120) * 5;
      if (v.lagHp > v.hp) {
        v.lagHp = Math.max(v.hp, v.lagHp - v.unit.maxHp * 0.0009 * dt);
        v.drawBar();
      }
    }
    // Hạt hiệu ứng
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      const k = p.life / p.max;
      p.vy += p.g * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.scale.set(p.baseScale * (1 + p.grow * k));
      p.s.alpha = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      if (p.spin) p.s.rotation += p.spin * dt;
      if (k >= 1) {
        if (p.loop) {
          p.life = 0;
          if (p.reset) p.reset(p);
          else {
            p.s.x = Math.random() * STAGE_W;
            p.s.y = STAGE_H + 20;
          }
        } else {
          p.s.destroy();
          this.particles.splice(i, 1);
        }
      }
    }
  }

  // ---------- Tiện ích hiệu ứng ----------
  private spawnAmbient() {
    const kind = THEMES[this.theme].ambient;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const add = (layer: Container, tex: Texture, n: number, init: (p: Particle) => void) => {
      for (let i = 0; i < n; i++) {
        const s = new Sprite(tex);
        s.anchor.set(0.5);
        layer.addChild(s);
        const p: Particle = { s, vx: 0, vy: 0, g: 0, life: 0, max: 1, grow: 0, baseScale: 0.1, loop: true };
        init(p);
        p.reset!(p);
        p.life = Math.random() * p.max; // rải đều vòng đời để không xuất hiện cùng lúc
        this.particles.push(p);
      }
    };
    if (kind === 'rain') {
      add(this.weather, this.streakTex, 90, (p) => {
        p.s.rotation = Math.PI / 2 + 0.25;
        p.s.tint = 0xb8c8ff;
        p.reset = (q) => {
          q.s.position.set(rnd(-100, STAGE_W + 100), rnd(-300, -20));
          q.vx = -0.25;
          q.vy = rnd(1.4, 1.9);
          q.max = rnd(500, 700);
          q.baseScale = rnd(0.25, 0.45);
        };
      });
      return;
    }
    const conf = {
      petals: { n: 40, tint: [0xffb7d5, 0xffd6e6, 0xff9ec4], add: false, front: true },
      sand: { n: 70, tint: [0xe8c48a, 0xd9a35a, 0xf5dcb0], add: false, front: true },
      fireflies: { n: 40, tint: [0xd8ff7a, 0x9dff9a, 0xfff2a0], add: true, front: false },
      mist: { n: 45, tint: [0xdff4ff, 0xffffff, 0xbfe0ff], add: true, front: false },
      embers: { n: 45, tint: [0xffa060, 0xffe0a0, 0xff7a3a], add: true, front: false },
      sparkles: { n: 55, tint: [0xb98cff, 0x7af0ff, 0xffffff], add: true, front: false },
    }[kind];
    const tex = kind === 'petals' || kind === 'sand' ? this.petalTex() : this.glowTex;
    add(conf.front ? this.weather : this.ambient, tex, conf.n, (p) => {
      p.s.blendMode = conf.add ? 'add' : 'normal';
      p.reset = (q) => {
        q.s.tint = conf.tint[Math.floor(Math.random() * conf.tint.length)];
        if (kind === 'petals') {
          q.s.position.set(rnd(0, STAGE_W + 200), rnd(-60, -10));
          q.vx = rnd(-0.06, -0.02);
          q.vy = rnd(0.03, 0.06);
          q.spin = rnd(-0.003, 0.003);
          q.max = rnd(9000, 14000);
          q.baseScale = rnd(0.25, 0.45);
        } else if (kind === 'sand') {
          q.s.position.set(rnd(-200, -20), rnd(HORIZON, STAGE_H));
          q.vx = rnd(0.25, 0.5);
          q.vy = rnd(-0.01, 0.01);
          q.spin = rnd(-0.01, 0.01);
          q.max = rnd(3000, 5000);
          q.baseScale = rnd(0.08, 0.16);
        } else if (kind === 'fireflies') {
          q.s.position.set(rnd(0, STAGE_W), rnd(HORIZON - 80, STAGE_H));
          q.vx = rnd(-0.02, 0.02);
          q.vy = rnd(-0.015, 0.01);
          q.max = rnd(4000, 8000);
          q.baseScale = rnd(0.12, 0.22);
        } else if (kind === 'mist') {
          q.s.position.set(rnd(0, STAGE_W), rnd(HORIZON, STAGE_H + 40));
          q.vx = rnd(-0.01, 0.01);
          q.vy = rnd(-0.03, -0.01);
          q.max = rnd(6000, 10000);
          q.baseScale = rnd(0.6, 1.4);
        } else {
          q.s.position.set(rnd(0, STAGE_W), rnd(HORIZON, STAGE_H + 50));
          q.vx = rnd(-0.008, 0.008);
          q.vy = rnd(-0.05, -0.02);
          q.max = rnd(6000, 11000);
          q.baseScale = rnd(0.07, 0.2);
        }
      };
    });
  }

  /** Cánh hoa / hạt cát: hình bầu dục nhỏ mềm vẽ bằng canvas. */
  private petalTex(): Texture {
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 32;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(24, 16, 2, 24, 16, 22);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(24, 16, 22, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    return Texture.from(c);
  }

  burst(x: number, y: number, color: number, n = 14, speed = 0.45, size = 0.4, layer = this.fxLayer, gravity = 0.0006) {
    for (let i = 0; i < n; i++) {
      const s = new Sprite(this.glowTex);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.tint = color;
      s.position.set(x, y);
      layer.addChild(s);
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random());
      this.particles.push({
        s, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 0.12, g: gravity,
        life: 0, max: 380 + Math.random() * 320, grow: -0.6, baseScale: size * (0.6 + Math.random() * 0.8),
      });
    }
  }

  private ringFx(x: number, y: number, color: number, radius = 90, dur = 380) {
    const g = new Graphics().ellipse(0, 0, radius, radius * 0.4).stroke({ width: 6, color });
    g.position.set(x, y);
    g.blendMode = 'add';
    g.scale.set(0.2);
    this.fxLayer.addChild(g);
    this.tw.to(g.scale, { x: 1, y: 1 }, dur, ease.outCubic);
    this.tw.to(g, { alpha: 0 }, dur, ease.inQuad).then(() => g.destroy());
  }

  private slashFx(x: number, y: number, color: number) {
    for (let i = 0; i < 2; i++) {
      const s = new Sprite(this.streakTex);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.tint = i ? 0xffffff : color;
      s.rotation = (Math.random() - 0.5) * 1.6;
      s.position.set(x, y);
      s.scale.set(0.2, i ? 1.2 : 3);
      this.fxLayer.addChild(s);
      this.tw.to(s.scale, { x: 1.3 }, 160, ease.outExpo);
      this.tw.to(s, { alpha: 0 }, 260, ease.inQuad).then(() => s.destroy());
    }
  }

  shake(power = 8, dur = 260) {
    return this.tw.run(dur, (k) => {
      const p = power * (1 - k);
      this.world.position.set((Math.random() - 0.5) * p * 2, (Math.random() - 0.5) * p * 2);
      if (k >= 1) this.world.position.set(0, 0);
    });
  }

  screenFlash(color = 0xffffff, alpha = 0.6, dur = 260) {
    const g = new Graphics().rect(-2000, -2000, STAGE_W + 4000, STAGE_H + 4000).fill({ color });
    g.alpha = alpha;
    this.overlay.addChild(g);
    return this.tw.to(g, { alpha: 0 }, dur, ease.inQuad).then(() => g.destroy());
  }

  floatText(x: number, y: number, text: string, opts: { color?: number; size?: number; stroke?: number; italic?: boolean; dur?: number; rise?: number } = {}) {
    const t = new Text({
      text,
      style: {
        fontFamily: FONT,
        fontSize: opts.size ?? 30,
        fontWeight: '900',
        fontStyle: opts.italic ? 'italic' : 'normal',
        fill: opts.color ?? 0xffffff,
        stroke: { color: opts.stroke ?? 0x000000, width: Math.max(4, (opts.size ?? 30) / 6) },
        dropShadow: { color: 0x000000, alpha: 0.6, blur: 4, distance: 3, angle: Math.PI / 2 },
      },
    });
    t.anchor.set(0.5);
    t.position.set(x, y);
    t.scale.set(1.6);
    this.textLayer.addChild(t);
    const dur = opts.dur ?? 900;
    this.tw.to(t.scale, { x: 1, y: 1 }, 160, ease.outBack);
    this.tw.to(t, { y: y - (opts.rise ?? 50) }, dur, ease.outCubic);
    this.tw.wait(dur * 0.6).then(() => this.tw.to(t, { alpha: 0 }, dur * 0.4).then(() => t.destroy()));
    return t;
  }

  private numberPos(v: UnitView) {
    const off = v.numStack * 30;
    v.numStack++;
    this.tw.wait(450).then(() => (v.numStack = Math.max(0, v.numStack - 1)));
    return { x: v.home.x + (Math.random() - 0.5) * 30, y: v.home.y - UNIT_H * v.scale * 0.7 - off };
  }

  // ---------- Trạng thái lượt / chọn mục tiêu ----------
  setActive(uid: string | null) {
    for (const v of this.views.values()) v.ring.visible = v.unit.uid === uid && !v.dead;
  }

  setTargets(uids: string[]) {
    for (const v of this.views.values()) {
      v.targetable = uids.includes(v.unit.uid);
      v.marker.visible = v.targetable;
      v.sprite.cursor = v.targetable ? 'pointer' : 'default';
      if (!v.targetable) v.sprite.alpha = 1;
    }
  }

  refresh(battle: Battle) {
    for (const v of this.views.values()) {
      const u = battle.unit(v.unit.uid);
      v.shield = u.statuses.find((s) => s.type === 'shield')?.value ?? 0;
      v.hp = u.hp;
      v.refreshStatuses();
      v.drawBar();
      this.syncStatusFx(v);
    }
  }

  // ---------- Kịch bản ----------
  async intro() {
    const vs = [...this.views.values()];
    for (const v of vs) {
      v.root.x = v.home.x - v.dir * 500;
      v.root.alpha = 0;
    }
    const banner = this.floatText(STAGE_W / 2, STAGE_H * 0.42, 'TRẬN ĐẤU BẮT ĐẦU', { size: 64, italic: true, stroke: 0x8a1f1f, dur: 1500, rise: 10 });
    banner.zIndex = 10;
    await Promise.all(
      vs.map((v, i) =>
        this.tw.wait(i * 60).then(() => {
          this.tw.to(v.root, { alpha: 1 }, 300);
          return this.tw.to(v.root, { x: v.home.x }, 520, ease.outCubic);
        }),
      ),
    );
    await this.tw.wait(500);
  }

  async playTurnStart(events: BattleEvent[]) {
    for (const ev of events) {
      if (ev.t === 'turnStart') this.setActive(ev.uid);
      else await this.applyEvent(ev);
    }
    if (events.some((e) => e.t !== 'turnStart')) await this.tw.wait(450);
  }

  async playAction(events: BattleEvent[]) {
    const sk = events[0];
    if (sk.t !== 'skill') return;
    const actor = this.views.get(sk.uid)!;
    const skill = actor.unit.hero.skills.find((s) => s.id === sk.skillId)!;
    const targets = sk.targets.map((id) => this.views.get(id)!);
    const color = ELEMENT_INFO[actor.unit.hero.element].color;
    const offensive = skill.target === 'enemy' || skill.target === 'allEnemies';
    const fx = skillFx(skill, actor.unit.hero.element);
    const has = (n?: string) => fxLibrary.has(n);
    this.curFx = fx;
    this.allyFxDone.clear();

    if (skill.cutin) await this.cutin(actor, skill);
    else this.skillBanner(actor, skill);

    // 1. Tụ chiêu tại người dùng
    if (has(fx.cast)) {
      const ground = fx.cast === 'fx_cast_circle';
      const c = this.fx.play(fx.cast, ground ? this.groundFx : this.fxLayer, actor.home.x, ground ? actor.home.y : actor.chestY, {
        scale: (fx.castScale ?? (ground ? 1.2 : 1)) * actor.scale,
      });
      if (ground && c) c.sprite.scale.y *= 0.45; // vòng ấn chú nằm nghiêng trên mặt đất
      if (c && fx.move === 'stay') await this.tw.wait(Math.min(420, c.duration * 0.4));
    }

    const center = targets.length
      ? { x: targets.reduce((s, t) => s + t.home.x, 0) / targets.length, y: targets.reduce((s, t) => s + t.chestY, 0) / targets.length }
      : { x: STAGE_W / 2, y: 480 };
    const t0 = targets[0];
    let moved: 'dash' | 'teleport' | null = null;

    // 2. Tiếp cận: lao tới / dịch chuyển (cầm Rasengan, Chidori trên tay) hoặc bắn vật bay
    if (offensive && (fx.move === 'dash' || fx.move === 'teleport')) {
      moved = fx.move;
      const dest = skill.target === 'enemy' ? { x: t0.home.x - actor.dir * 125, y: t0.home.y + 1 } : { x: center.x - actor.dir * 170, y: 540 };
      const hold = has(fx.hold) ? this.fx.play(fx.hold, this.fxLayer, actor.root.x, actor.chestY, { scale: 0.55 * actor.scale, persist: true }) : null;
      const follow = hold
        ? this.tw.every(() => hold.sprite.position.set(actor.root.x + actor.dir * 62 * actor.scale, actor.root.y - UNIT_H * actor.scale * 0.48))
        : null;
      if (fx.move === 'teleport') await this.teleport(actor, dest);
      else await this.dash(actor, dest);
      if (hold) {
        // Dí quả cầu vào mục tiêu rồi mới tắt
        await this.tw.to(hold.sprite.scale, { x: hold.sprite.scale.x * 1.5, y: hold.sprite.scale.y * 1.5 }, 90, ease.outQuad);
        follow?.();
        hold.stop(100);
      }
    } else if (offensive) {
      if (!has(fx.cast)) await this.castAnim(actor, color);
      else {
        this.tw.to(actor.root, { x: actor.home.x + actor.dir * 22 }, 130, ease.outQuad).then(() => this.tw.to(actor.root, { x: actor.home.x }, 280, ease.outCubic));
      }
      if (has(fx.proj)) await this.projectileFx(actor, fx, skill.target === 'enemy' ? { x: t0.home.x, y: t0.chestY } : center);
      else if (!has(fx.burst) && skill.target === 'enemy') await this.projectile(actor, t0, color);
    } else {
      // Hỗ trợ: hiệu ứng trên từng đồng đội
      if (!has(fx.cast)) await this.castAnim(actor, color);
      for (const t of targets) this.playAllyFx(t);
      await this.tw.wait(260);
    }

    // 3. Vụ nổ lớn: khớp thời điểm sát thương với khung "trúng"
    if (offensive && has(fx.burst)) {
      const spots = fx.burstAt === 'center' ? [center] : targets.map((t) => ({ x: t.home.x, y: t.chestY }));
      let impact: Promise<void> | null = null;
      for (const p of spots) {
        const b = this.fx.play(fx.burst, this.fxLayer, p.x, p.y, { scale: (fx.burstScale ?? 1.2) * (fx.burstAt === 'center' ? 1 : t0.scale) });
        if (b) impact ??= b.at(fx.impactFrame ?? 3);
      }
      const big = fx.burstAt === 'center' || !!skill.cutin;
      if (impact) await impact;
      if (big) {
        this.screenFlash(color, skill.cutin ? 0.35 : 0.18, 260);
        this.shake(skill.cutin ? 12 : 7, 360);
      }
    } else if (offensive && !moved && !has(fx.proj) && skill.target === 'allEnemies') {
      await this.aoeWave(targets, color, !!skill.cutin);
    }

    // 4. Diễn các sự kiện (số sát thương, hồi máu, trạng thái)
    let lastDamageUid = '';
    for (const ev of events.slice(1)) {
      await this.applyEvent(ev, actor);
      if (ev.t === 'damage') {
        await this.tw.wait(ev.uid === lastDamageUid ? 170 : 45);
        lastDamageUid = ev.uid;
      } else if (ev.t === 'heal' || ev.t === 'status' || ev.t === 'cr') await this.tw.wait(40);
    }
    await this.tw.wait(380);
    if (moved === 'teleport') await this.teleport(actor, actor.home);
    else if (moved) await this.returnHome(actor);
    this.sortUnits();
    this.curFx = null;
  }

  /** Hiệu ứng trên đồng đội (hồi máu / tăng sức mạnh / khiên), mỗi người một lần mỗi đòn. */
  private playAllyFx(v: UnitView, fallback?: string) {
    if (this.allyFxDone.has(v.unit.uid)) return;
    const name = this.curFx?.ally ?? fallback;
    if (!fxLibrary.has(name)) return;
    this.allyFxDone.add(v.unit.uid);
    const feet = name === 'fx_heal' || name === 'fx_buff';
    const loop = fxLibrary.manifest[name]?.loop;
    this.fx.play(name, this.fxLayer, v.home.x, feet ? v.home.y + 8 : v.chestY, {
      scale: (this.curFx?.allyScale ?? 1) * v.scale * (feet ? 1.1 : loop ? 0.75 : 1),
      anchorY: feet ? 0.78 : 0.5,
      alpha: loop ? 0.7 : 1,
      // Hiệu ứng lặp (khiên) chỉ loé lên một nhịp; khiên kéo dài do syncStatusFx lo
      life: loop ? 700 : undefined,
    });
  }

  /** Vật bay (quả cầu lửa, Rasenshuriken, cá mập nước) hoặc thiên thạch rơi từ trời. */
  private async projectileFx(actor: UnitView, fx: SkillFx, dest: { x: number; y: number }) {
    const fromSky = fx.projFrom === 'sky';
    const start = fromSky ? { x: dest.x - actor.dir * 420, y: -160 } : { x: actor.home.x + actor.dir * 60, y: actor.chestY };
    const p = this.fx.play(fx.proj, this.fxLayer, start.x, start.y, {
      scale: (fx.projScale ?? 1) * (fromSky ? 1 : actor.scale),
      flipX: actor.dir < 0,
      persist: true,
    });
    if (!p) return;
    const ms = fx.projMs ?? (fromSky ? 800 : 300);
    await this.tw.run(ms, (k) => {
      p.sprite.x = start.x + (dest.x - start.x) * k;
      p.sprite.y = start.y + (dest.y - start.y) * k - (fromSky ? 0 : Math.sin(k * Math.PI) * 24);
    }, fromSky ? ease.inQuad : ease.inOutQuad);
    p.stop(80);
  }

  /** Phi Lôi Thần: loé sáng ở chỗ cũ, biến mất, xuất hiện tại chỗ mới. */
  private async teleport(v: UnitView, dest: { x: number; y: number }) {
    const flash = (x: number, y: number) =>
      this.fx.play('fx_flash_step', this.fxLayer, x, y - UNIT_H * v.scale * 0.5, { scale: 0.9 * v.scale });
    flash(v.root.x, v.root.y);
    this.unitLayer.setChildIndex(v.root, this.unitLayer.children.length - 1);
    await this.tw.to(v.root, { alpha: 0 }, 70);
    v.root.position.set(dest.x, dest.y);
    flash(dest.x, dest.y);
    await this.tw.to(v.root, { alpha: 1 }, 90);
  }

  /** Vòng choáng trên đầu, lửa bỏng dưới chân, khiên quanh người: hiện khi còn trạng thái. */
  private syncStatusFx(v: UnitView) {
    const m = this.statusFx.get(v.unit.uid) ?? {};
    const want = {
      stun: !v.dead && v.unit.statuses.some((s) => s.type === 'stun'),
      burn: !v.dead && v.unit.statuses.some((s) => s.type === 'burn'),
      shield: !v.dead && v.unit.statuses.some((s) => s.type === 'shield'),
    };
    const conf = {
      stun: { name: 'fx_stun', scale: 0.42, anchorY: 0.6, alpha: 1 },
      burn: { name: 'fx_burn', scale: 0.55, anchorY: 0.85, alpha: 0.9 },
      shield: { name: 'fx_shield', scale: 0.72, anchorY: 0.5, alpha: 0.3 },
    } as const;
    for (const k of ['stun', 'burn', 'shield'] as const) {
      if (want[k] && !m[k]) {
        const c = conf[k];
        m[k] = this.fx.play(c.name, this.fxLayer, v.root.x, v.root.y, { scale: c.scale * v.scale, anchorY: c.anchorY, alpha: c.alpha, persist: true }) ?? undefined;
      } else if (!want[k] && m[k]) {
        m[k]!.stop(200);
        delete m[k];
      }
    }
    this.statusFx.set(v.unit.uid, m);
  }

  private async applyEvent(ev: BattleEvent, actor?: UnitView) {
    const v = 'uid' in ev ? this.views.get(ev.uid) : undefined;
    switch (ev.t) {
      case 'damage': {
        if (!v) return;
        const p = this.numberPos(v);
        if (ev.miss) {
          this.floatText(p.x, p.y, 'TRƯỢT', { size: 26, color: 0xb8c0cc });
          this.tw.to(v.body, { x: v.dir * -22 }, 120).then(() => this.tw.to(v.body, { x: 0 }, 200));
          return;
        }
        v.hp = Math.max(0, v.hp - ev.amount);
        v.shield = Math.max(0, v.shield - ev.shieldAbsorb);
        v.drawBar();
        const color = actor ? ELEMENT_INFO[actor.unit.hero.element].color : 0xff7a2a;
        if (ev.dot) {
          this.burst(v.home.x, v.chestY, 0xff5a1a, 10, 0.2, 0.4, this.fxLayer, -0.0005);
          this.floatText(p.x, p.y, `${ev.amount}`, { size: 26, color: 0xffa040 });
          this.hitReact(v, 0.5);
          return;
        }
        this.hitReact(v, ev.crit ? 1.4 : 1);
        const hit = this.curFx?.hit;
        if (fxLibrary.has(hit)) {
          const slashy = hit.startsWith('fx_slash') || hit === 'fx_wind_blades';
          this.fx.play(hit, this.fxLayer, v.home.x + (Math.random() - 0.5) * 20, v.chestY + (Math.random() - 0.5) * 20, {
            scale: (this.curFx?.hitScale ?? 1) * v.scale * (ev.crit ? 1.25 : 1),
            rotation: slashy ? (Math.random() - 0.5) * 0.9 : 0,
            flipX: v.dir > 0,
          });
          this.burst(v.home.x, v.chestY, color, ev.crit ? 12 : 6, ev.crit ? 0.5 : 0.35);
        } else {
          this.slashFx(v.home.x, v.chestY, color);
          this.burst(v.home.x, v.chestY, color, ev.crit ? 22 : 12, ev.crit ? 0.6 : 0.45);
        }
        if (ev.crit) {
          this.shake(10, 240);
          this.floatText(p.x, p.y - 34, 'CHÍ MẠNG!', { size: 18, color: 0xffd23f, italic: true });
          this.floatText(p.x, p.y, `${ev.amount}`, { size: 44, color: 0xffd23f, stroke: 0x7a2a00, italic: true });
        } else {
          this.floatText(p.x, p.y, `${ev.amount}`, { size: 32, color: 0xffffff });
        }
        if (ev.adv === 'adv') this.floatText(p.x + 50, p.y + 16, 'KHẮC HỆ', { size: 14, color: 0xff9a3c });
        if (ev.shieldAbsorb > 0) this.floatText(p.x - 40, p.y + 22, `Khiên −${ev.shieldAbsorb}`, { size: 14, color: 0xbfe8ff });
        return;
      }
      case 'heal': {
        if (!v || ev.amount <= 0) return;
        v.hp = Math.min(v.unit.maxHp, v.hp + ev.amount);
        v.lagHp = Math.max(v.lagHp, v.hp);
        v.drawBar();
        const p = this.numberPos(v);
        this.floatText(p.x, p.y, `+${ev.amount}`, { size: 30, color: 0x6dff9a, stroke: 0x0b4020 });
        if (fxLibrary.has('fx_heal')) this.playAllyFx(v, 'fx_heal');
        else this.burst(v.home.x, v.home.y - 20, 0x6dff9a, 12, 0.18, 0.35, this.fxLayer, -0.0009);
        return;
      }
      case 'status': {
        if (!v) return;
        const info = STATUS_BADGE[ev.status];
        const p = this.numberPos(v);
        if (ev.resisted) this.floatText(p.x, p.y, 'KHÁNG', { size: 18, color: 0xcfd6e0 });
        else this.floatText(p.x, p.y, info.name, { size: 18, color: info.buff ? 0x9fd8ff : 0xff8ab8 });
        if (ev.resisted) return;
        if (info.buff && ev.status !== 'shield') this.playAllyFx(v, 'fx_buff');
        else if (!info.buff && ev.status !== 'stun' && ev.status !== 'burn' && fxLibrary.has('fx_debuff')) {
          this.fx.play('fx_debuff', this.fxLayer, v.home.x, v.chestY, { scale: 0.75 * v.scale });
        }
        if (ev.status === 'shield') this.playAllyFx(v);
        if (fxLibrary.has('fx_stun')) this.syncStatusFx(v);
        else if (ev.status === 'stun') this.ringFx(v.home.x, v.home.y - UNIT_H * v.scale - 4, 0xffd23f, 40);
        else if (ev.status === 'shield') this.ringFx(v.home.x, v.home.y - 60, 0xbfe8ff, 80, 500);
        return;
      }
      case 'cr': {
        if (!v) return;
        const p = this.numberPos(v);
        const pct = Math.round(ev.delta * 100);
        this.floatText(p.x, p.y, `${pct > 0 ? '+' : ''}${pct}% hành động`, { size: 16, color: pct > 0 ? 0x7af0ff : 0xc79bff });
        return;
      }
      case 'cleanse':
        if (v) this.burst(v.home.x, v.chestY, 0xffffff, 8, 0.2, 0.3, this.fxLayer, -0.0006);
        return;
      case 'stunned':
        if (v) this.floatText(v.home.x, v.home.y - UNIT_H * v.scale - 40, 'CHOÁNG', { size: 24, color: 0xffd23f });
        return;
      case 'extraTurn':
        if (v) this.floatText(v.home.x, v.home.y - UNIT_H * v.scale - 60, 'THÊM LƯỢT!', { size: 26, color: 0x7af0ff, italic: true, dur: 1200 });
        return;
      case 'death':
        if (v) this.deathAnim(v);
        return;
      default:
        return;
    }
  }

  private hitReact(v: UnitView, power: number) {
    v.body.filters = [v.flash];
    v.flash.brightness(2.4, false);
    this.tw.wait(90).then(() => {
      if (!v.dead) v.body.filters = [];
    });
    this.tw.to(v.body, { x: v.dir * -18 * power }, 70, ease.outQuad).then(() => this.tw.to(v.body, { x: 0 }, 240, ease.outCubic));
  }

  private deathAnim(v: UnitView) {
    v.dead = true;
    v.ring.visible = false;
    v.marker.visible = false;
    const gray = new ColorMatrixFilter();
    gray.desaturate();
    v.body.filters = [gray];
    if (fxLibrary.has('fx_death_smoke')) this.fx.play('fx_death_smoke', this.fxLayer, v.root.x, v.chestY, { scale: 1.3 * v.scale });
    else this.burst(v.home.x, v.chestY, 0xffffff, 20, 0.35, 0.5);
    this.syncStatusFx(v);
    this.tw.to(v.ui, { alpha: 0 }, 300);
    this.tw.to(v.root, { alpha: 0 }, 900, ease.inQuad);
    this.tw.to(v.body, { y: 24 }, 900, ease.inQuad);
  }

  private skillBanner(actor: UnitView, skill: SkillDef) {
    if (skill.slot === 1) return;
    this.floatText(actor.home.x, actor.home.y - UNIT_H * actor.scale - 64, skill.name, {
      size: 22,
      italic: true,
      color: 0xffffff,
      stroke: ELEMENT_INFO[actor.unit.hero.element].color,
      dur: 1100,
      rise: 20,
    });
  }

  private async dash(v: UnitView, dest: { x: number; y: number }) {
    const color = ELEMENT_INFO[v.unit.hero.element].color;
    this.unitLayer.setChildIndex(v.root, this.unitLayer.children.length - 1);
    await this.tw.to(v.root, { x: v.root.x - v.dir * 18 }, 90, ease.outQuad);
    const sx = v.root.x, sy = v.root.y;
    if (fxLibrary.has('fx_dash_trail')) {
      const trail = this.fx.play('fx_dash_trail', this.fxLayer, (sx + dest.x) / 2, (sy + dest.y) / 2 - UNIT_H * v.scale * 0.45, {
        scale: Math.min(2.2, Math.abs(dest.x - sx) / 260) * v.scale,
        flipX: v.dir < 0,
        alpha: 0.85,
        fps: 40,
      });
      trail?.sprite.position.set((sx + dest.x) / 2, (sy + dest.y) / 2 - UNIT_H * v.scale * 0.45);
    }
    let lastGhost = 0;
    await this.tw.run(200, (k) => {
      v.root.x = sx + (dest.x - sx) * k;
      v.root.y = sy + (dest.y - sy) * k;
      if (k - lastGhost > 0.2 && k < 1) {
        lastGhost = k;
        this.ghost(v, color);
      }
    }, ease.inOutQuad);
  }

  private ghost(v: UnitView, color: number) {
    const g = new Sprite(v.sprite.texture);
    g.anchor.set(0.5, 1);
    g.scale.copyFrom(v.sprite.scale);
    g.position.set(v.root.x, v.root.y);
    g.tint = color;
    g.alpha = 0.45;
    g.blendMode = 'add';
    this.fxLayer.addChild(g);
    this.tw.to(g, { alpha: 0 }, 260).then(() => g.destroy());
  }

  private async returnHome(v: UnitView) {
    await this.tw.to(v.root, { x: v.home.x, y: v.home.y }, 260, ease.outCubic);
    this.sortUnits();
  }

  private async castAnim(v: UnitView, color: number) {
    this.ringFx(v.home.x, v.home.y, color, 100, 420);
    this.burst(v.home.x, v.chestY, color, 10, 0.15, 0.35, this.fxLayer, -0.0006);
    await this.tw.to(v.root, { x: v.home.x + v.dir * 26 }, 140, ease.outQuad);
    this.tw.to(v.root, { x: v.home.x }, 300, ease.outCubic);
  }

  private async projectile(from: UnitView, to: UnitView, color: number) {
    const core = new Sprite(this.glowTex);
    core.anchor.set(0.5);
    core.blendMode = 'add';
    core.tint = color;
    core.scale.set(1.3);
    const sx = from.home.x + from.dir * 50, sy = from.chestY;
    core.position.set(sx, sy);
    this.fxLayer.addChild(core);
    let acc = 0;
    await this.tw.run(240, (k) => {
      core.x = sx + (to.home.x - sx) * k;
      core.y = sy + (to.chestY - sy) * k - Math.sin(k * Math.PI) * 30;
      acc++;
      if (acc % 2 === 0) this.burst(core.x, core.y, color, 1, 0.05, 0.5, this.fxLayer, 0);
    }, ease.inQuad);
    core.destroy();
  }

  private async aoeWave(targets: UnitView[], color: number, big: boolean) {
    this.screenFlash(color, big ? 0.45 : 0.2, 300);
    if (big) this.shake(12, 380);
    for (const t of targets) {
      this.ringFx(t.home.x, t.home.y, color, 110, 450);
      this.burst(t.home.x, t.home.y - 20, color, 16, 0.35, 0.5, this.fxLayer, -0.0004);
    }
    await this.tw.wait(180);
  }

  /** Cut-in tuyệt kỹ: dải chéo màu hệ, chân dung lớn trượt qua, tên chiêu. */
  private async cutin(v: UnitView, skill: SkillDef) {
    const el = ELEMENT_INFO[v.unit.hero.element];
    const fromRight = v.mine;
    const layer = new Container();
    this.overlay.addChild(layer);

    const dim = new Graphics().rect(-2000, -2000, STAGE_W + 4000, STAGE_H + 4000).fill({ color: 0x000000 });
    dim.alpha = 0;
    layer.addChild(dim);
    this.tw.to(dim, { alpha: 0.6 }, 150);

    const pts = fromRight ? [-50, 250, STAGE_W + 50, 175, STAGE_W + 50, 485, -50, 560] : [-50, 175, STAGE_W + 50, 250, STAGE_W + 50, 560, -50, 485];
    const band = new Container();
    const bandBg = new Graphics().poly(pts).fill({ color: el.color, alpha: 0.95 });
    const bandDark = new Graphics().poly(pts).fill({ color: 0x000000, alpha: 0.45 });
    const edge = new Graphics()
      .moveTo(pts[0], pts[1]).lineTo(pts[2], pts[3]).stroke({ width: 6, color: 0xffffff })
      .moveTo(pts[6], pts[7]).lineTo(pts[4], pts[5]).stroke({ width: 6, color: 0xffffff });
    const mask = new Graphics().poly(pts).fill({ color: 0xffffff });
    band.addChild(bandBg, bandDark);
    const inner = new Container();
    inner.mask = mask;
    band.addChild(inner, mask, edge);
    layer.addChild(band);
    band.scale.y = 0;
    band.pivot.y = 368;
    band.y = 368;
    this.tw.to(band.scale, { y: 1 }, 160, ease.outBack);

    // Đường tốc độ
    const lines: Sprite[] = [];
    for (let i = 0; i < 26; i++) {
      const s = new Sprite(this.streakTex);
      s.anchor.set(0.5);
      s.tint = i % 3 ? 0xffffff : el.color;
      s.alpha = 0.25 + Math.random() * 0.5;
      s.scale.set(1 + Math.random() * 2, 0.6 + Math.random());
      s.position.set(Math.random() * STAGE_W, 170 + Math.random() * 400);
      if (!fromRight) s.scale.x *= -1;
      inner.addChild(s);
      lines.push(s);
    }
    const stopLines = this.tw.every((dt) => {
      for (const s of lines) {
        s.x += (fromRight ? -1 : 1) * dt * 2.6;
        if (fromRight && s.x < -300) s.x = STAGE_W + 300;
        if (!fromRight && s.x > STAGE_W + 300) s.x = -300;
      }
    });

    // Chân dung lớn
    const tex = v.sprite.texture;
    const portrait = new Sprite(tex);
    const ph = 1150;
    const ps = ph / tex.height;
    portrait.scale.set(fromRight ? ps : -ps, ps);
    portrait.anchor.set(0.5, 0);
    const [fx, fy] = v.unit.hero.face;
    // Dời ảnh sao cho khuôn mặt nằm giữa dải
    const faceOffX = (fx / 100 - 0.5) * tex.width * ps * (fromRight ? 1 : -1);
    const baseY = 330 - (fy / 100) * ph;
    const restX = (fromRight ? STAGE_W * 0.68 : STAGE_W * 0.32) - faceOffX;
    portrait.position.set(restX + (fromRight ? 900 : -900), baseY);
    const shadowP = new Sprite(tex);
    shadowP.anchor.set(0.5, 0);
    shadowP.scale.copyFrom(portrait.scale);
    shadowP.tint = 0x000000;
    shadowP.alpha = 0.5;
    inner.addChild(shadowP, portrait);
    const syncShadow = this.tw.every(() => shadowP.position.set(portrait.x + (fromRight ? 26 : -26), portrait.y + 14));

    // Tên chiêu
    const nameStyle = {
      fontFamily: FONT, fontWeight: '900' as const, fontStyle: 'italic' as const, fill: 0xffffff,
      stroke: { color: 0x000000, width: 10 },
      dropShadow: { color: el.color, alpha: 1, blur: 14, distance: 0, angle: 0 },
    };
    const title = new Text({ text: `${v.unit.hero.name} · ${v.unit.hero.title}`, style: { ...nameStyle, fontSize: 24, stroke: { color: 0x000000, width: 6 } } });
    const sname = new Text({ text: skill.name, style: { ...nameStyle, fontSize: 60 } });
    const tx = fromRight ? 70 : STAGE_W - 70;
    title.anchor.set(fromRight ? 0 : 1, 1);
    sname.anchor.set(fromRight ? 0 : 1, 0);
    title.position.set(tx + (fromRight ? -600 : 600), 410);
    sname.position.set(tx + (fromRight ? -700 : 700), 412);
    layer.addChild(title, sname);

    this.screenFlash(0xffffff, 0.7, 220);
    this.tw.to(portrait, { x: restX }, 260, ease.outExpo);
    this.tw.wait(80).then(() => this.tw.to(title, { x: tx }, 260, ease.outExpo));
    await this.tw.wait(120);
    await this.tw.to(sname, { x: tx }, 260, ease.outExpo);
    // Trôi chậm
    this.tw.to(portrait, { x: restX + (fromRight ? -40 : 40) }, 850, ease.linear);
    this.tw.to(sname, { x: tx + (fromRight ? 20 : -20) }, 850, ease.linear);
    await this.tw.wait(850);
    // Thoát
    this.tw.to(portrait, { x: restX + (fromRight ? -1200 : 1200) }, 220, ease.inCubic);
    this.tw.to(sname, { alpha: 0 }, 180);
    this.tw.to(title, { alpha: 0 }, 180);
    this.tw.to(dim, { alpha: 0 }, 260);
    await this.tw.to(band.scale, { y: 0 }, 220, ease.inCubic);
    stopLines();
    syncShadow();
    layer.destroy({ children: true });
  }

  destroy() {
    this.destroyed = true;
    this.tw.clear();
    this.fx.clear();
    try {
      this.app.destroy(true, { children: true });
    } catch {
      /* app chưa init xong */
    }
  }
}
