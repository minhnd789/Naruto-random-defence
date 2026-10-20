// Dữ liệu vượt ải theo chương và bí cảnh nguyên liệu (dùng chung client + server)
import { ELEMENT_INFO, HEROES, heroById } from './heroes';
import { MAX_AWAKEN, MAX_STARS, UnitSetup, runeId } from './progression';
import { Element } from './types';

export interface Reward {
  coins: number;
  items: Record<string, number>;
  gems?: number;
}

export interface StageDef {
  id: string; // ví dụ "1-3"
  chapter: number;
  index: number;
  name: string;
  boss: boolean;
  level: number;
  stamina: number;
  enemies: UnitSetup[];
}

export interface ChapterDef {
  id: number;
  name: string;
  desc: string;
  stages: StageDef[];
}

/** Sao và thức tỉnh của địch tăng theo cấp, giống tiến trình của người chơi. */
export function enemySetup(heroId: string, level: number, bonusStars = 0): UnitSetup {
  const h = heroById(heroId);
  const stars = Math.min(MAX_STARS, Math.max(h.rarity, Math.ceil(level / 10)) + bonusStars);
  return { heroId, level: Math.min(level, stars * 10), stars, awaken: Math.min(MAX_AWAKEN, Math.floor(level / 15)) };
}

const CHAPTER_DATA: { name: string; desc: string; stamina: number; stages: [string, number, string[]][] }[] = [
  {
    name: 'Làng Lá Nổi Gió',
    desc: 'Những bài kiểm tra đầu tiên của các ninja trẻ.',
    stamina: 4,
    stages: [
      ['Sân Tập Học Viện', 1, ['choji', 'kiba']],
      ['Khu Rừng Phía Bắc', 2, ['choji', 'kiba', 'tenten']],
      ['Truy Đuổi Trong Rừng', 3, ['choji', 'shino', 'ino', 'tenten']],
      ['Cổng Làng Lá', 5, ['lee', 'kiba', 'shikamaru', 'ino']],
      ['Vòng Sơ Loại', 7, ['choji', 'lee', 'temari', 'shikamaru', 'ino']],
      ['Cát Đỏ Sa Mạc', 9, ['gaara', 'choji', 'temari', 'shikamaru', 'ino']],
    ],
  },
  {
    name: 'Kỳ Thi Chunin',
    desc: 'Đấu trường của những thiên tài thế hệ mới.',
    stamina: 6,
    stages: [
      ['Rừng Tử Thần', 11, ['kisame', 'kiba', 'tenten', 'shino', 'ino']],
      ['Tòa Tháp Trung Tâm', 13, ['choji', 'hinata', 'lee', 'temari', 'shikamaru']],
      ['Vòng Chung Kết', 15, ['gaara', 'kakashi', 'sakura', 'kiba', 'tenten']],
      ['Cuộc Xâm Lược Làng Lá', 17, ['kisame', 'hinata', 'temari', 'shino', 'shikamaru']],
      ['Mái Nhà Hokage', 19, ['gaara', 'kisame', 'kakashi', 'sakura', 'hinata']],
      ['Người Mang Sharingan', 22, ['kisame', 'gaara', 'itachi', 'sakura', 'hinata']],
    ],
  },
  {
    name: 'Akatsuki Trỗi Dậy',
    desc: 'Tổ chức áo mây đỏ bắt đầu săn lùng Vĩ Thú.',
    stamina: 8,
    stages: [
      ['Quán Trọ Ven Đường', 24, ['kisame', 'choji', 'itachi', 'temari', 'ino']],
      ['Thung Lũng Tận Cùng', 26, ['gaara', 'kisame', 'kakashi', 'sasuke_ems', 'sakura']],
      ['Làng Mưa', 28, ['kisame', 'pain', 'itachi', 'hinata', 'sakura']],
      ['Hang Ổ Uchiha', 31, ['gaara', 'kisame', 'sasuke_ems', 'itachi', 'tsunade']],
      ['Thần La Thiên Chinh', 33, ['kisame', 'pain', 'madara', 'itachi', 'sakura']],
      ['Thủ Lĩnh Akatsuki', 36, ['kisame', 'pain', 'itachi', 'madara', 'sasuke_ems']],
    ],
  },
  {
    name: 'Đại Chiến Ninja',
    desc: 'Liên quân ninja đối mặt với huyền thoại Uchiha.',
    stamina: 10,
    stages: [
      ['Tổng Hành Dinh Liên Quân', 38, ['gaara', 'tsunade', 'naruto_sage', 'minato', 'hinata']],
      ['Chiến Trường Sa Mạc', 40, ['kisame', 'pain', 'madara', 'itachi', 'tsunade']],
      ['Bão Cát Phong Ấn', 43, ['gaara', 'kakashi', 'naruto_sage', 'sasuke_ems', 'sakura']],
      ['Tia Chớp Vàng Trở Lại', 45, ['kisame', 'madara', 'minato', 'pain', 'tsunade']],
      ['Hợp Lực Cuối Cùng', 47, ['gaara', 'naruto_sage', 'sasuke_ems', 'minato', 'tsunade']],
      ['Huyền Thoại Uchiha', 50, ['kisame', 'pain', 'itachi', 'madara', 'minato']],
    ],
  },
];

