// Hệ thống tween nhỏ chạy theo ticker của Pixi, hỗ trợ nhân tốc độ (x1/x2/x3)

export type Ease = (t: number) => number;
export const ease = {
  linear: (t: number) => t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inQuad: (t: number) => t * t,
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inCubic: (t: number) => t * t * t,
  outBack: (t: number) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
};

interface Job {
  elapsed: number;
  duration: number;
  step: (k: number) => void;
  resolve: () => void;
  ease: Ease;
}

type Obj = Record<string, any>;

export class Tweener {
  speed = 1;
  private jobs: Job[] = [];
  private updaters = new Set<(dt: number) => void>();

  update(dtMs: number) {
    const dt = dtMs * this.speed;
    for (const u of this.updaters) u(dt);
    const done: Job[] = [];
    for (const j of this.jobs) {
      j.elapsed += dt;
      const t = Math.min(1, j.elapsed / j.duration);
      j.step(j.ease(t));
      if (t >= 1) done.push(j);
    }
    if (done.length) {
      this.jobs = this.jobs.filter((j) => !done.includes(j));
      for (const j of done) j.resolve();
    }
  }

  /** Tween các thuộc tính số của obj tới giá trị đích. */
  to(obj: Obj, props: Obj, duration: number, e: Ease = ease.outQuad): Promise<void> {
    const from: Obj = {};
    for (const k of Object.keys(props)) from[k] = obj[k];
    return this.run(duration, (k) => {
      if ((obj as any).destroyed) return;
      for (const key of Object.keys(props)) obj[key] = from[key] + (props[key] - from[key]) * k;
    }, e);
  }

  run(duration: number, step: (k: number) => void, e: Ease = ease.linear): Promise<void> {
    return new Promise((resolve) => {
      if (duration <= 0) {
        step(1);
        resolve();
        return;
      }
      this.jobs.push({ elapsed: 0, duration, step, resolve, ease: e });
    });
  }

  wait(ms: number): Promise<void> {
    return this.run(ms, () => {});
  }

  /** Cập nhật liên tục mỗi frame (thời gian đã nhân tốc độ). Trả về hàm huỷ. */
  every(fn: (dt: number) => void): () => void {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  clear() {
    for (const j of this.jobs) j.resolve();
    this.jobs = [];
    this.updaters.clear();
  }
}
