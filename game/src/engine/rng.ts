// RNG có seed (mulberry32): cùng seed + cùng lựa chọn => cùng kết quả.
// Server sau này có thể chạy lại trận đấu để kiểm tra gian lận.
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
}
