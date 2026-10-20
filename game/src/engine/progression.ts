// Công thức nâng cấp ninja: dùng chung cho client (hiển thị) và server (tính thật)
import { ELEMENT_INFO, heroById } from './heroes';
import { Element, HeroDef, Stats } from './types';

export interface HeroProgress {
  level: number;
  stars: number;
  awaken: number; // 0..MAX_AWAKEN
}
export interface UnitSetup extends HeroProgress {
  heroId: string;
}

export const MAX_STARS = 6;
export const MAX_AWAKEN = 3;
export const EXP_PER_BOOK = 1000;
export const COINS_PER_BOOK = 300;

export const maxLevel = (stars: number) => stars * 10;
/** Kinh nghiệm cần để lên từ cấp L lên L+1. */
export const expToNext = (level: number) => 200 + 60 * level;

/** Số sách cần để đi từ (level, exp) lên cấp tối đa của số sao hiện tại. */
export function booksToMax(p: HeroProgress & { exp: number }): number {
  let need = -p.exp;
  for (let l = p.level; l < maxLevel(p.stars); l++) need += expToNext(l);
  return Math.max(0, Math.ceil(need / EXP_PER_BOOK));
}

/** Cộng kinh nghiệm, trả về cấp và exp mới (không vượt cấp tối đa). */
export function applyExp(p: HeroProgress & { exp: number }, gained: number): { level: number; exp: number } {
  let level = p.level;
  let exp = p.exp + gained;
  const cap = maxLevel(p.stars);
  while (level < cap && exp >= expToNext(level)) {
    exp -= expToNext(level);
    level++;
  }
  if (level >= cap) exp = 0;
  return { level, exp };
}

/** Nâng sao: cần đạt cấp tối đa, đủ mảnh (mảnh riêng + Linh Hồn Thạch thay thế) và Xu. */
export const STAR_COST: Record<number, { shards: number; coins: number }> = {
  3: { shards: 3, coins: 10000 },
  4: { shards: 5, coins: 30000 },
  5: { shards: 8, coins: 60000 },
};

/** Thức tỉnh theo cấp: cần cấp tối thiểu, Ấn Chú cùng hệ và Xu. */
export const AWAKEN_COST: Record<number, { level: number; runes: number; coins: number }> = {
  1: { level: 15, runes: 4, coins: 5000 },
  2: { level: 25, runes: 10, coins: 15000 },
  3: { level: 35, runes: 20, coins: 30000 },
};

export const runeId = (el: Element) => `rune_${el}`;

export const ITEMS: Record<string, { name: string; icon: string; desc: string; color: string }> = {
  exp_book: { name: 'Cuộn Kinh Nghiệm', icon: '経', desc: `+${EXP_PER_BOOK.toLocaleString('vi-VN')} kinh nghiệm cho một ninja`, color: '#5fe39a' },
  soul_stone: { name: 'Linh Hồn Thạch', icon: '魂', desc: 'Thay thế một mảnh linh hồn của bất kỳ ninja nào khi nâng sao', color: '#c79bff' },
  ...Object.fromEntries(
    (Object.keys(ELEMENT_INFO) as Element[]).map((el) => [
      runeId(el),
      { name: `Ấn Chú ${ELEMENT_INFO[el].name}`, icon: ELEMENT_INFO[el].icon, desc: `Dùng để thức tỉnh ninja hệ ${ELEMENT_INFO[el].name}`, color: ELEMENT_INFO[el].css },
    ]),
  ),
};

/** Chỉ số thật sau khi tính cấp, sao và thức tỉnh. */
export function computeStats(hero: HeroDef, p: HeroProgress): Stats {
  const b = hero.stats;
  const lv = 1 + (p.level - 1) * 0.03;
  const st = 1 + 0.1 * (p.stars - hero.rarity);
  const aw = 1 + 0.06 * p.awaken;
  // Phòng thủ tăng chậm theo cấp để thời gian hạ gục không bị kéo dài ở cấp cao
  const defLv = 1 + (p.level - 1) * 0.005;
  return {
    ...b,
    hp: Math.round(b.hp * lv * st * aw),
    atk: Math.round(b.atk * lv * st * aw),
    def: Math.round(b.def * defLv * st * aw),
    spd: b.spd + (p.stars - hero.rarity) + 2 * p.awaken,
    crit: Math.min(1, b.crit + (p.awaken >= 3 ? 0.05 : 0)),
  };
}

export function withProgress(hero: HeroDef, p: HeroProgress): HeroDef {
  return { ...hero, stats: computeStats(hero, p) };
}

export const buildTeam = (setups: UnitSetup[]): HeroDef[] => setups.map((s) => withProgress(heroById(s.heroId), s));

/** Lực chiến ước tính để hiển thị. */
export function power(hero: HeroDef, p: HeroProgress): number {
  const s = computeStats(hero, p);
  return Math.round(s.hp * 0.1 + s.atk * 1.2 + s.def * 0.8 + s.spd * 8 + s.crit * 800);
}
