// Trang bị: 8 ô, 6 phẩm chất, chỉ số chính + chỉ số phụ (dùng chung client + server)
import { Stats } from './types';

export type GearSlot = 'weapon' | 'helmet' | 'armor' | 'pants' | 'gloves' | 'boots' | 'headband' | 'artifact';
export type GearStat = 'atk' | 'hp' | 'def' | 'atkPct' | 'hpPct' | 'defPct' | 'spd' | 'crit' | 'critDmg' | 'eff' | 'res';

export const GEAR_SLOTS: GearSlot[] = ['weapon', 'helmet', 'armor', 'pants', 'gloves', 'boots', 'headband', 'artifact'];

export const SLOT_INFO: Record<GearSlot, { name: string; icon: string; main: GearStat[] }> = {
  weapon: { name: 'Vũ khí', icon: '刀', main: ['atk'] },
  helmet: { name: 'Mũ', icon: '冠', main: ['hp'] },
  armor: { name: 'Áo', icon: '衣', main: ['def'] },
  pants: { name: 'Quần', icon: '袴', main: ['hpPct'] },
  gloves: { name: 'Găng tay', icon: '手', main: ['crit'] },
  boots: { name: 'Giày', icon: '靴', main: ['spd'] },
  headband: { name: 'Băng đô', icon: '額', main: ['atkPct'] },
  artifact: { name: 'Pháp khí', icon: '宝', main: ['atkPct', 'hpPct'] },
};

export const RARITIES = [
  { id: 0, name: 'Thường', color: '#a0a4aa', subs: 0, mult: 1 },
  { id: 1, name: 'Tinh Anh', color: '#4cc46a', subs: 1, mult: 1.15 },
  { id: 2, name: 'Hiếm', color: '#3d8bff', subs: 2, mult: 1.3 },
  { id: 3, name: 'Sử Thi', color: '#ffcf3a', subs: 3, mult: 1.5 },
  { id: 4, name: 'Huyền Thoại', color: '#ff4a4a', subs: 4, mult: 1.75 },
  { id: 5, name: 'Thần Thoại', color: 'rainbow', subs: 4, mult: 2.1 },
] as const;
export type Rarity = 0 | 1 | 2 | 3 | 4 | 5;

export const STAT_INFO: Record<GearStat, { name: string; pct: boolean }> = {
  atk: { name: 'Công', pct: false },
  hp: { name: 'Máu', pct: false },
  def: { name: 'Thủ', pct: false },
  atkPct: { name: 'Công', pct: true },
  hpPct: { name: 'Máu', pct: true },
  defPct: { name: 'Thủ', pct: true },
  spd: { name: 'Tốc độ', pct: false },
  crit: { name: 'Chí mạng', pct: true },
  critDmg: { name: 'ST chí mạng', pct: true },
  eff: { name: 'Hiệu lực', pct: true },
  res: { name: 'Kháng', pct: true },
};

/** Giá trị chỉ số chính ở cấp đồ 1, phẩm chất Thường (phần trăm ghi dạng 0.05 = 5%). */
const MAIN_BASE: Record<GearStat, number> = {
  atk: 60, hp: 400, def: 40, atkPct: 0.05, hpPct: 0.05, defPct: 0.05, spd: 3, crit: 0.03, critDmg: 0.05, eff: 0.04, res: 0.04,
};
/** Khoảng giá trị một dòng chỉ số phụ ở cấp 1 (nhân thêm theo cấp đồ và phẩm chất). */
const SUB_RANGE: Record<GearStat, [number, number]> = {
  atk: [15, 30], hp: [100, 200], def: [10, 20], atkPct: [0.02, 0.04], hpPct: [0.02, 0.04], defPct: [0.02, 0.04],
  spd: [1, 3], crit: [0.01, 0.03], critDmg: [0.02, 0.05], eff: [0.02, 0.04], res: [0.02, 0.04],
};
const SUB_POOL: GearStat[] = ['atk', 'hp', 'def', 'atkPct', 'hpPct', 'defPct', 'spd', 'crit', 'critDmg', 'eff', 'res'];

export interface StatLine {
  stat: GearStat;
  value: number;
}
export interface GearItem {
  id: number;
  slot: GearSlot;
  rarity: Rarity;
  ilvl: number; // cấp đồ
  main: StatLine[];
  subs: StatLine[];
  heroId: string | null; // ninja đang mặc
}

/** Tổng chỉ số cộng thêm từ trang bị (đưa vào UnitSetup để server xác thực trận). */
export type GearBonus = Partial<Record<GearStat, number>>;

const levelMult = (ilvl: number) => 1 + (ilvl - 1) * 0.045;
/** Chỉ số phần trăm tăng chậm hơn theo cấp đồ để không quá mạnh ở cấp cao. */
const pctLevelMult = (ilvl: number) => 1 + (ilvl - 1) * 0.015;

