// Ảnh tư thế nhân vật (do tools/build_assets.py tạo trong public/poses)
import { Assets, Texture } from 'pixi.js';

export type Pose = 'dash' | 'attack' | 'cast' | 'hit';
export const POSES: Pose[] = ['dash', 'attack', 'cast', 'hit'];

interface PoseManifest {
  feet: number; // vạch chân, tỉ lệ chiều cao ảnh
  stand: number; // chiều cao khi đứng thẳng, tỉ lệ chiều cao ảnh
  heroes: Record<string, string[]>;
}

class PoseLibrary {
  feet = 0.96;
  stand = 0.8;
  private heroes: Record<string, string[]> = {};
  private ready: Promise<void> | null = null;

  init() {
    this.ready ??= fetch('/poses/manifest.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((m: PoseManifest | null) => {
        if (!m) return;
        this.feet = m.feet;
        this.stand = m.stand;
        this.heroes = m.heroes ?? {};
      })
      .catch(() => {});
    return this.ready;
  }

  /** Tải ảnh tư thế của các ninja trong trận; ninja nào chưa có ảnh thì trả về rỗng. */
  async load(heroIds: string[]): Promise<Map<string, Partial<Record<Pose, Texture>>>> {
    await this.init();
    const out = new Map<string, Partial<Record<Pose, Texture>>>();
    await Promise.all(
      [...new Set(heroIds)].map(async (id) => {
        const list = (this.heroes[id] ?? []).filter((p): p is Pose => POSES.includes(p as Pose));
        const entries = await Promise.all(
          list.map(async (p) => [p, await Assets.load<Texture>(`/poses/${id}/${p}.webp`).catch(() => null)] as const),
        );
        const map: Partial<Record<Pose, Texture>> = {};
        for (const [p, tex] of entries) if (tex) map[p] = tex;
        out.set(id, map);
      }),
    );
    return out;
  }
}

export const poseLibrary = new PoseLibrary();

/** Khi chưa có ảnh tư thế: nghiêng thân ảnh gốc để giả tư thế (radian, dương = ngả về phía trước). */
export const FAKE_LEAN: Record<Pose | 'idle', number> = {
  idle: 0,
  dash: 0.17,
  attack: 0.24,
  cast: -0.05,
  hit: -0.2,
};
