// Phát hiệu ứng spritesheet (ảnh do tools/build_assets.py tạo trong public/fx)
import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';

export interface FxMeta {
  cols: number;
  rows: number;
  frames: number;
  fps: number;
  loop: boolean;
  blend: 'add' | 'normal';
}

export interface FxOptions {
  scale?: number;
  rotation?: number;
  flipX?: boolean;
  alpha?: number;
  /** Hiệu ứng loop: chạy `life` ms rồi mờ dần (mặc định 1000). */
  life?: number;
  /** Hiệu ứng loop chạy tới khi code gọi stop() (khiên, vòng choáng, vật bay, quả cầu trên tay). */
  persist?: boolean;
  fps?: number;
  /** Điểm neo theo chiều dọc (0.5 = giữa, 1 = đáy ô nằm ở y). */
  anchorY?: number;
  tint?: number;
}

export class FxInstance {
  sprite: Sprite;
  private t = 0;
  private fading = -1;
  private fadeTotal = 180;
  done = false;
  private frameHooks: { frame: number; fn: () => void }[] = [];
  private doneHooks: (() => void)[] = [];

  constructor(
    private frames: Texture[],
    public meta: FxMeta,
    private opts: FxOptions,
  ) {
    this.sprite = new Sprite(frames[0]);
    this.sprite.anchor.set(0.5, opts.anchorY ?? 0.5);
    const s = opts.scale ?? 1;
    this.sprite.scale.set(opts.flipX ? -s : s, s);
    this.sprite.rotation = opts.rotation ?? 0;
    this.sprite.alpha = opts.alpha ?? 1;
    if (opts.tint !== undefined) this.sprite.tint = opts.tint;
    this.sprite.blendMode = meta.blend === 'add' ? 'add' : 'normal';
  }

  get fps() {
    return this.opts.fps ?? this.meta.fps;
  }
  /** Thời lượng một lượt phát (ms). */
  get duration() {
    return (this.meta.frames / this.fps) * 1000;
  }

  /** Gọi fn khi tới khung `frame` (0-based); dùng để khớp lúc đòn đánh trúng. */
  onFrame(frame: number, fn: () => void) {
    this.frameHooks.push({ frame, fn });
    return this;
  }
  onDone(fn: () => void) {
    if (this.done) fn();
    else this.doneHooks.push(fn);
    return this;
  }
  /** Promise hoàn thành khi tới khung `frame` (hoặc khi kết thúc). */
  at(frame: number): Promise<void> {
    return new Promise((r) => {
      this.onFrame(frame, r);
      this.onDone(r);
    });
  }
  finished(): Promise<void> {
    return new Promise((r) => this.onDone(r));
  }

  /** Dừng hiệu ứng lặp: mờ dần trong `ms`. */
  stop(ms = 180) {
    if (this.done || this.fading >= 0) return;
    if (ms <= 0) return this.finish();
    this.fading = this.fadeTotal = ms;
  }

  update(dt: number) {
    if (this.done) return;
    this.t += dt;
    const raw = Math.floor((this.t / 1000) * this.fps);
    let idx: number;
    if (this.meta.loop) {
      idx = raw % this.meta.frames;
      if (this.opts.life !== undefined && this.t >= this.opts.life) this.stop();
    } else {
      idx = Math.min(raw, this.meta.frames - 1);
      if (raw >= this.meta.frames) return this.finish();
    }
    this.sprite.texture = this.frames[idx];
    if (this.frameHooks.length) {
      const due = this.frameHooks.filter((h) => raw >= h.frame);
      this.frameHooks = this.frameHooks.filter((h) => raw < h.frame);
      for (const h of due) h.fn();
    }
    if (this.fading >= 0) {
      this.fading -= dt;
      this.sprite.alpha = Math.max(0, (this.opts.alpha ?? 1) * (this.fading / this.fadeTotal));
      if (this.fading <= 0) this.finish();
    }
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    for (const h of this.frameHooks) h.fn();
    this.frameHooks = [];
    this.sprite.destroy();
    for (const fn of this.doneHooks) fn();
    this.doneHooks = [];
  }
}

/** Nạp manifest và cắt spritesheet thành khung; chỉ tải những hiệu ứng được yêu cầu. */
export class FxLibrary {
  manifest: Record<string, FxMeta> = {};
  cell = 320;
  private frames = new Map<string, Texture[]>();
  private ready: Promise<void> | null = null;

  init(): Promise<void> {
    this.ready ??= fetch('/fx/manifest.json')
      .then((r) => (r.ok ? r.json() : { fx: {} }))
      .then((m) => {
        this.manifest = m.fx ?? {};
        this.cell = m.cell ?? this.cell;
      })
      .catch(() => {
        this.manifest = {};
      });
    return this.ready;
  }

  async load(names: string[]) {
    await this.init();
    const want = [...new Set(names)].filter((n) => this.manifest[n] && !this.frames.has(n));
    if (!want.length) return;
    const urls = want.map((n) => `/fx/${n}.webp`);
    // Thiếu file nào thì bỏ qua file đó, cảnh chiến đấu dùng hiệu ứng vẽ bằng code thay thế
    const loaded = await Promise.all(urls.map((u) => Assets.load<Texture>(u).catch(() => null)));
    want.forEach((n, i) => {
      const tex = loaded[i];
      if (!tex) return;
      const m = this.manifest[n];
      const c = this.cell;
      const list: Texture[] = [];
      for (let f = 0; f < m.frames; f++) {
        const x = (f % m.cols) * c;
        const y = Math.floor(f / m.cols) * c;
        list.push(new Texture({ source: tex.source, frame: new Rectangle(x, y, c, c) }));
      }
      this.frames.set(n, list);
    });
  }

  has(name: string | undefined): name is string {
    return !!name && this.frames.has(name);
  }

  create(name: string, opts: FxOptions = {}): FxInstance | null {
    const frames = this.frames.get(name);
    if (!frames) return null;
    return new FxInstance(frames, this.manifest[name], opts);
  }
}

/** Quản lý các hiệu ứng đang phát trong một cảnh. */
export class FxPlayer {
  private list: FxInstance[] = [];
  constructor(public lib: FxLibrary) {}

  play(name: string | undefined, layer: Container, x: number, y: number, opts: FxOptions = {}): FxInstance | null {
    if (!name) return null;
    const meta = this.lib.manifest[name];
    // Loop dùng làm vụ nổ / tụ chiêu phải tự tắt, nếu không sẽ đứng mãi trên sân
    if (meta?.loop && !opts.persist && opts.life === undefined) opts = { ...opts, life: 1000 };
    const fx = this.lib.create(name, opts);
    if (!fx) return null;
    fx.sprite.position.set(x, y);
    layer.addChild(fx.sprite);
    this.list.push(fx);
    return fx;
  }

  update(dt: number) {
    for (const fx of this.list) fx.update(dt);
    this.list = this.list.filter((f) => !f.done);
  }

  clear() {
    for (const fx of this.list) fx.stop(0);
    this.list = [];
  }
}

export const fxLibrary = new FxLibrary();
