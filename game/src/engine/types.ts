// Kiểu dữ liệu dùng chung cho engine chiến đấu (không phụ thuộc giao diện)

export type Element = 'fire' | 'wind' | 'lightning' | 'earth' | 'water' | 'yin' | 'yang';
export type Role = 'attacker' | 'assassin' | 'mage' | 'tank' | 'healer' | 'support';
export type TeamId = 'A' | 'B';

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  crit: number; // 0..1
  critDmg: number; // hệ số, ví dụ 1.5
  eff: number; // hiệu lực (tỉ lệ dính hiệu ứng)
  res: number; // kháng hiệu ứng
}

export type StatusType =
  | 'atkUp'
  | 'defUp'
  | 'spdUp'
  | 'atkDown'
  | 'defDown'
  | 'spdDown'
  | 'stun'
  | 'burn'
  | 'shield';

export const DEBUFFS: StatusType[] = ['atkDown', 'defDown', 'spdDown', 'stun', 'burn'];

export type TargetType = 'enemy' | 'allEnemies' | 'ally' | 'allAllies' | 'self';

export type Effect =
  | { kind: 'damage'; mult: number; scale?: 'atk' | 'hp' | 'def'; pierce?: number; hits?: number }
  | { kind: 'heal'; mult: number; scale: 'atk' | 'maxHp'; to: 'target' | 'allAllies' | 'self' | 'lowestAlly' }
  | { kind: 'status'; status: StatusType; turns: number; chance: number; to: 'target' | 'allEnemies' | 'allAllies' | 'self'; value?: number }
  | { kind: 'cr'; amount: number; to: 'target' | 'allEnemies' | 'allAllies' | 'self'; chance?: number }
  | { kind: 'cleanse'; to: 'allAllies' | 'target' }
  | { kind: 'extraTurn'; chance: number };

export interface SkillDef {
  id: string;
  slot: 1 | 2 | 3;
  name: string;
  desc: string;
  cd: number; // số lượt hồi chiêu (0 = không hồi)
  target: TargetType;
  effects: Effect[];
  cutin?: boolean; // tuyệt kỹ có cut-in
  melee?: boolean; // lao tới mục tiêu khi đánh
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  image: string;
  face: [number, number]; // vị trí khuôn mặt theo % ảnh (dùng cho avatar)
  aspect: number; // tỉ lệ rộng / cao của ảnh
  element: Element;
  role: Role;
  rarity: 3 | 4 | 5;
  stats: Stats;
  skills: [SkillDef, SkillDef, SkillDef];
}

export interface Status {
  type: StatusType;
  turns: number;
  value?: number; // dùng cho khiên / bỏng
  sourceUid?: string;
}

export interface Unit {
  uid: string;
  hero: HeroDef;
  team: TeamId;
  slot: number; // 0-1 hàng trước, 2-4 hàng sau
  maxHp: number;
  hp: number;
  cr: number; // thanh hành động 0..CR_MAX
  cooldowns: Record<string, number>;
  statuses: Status[];
  alive: boolean;
}

export type BattleEvent =
  | { t: 'turnStart'; uid: string }
  | { t: 'skill'; uid: string; skillId: string; targets: string[] }
  | { t: 'damage'; uid: string; src?: string; amount: number; crit: boolean; adv: 'adv' | 'dis' | 'none'; shieldAbsorb: number; dot?: boolean; miss?: boolean }
  | { t: 'heal'; uid: string; amount: number }
  | { t: 'status'; uid: string; status: StatusType; resisted?: boolean }
  | { t: 'statusExpire'; uid: string; status: StatusType }
  | { t: 'cr'; uid: string; delta: number }
  | { t: 'cleanse'; uid: string }
  | { t: 'death'; uid: string }
  | { t: 'stunned'; uid: string }
  | { t: 'extraTurn'; uid: string }
  | { t: 'end'; winner: TeamId };

export const CR_MAX = 1000;
