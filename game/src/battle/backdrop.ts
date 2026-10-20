// Vẽ hình nền và các texture hiệu ứng bằng Canvas 2D (không cần file ảnh ngoài)
import { Texture } from 'pixi.js';
import { Rng } from '../engine/rng';

export const STAGE_W = 1280;
export const STAGE_H = 720;
export const HORIZON = 300;

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function ridge(ctx: CanvasRenderingContext2D, rng: Rng, baseY: number, amp: number, step: number, color: string, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(0, h);
  let y = baseY;
  for (let x = 0; x <= w + step; x += step) {
    y += rng.range(-amp, amp);
    y = Math.max(baseY - amp * 4, Math.min(baseY + amp * 2, y));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Hình nền đấu trường lúc hoàng hôn, vẽ ở độ phân giải x1.5. */
export function makeBackdrop(): Texture {
  const S = 1.5;
  const W = STAGE_W * S, H = STAGE_H * S, HZ = HORIZON * S;
  const [c, ctx] = canvas(W, H);
  const rng = new Rng(7);

  // Bầu trời
  const sky = ctx.createLinearGradient(0, 0, 0, HZ);
  sky.addColorStop(0, '#070a24');
  sky.addColorStop(0.45, '#2b1b4f');
  sky.addColorStop(0.8, '#8a3b56');
  sky.addColorStop(1, '#f08a4b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HZ + 2);

  // Sao
  for (let i = 0; i < 160; i++) {
    const x = rng.range(0, W), y = rng.range(0, HZ * 0.55);
    ctx.globalAlpha = rng.range(0.2, 0.9) * (1 - y / (HZ * 0.6));
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, rng.range(1, 2.6), rng.range(1, 2.6));
  }
  ctx.globalAlpha = 1;

  // Mặt trời lặn
  const sx = W * 0.5, sy = HZ * 0.92;
  const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * 0.45);
  sun.addColorStop(0, 'rgba(255,226,150,1)');
  sun.addColorStop(0.06, 'rgba(255,190,110,0.95)');
  sun.addColorStop(0.2, 'rgba(255,120,80,0.35)');
  sun.addColorStop(1, 'rgba(255,90,80,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, HZ + 2);

  // Mây mảnh
  for (let i = 0; i < 14; i++) {
    const y = rng.range(HZ * 0.25, HZ * 0.85);
    const x = rng.range(-200, W);
    const w = rng.range(200, 600) * S;
    ctx.fillStyle = `rgba(${y > HZ * 0.6 ? '255,170,140' : '150,110,190'},${rng.range(0.08, 0.22)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, w / 2, rng.range(4, 12) * S, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dãy núi nhiều lớp
  ridge(ctx, rng, HZ * 0.72, 9 * S, 40 * S, '#5b2f5a', W, H);
  ridge(ctx, rng, HZ * 0.82, 7 * S, 30 * S, '#3f2148', W, H);
  // Bóng mái nhà làng ninja
  ctx.fillStyle = '#29163a';
  for (let i = 0; i < 18; i++) {
    const x = rng.range(0, W), bw = rng.range(40, 110) * S, bh = rng.range(14, 40) * S;
    const by = HZ * 0.97;
    ctx.fillRect(x, by - bh, bw, bh + 4);
    ctx.beginPath();
    ctx.moveTo(x - 10 * S, by - bh);
    ctx.quadraticCurveTo(x + bw / 2, by - bh - 22 * S, x + bw + 10 * S, by - bh);
    ctx.fill();
  }
  // Tháp nước đỏ
  ctx.fillStyle = '#331a40';
  ctx.fillRect(W * 0.78, HZ * 0.62, 18 * S, HZ * 0.36);
  ctx.beginPath();
  ctx.ellipse(W * 0.78 + 9 * S, HZ * 0.62, 34 * S, 22 * S, 0, 0, Math.PI * 2);
  ctx.fill();
  ridge(ctx, rng, HZ * 0.98, 3 * S, 22 * S, '#1e1230', W, H);

  // Mặt đất
  const ground = ctx.createLinearGradient(0, HZ, 0, H);
  ground.addColorStop(0, '#3a2433');
  ground.addColorStop(0.35, '#2a1c27');
  ground.addColorStop(1, '#120c12');
  ctx.fillStyle = ground;
  ctx.fillRect(0, HZ, W, H - HZ);

  // Ánh hoàng hôn phản chiếu trên đất
  const glow = ctx.createRadialGradient(W / 2, HZ, 0, W / 2, HZ, W * 0.6);
  glow.addColorStop(0, 'rgba(255,150,90,0.35)');
  glow.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, HZ, W, H - HZ);

  // Đường phối cảnh
  ctx.strokeStyle = 'rgba(255,200,170,0.05)';
  ctx.lineWidth = 2 * S;
  for (let i = -12; i <= 12; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 30 * S, HZ);
    ctx.lineTo(W / 2 + i * 260 * S, H);
    ctx.stroke();
  }

  // Sàn đấu đá hình elip
  const cx = W / 2, cy = 520 * S;
  const plat = ctx.createRadialGradient(cx, cy - 40 * S, 20, cx, cy, 620 * S);
  plat.addColorStop(0, 'rgba(120,90,100,0.55)');
  plat.addColorStop(0.7, 'rgba(70,50,62,0.4)');
  plat.addColorStop(1, 'rgba(40,28,36,0)');
  ctx.fillStyle = plat;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 600 * S, 190 * S, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [rx, a] of [[560, 0.18], [430, 0.12], [180, 0.16]] as const) {
    ctx.strokeStyle = `rgba(255,200,160,${a})`;
    ctx.lineWidth = 2 * S;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * S, rx * 0.315 * S, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Vết nứt
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.5 * S;
  for (let i = 0; i < 10; i++) {
    let x = rng.range(W * 0.15, W * 0.85), y = rng.range(HZ + 60 * S, H - 40 * S);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += rng.range(-30, 30) * S;
      y += rng.range(-6, 6) * S;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Đá và cỏ ở rìa
  for (let i = 0; i < 40; i++) {
    const edge = rng.chance(0.5) ? rng.range(0, W * 0.12) : rng.range(W * 0.88, W);
    const y = rng.range(HZ + 10 * S, H);
    const r = rng.range(4, 16) * S * (y / H);
    ctx.fillStyle = `rgba(20,12,18,${rng.range(0.5, 0.9)})`;
    ctx.beginPath();
    ctx.ellipse(edge, y, r * 1.6, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vignette
  const vig = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  return Texture.from(c);
}

/** Đốm sáng tròn mềm, dùng cho hạt hiệu ứng (tint theo màu hệ). */
export function makeGlowTexture(): Texture {
  const [c, ctx] = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return Texture.from(c);
}

/** Vệt sáng dài, dùng cho đường tốc độ và vệt chém. */
export function makeStreakTexture(): Texture {
  const [c, ctx] = canvas(256, 16);
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 6, 256, 4);
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, 3, 256, 10);
  return Texture.from(c);
}