export const CHAPTERS: ChapterDef[] = CHAPTER_DATA.map((c, ci) => ({
  id: ci + 1,
  name: c.name,
  desc: c.desc,
  stages: c.stages.map(([name, level, heroes], si) => {
    const boss = si === c.stages.length - 1;
    return {
      id: `${ci + 1}-${si + 1}`,
      chapter: ci + 1,
      index: si + 1,
      name,
      boss,
      level,
      stamina: c.stamina,
      // Boss của chương mạnh hơn một sao
      enemies: heroes.map((id, k) => enemySetup(id, level, boss && k === heroes.length - 2 ? 1 : 0)),
    };
  }),
}));

export const ALL_STAGES: StageDef[] = CHAPTERS.flatMap((c) => c.stages);
export const stageById = (id: string) => ALL_STAGES.find((s) => s.id === id);
/** Ải trước đó (phải qua mới mở ải này). */
export const prevStageId = (id: string): string | null => {
  const i = ALL_STAGES.findIndex((s) => s.id === id);
  return i > 0 ? ALL_STAGES[i - 1].id : null;
};

/** Phần thưởng cơ bản mỗi lần qua ải (drop ngẫu nhiên do server tính thêm). */
export function stageReward(s: StageDef): Reward {
  return { coins: 300 + s.level * 60, items: { exp_book: 1 + Math.floor(s.level / 12) } };
}
export function stageFirstClear(s: StageDef): Reward {
  return { coins: 0, gems: s.boss ? 150 : 50, items: s.boss ? { exp_book: 5, soul_stone: 1 } : {} };
}

// ---------- Bí cảnh ----------
export type DungeonId = 'exp' | 'rune' | 'soul';
export const DUNGEON_TIERS = 5;
const TIER_LEVEL = [8, 18, 28, 40, 52];

export const DUNGEONS: Record<DungeonId, { name: string; desc: string; icon: string; color: string }> = {
  exp: { name: 'Rừng Tử Thần', desc: 'Rơi Cuộn Kinh Nghiệm và Xu để lên cấp ninja.', icon: '経', color: '#5fe39a' },
  rune: { name: 'Đền Ấn Chú', desc: 'Chọn một hệ, nhận Ấn Chú hệ đó để thức tỉnh ninja.', icon: '印', color: '#ffb84a' },
  soul: { name: 'Đền Linh Hồn', desc: 'Kẻ địch rất mạnh. Rơi Linh Hồn Thạch để nâng sao.', icon: '魂', color: '#c79bff' },
};

export const dungeonLevel = (tier: number) => TIER_LEVEL[tier - 1];
export const dungeonStamina = (tier: number) => 7 + tier;

export function dungeonEnemies(id: DungeonId, tier: number, element?: Element): UnitSetup[] {
  const level = dungeonLevel(tier);
  const count = tier === 1 ? 3 : tier === 2 ? 4 : 5;
  let pool: string[];
  if (id === 'exp') pool = ['choji', 'kisame', 'kiba', 'gaara', 'lee'];
  else if (id === 'soul') pool = ['madara', 'pain', 'itachi', 'tsunade', 'minato'];
  else {
    const same = HEROES.filter((h) => h.element === element).map((h) => h.id);
    const others = HEROES.filter((h) => h.element !== element && h.rarity >= 4).map((h) => h.id);
    pool = [...same, ...others];
  }
  // Đền Linh Hồn: địch mạnh hơn một bậc
  return pool.slice(0, count).map((hid) => enemySetup(hid, id === 'soul' ? level + 4 : level));
}

/** Phần thưởng cơ bản của bí cảnh (server cộng thêm phần ngẫu nhiên). */
export function dungeonReward(id: DungeonId, tier: number, element?: Element): Reward {
  if (id === 'exp') return { coins: 800 * tier, items: { exp_book: [4, 7, 10, 14, 20][tier - 1] } };
  if (id === 'rune') return { coins: 500 * tier, items: { [runeId(element!)]: [2, 3, 5, 7, 10][tier - 1] } };
  return { coins: 1000 * tier, items: { soul_stone: [1, 1, 2, 2, 3][tier - 1] } };
}

export const ELEMENTS = Object.keys(ELEMENT_INFO) as Element[];
