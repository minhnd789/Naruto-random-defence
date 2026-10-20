// Logic gacha thuần (không đụng CSDL) để dễ kiểm thử
import { randomBytes } from 'node:crypto';
import { HEROES } from '../../game/src/engine/heroes';

export type Currency = 'gems' | 'scrolls';

export interface Banner {
  id: string;
  name: string;
  desc: string;
  currency: Currency;
  cost: number; // giá mỗi lượt
  rates: Record<3 | 4 | 5, number>;
  pityMax: number | null; // số lượt tối đa không ra 5★ trước khi được bảo đảm
  featured: string | null; // tướng 5★ được tăng tỉ lệ
  featuredShare: number; // khi ra 5★, tỉ lệ là tướng tăng tỉ lệ
}

export const BANNERS: Record<string, Banner> = {
  normal: {
    id: 'normal',
    name: 'Triệu Hồi Thường',
    desc: 'Dùng Cuộn Triệu Hồi. Mỗi lượt x10 chắc chắn có ít nhất một tướng 4★.',
    currency: 'scrolls',
    cost: 1,
    rates: { 5: 0.01, 4: 0.14, 3: 0.85 },
    pityMax: null,
    featured: null,
    featuredShare: 0,
  },
  premium: {
    id: 'premium',
    name: 'Triệu Hồi Cấm Thuật',
    desc: 'Dùng Ngọc Chakra. Tăng tỉ lệ Madara. Bảo hiểm: lượt thứ 120 không có 5★ chắc chắn ra Madara.',
    currency: 'gems',
    cost: 100,
    rates: { 5: 0.0125, 4: 0.1375, 3: 0.85 },
    pityMax: 120,
    featured: 'madara',
    featuredShare: 0.5,
  },
};

export interface PullResult {
  heroId: string;
  rarity: 3 | 4 | 5;
  pityHit: boolean;
  featured: boolean;
}

/** Số ngẫu nhiên [0,1) an toàn mật mã: người chơi không đoán được kết quả. */
export const secureRandom = () => randomBytes(6).readUIntBE(0, 6) / 2 ** 48;

const pool = (r: 3 | 4 | 5) => HEROES.filter((h) => h.rarity === r).map((h) => h.id);

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)];
}

/**
 * Quay `count` lượt. `pity` là số lượt liên tiếp chưa ra 5★ trước khi quay.
 * Trả về kết quả và giá trị pity mới.
 */
export function roll(banner: Banner, count: number, pity: number, rnd: () => number = secureRandom): { results: PullResult[]; pity: number } {
  const results: PullResult[] = [];
  let p = pity;
  for (let i = 0; i < count; i++) {
    p++;
    let rarity: 3 | 4 | 5;
    let pityHit = false;
    if (banner.pityMax && p >= banner.pityMax) {
      rarity = 5;
      pityHit = true;
    } else {
      const x = rnd();
      rarity = x < banner.rates[5] ? 5 : x < banner.rates[5] + banner.rates[4] ? 4 : 3;
    }
    // Bảo đảm x10: lượt cuối chưa có 4★ trở lên thì nâng lên 4★
    if (count >= 10 && i === count - 1 && rarity === 3 && !results.some((r) => r.rarity >= 4)) rarity = 4;

    let heroId: string;
    let featured = false;
    if (rarity === 5 && banner.featured && (pityHit || rnd() < banner.featuredShare)) {
      heroId = banner.featured;
      featured = true;
    } else if (rarity === 5 && banner.featured) {
      heroId = pick(pool(5).filter((id) => id !== banner.featured), rnd);
    } else {
      heroId = pick(pool(rarity), rnd);
    }
    if (rarity === 5) p = 0;
    results.push({ heroId, rarity, pityHit, featured });
  }
  return { results, pity: p };
}