function roundStat(stat: GearStat, v: number) {
  return STAT_INFO[stat].pct ? Math.round(v * 1000) / 1000 : Math.round(v);
}

export function mainValue(stat: GearStat, ilvl: number, rarity: Rarity) {
  const lv = STAT_INFO[stat].pct ? pctLevelMult(ilvl) : levelMult(ilvl);
  return roundStat(stat, MAIN_BASE[stat] * lv * RARITIES[rarity].mult);
}

/** Tạo một món đồ (rnd trả về số trong [0,1)). */
export function rollGear(rnd: () => number, slot: GearSlot, rarity: Rarity, ilvl: number): Omit<GearItem, 'id' | 'heroId'> {
  const main = SLOT_INFO[slot].main.map((stat) => ({ stat, value: mainValue(stat, ilvl, rarity) }));
  const taken = new Set(main.map((m) => m.stat));
  const subs: StatLine[] = [];
  const quality = rarity >= 5 ? 0.6 : 0; // Thần Thoại: chỉ số phụ luôn ở nửa trên
  while (subs.length < RARITIES[rarity].subs) {
    const stat = SUB_POOL[Math.floor(rnd() * SUB_POOL.length)];
    if (taken.has(stat)) continue;
    taken.add(stat);
    const [lo, hi] = SUB_RANGE[stat];
    const lv = STAT_INFO[stat].pct ? pctLevelMult(ilvl) : levelMult(ilvl);
    const r = quality + rnd() * (1 - quality);
    subs.push({ stat, value: roundStat(stat, (lo + (hi - lo) * r) * lv) });
  }
  return { slot, rarity, ilvl, main, subs };
}

/** Phẩm chất rơi ra: trọng số theo mốc (càng về sau và đánh trùm càng dễ ra đồ xịn). */
export function rollRarity(rnd: () => number, bonus = 0): Rarity {
  const w = [45, 30, 16 + bonus * 4, 7 + bonus * 3, 1.8 + bonus * 1.2, 0.2 + bonus * 0.3];
  const total = w.reduce((a, b) => a + b, 0);
  let x = rnd() * total;
  for (let i = 0; i < w.length; i++) {
    if ((x -= w[i]) < 0) return i as Rarity;
  }
  return 0;
}

/** Ô trang bị rơi ra: Pháp khí hiếm hơn các ô khác (1/4 trọng số). */
export function rollSlot(rnd: () => number): GearSlot {
  const w = GEAR_SLOTS.map((s) => (s === 'artifact' ? 0.25 : 1));
  let x = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < GEAR_SLOTS.length; i++) if ((x -= w[i]) < 0) return GEAR_SLOTS[i];
  return 'weapon';
}

export function gearBonus(items: Pick<GearItem, 'main' | 'subs'>[]): GearBonus {
  const out: GearBonus = {};
  for (const it of items) for (const l of [...it.main, ...it.subs]) out[l.stat] = (out[l.stat] ?? 0) + l.value;
  return out;
}

/** Áp chỉ số trang bị lên chỉ số đã tính theo cấp/sao/thức tỉnh. */
export function applyGear(s: Stats, g: GearBonus | undefined): Stats {
  if (!g) return s;
  return {
    ...s,
    hp: Math.round(s.hp * (1 + (g.hpPct ?? 0)) + (g.hp ?? 0)),
    atk: Math.round(s.atk * (1 + (g.atkPct ?? 0)) + (g.atk ?? 0)),
    def: Math.round(s.def * (1 + (g.defPct ?? 0)) + (g.def ?? 0)),
    spd: s.spd + (g.spd ?? 0),
    crit: Math.min(1, s.crit + (g.crit ?? 0)),
    critDmg: s.critDmg + (g.critDmg ?? 0),
    eff: s.eff + (g.eff ?? 0),
    res: s.res + (g.res ?? 0),
  };
}

export function formatStat(l: StatLine) {
  const info = STAT_INFO[l.stat];
  return `${info.name} +${info.pct ? `${Math.round(l.value * 1000) / 10}%` : l.value.toLocaleString('vi-VN')}`;
}

/** Xu nhận được khi phân giải. */
export const SALVAGE_COINS = [200, 500, 1200, 3000, 8000, 20000];

/** Lực chiến ước tính của một món (để sắp xếp gợi ý). */
export function gearScore(it: Pick<GearItem, 'main' | 'subs'>) {
  const w: Record<GearStat, number> = { atk: 1.2, hp: 0.1, def: 0.8, atkPct: 1500, hpPct: 900, defPct: 700, spd: 8, crit: 900, critDmg: 600, eff: 400, res: 400 };
  return Math.round([...it.main, ...it.subs].reduce((s, l) => s + l.value * w[l.stat], 0));
}
