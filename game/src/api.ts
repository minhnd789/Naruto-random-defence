import { Choice } from './engine/ai';
import { GearBonus, GearItem } from './engine/gear';
import { UnitSetup } from './engine/progression';
import { Reward } from './engine/stages';

// Gọi API máy chủ. Token lưu ở localStorage để giữ đăng nhập trên trình duyệt này.

export interface Wallet {
  coins: number;
  gems: number;
  scrolls: number;
}
export interface OwnedHero {
  heroId: string;
  stars: number;
  level: number;
  exp: number;
  awaken: number;
  dupes: number;
  /** Tổng chỉ số trang bị đang mặc (client tự gộp từ danh sách đồ). */
  gear?: GearBonus;
}
export interface Profile {
  user: {
    id: number;
    username: string;
    displayName: string;
    dailyAvailable: boolean;
    stamina: number;
    staminaMax: number;
    staminaNextMs: number | null;
  } & Wallet;
  heroes: OwnedHero[];
  team: string[];
  pity: Record<string, { pity: number; total: number }>;
  inventory: Record<string, number>;
  stageClears: string[];
  dungeonClears: Record<string, number>;
  /** Danh sách trang bị (client tự gộp từ /api/gear). */
  gear?: GearItem[];
}
export interface BattleTicket {
  battleId: string;
  seed: number;
  team: UnitSetup[];
  enemies: UnitSetup[];
}
export interface BattleOutcome {
  victory: boolean;
  turns: number;
  reward: Reward | null;
  firstClear: Reward | null;
  arena: { ratingChange: number; newRating: number } | null;
  gearDrops?: GearItem[];
  expired: boolean;
  error: string | null;
}
export type BattleTarget =
  | { mode: 'stage'; stageId: string }
  | { mode: 'dungeon'; dungeon: 'exp' | 'rune' | 'soul'; tier: number; element?: string }
  | { mode: 'arena'; opponentId: string };
export interface ArenaOpponent {
  id: string;
  name: string;
  rating: number;
  power: number;
  team: UnitSetup[];
  fought: boolean;
}
export interface ArenaState {
  season: number;
  endsAt: number;
  me: { rating: number; wins: number; losses: number; rank: number; tickets: number; ticketsMax: number; ticketNextMs: number | null };
  opponents: ArenaOpponent[];
  defense: UnitSetup[];
  pendingReward: { season: number; rating: number; tier: string; reward: { gems: number; coins: number } } | null;
}
export interface LeaderRow {
  rank: number;
  userId: number;
  name: string;
  rating: number;
  wins: number;
  losses: number;
}
export interface RtaMe {
  season: number;
  endsAt: number;
  rating: number;
  wins: number;
  losses: number;
  rank: number | null;
  heroes: number;
}

export interface BannerInfo {
  id: 'normal' | 'premium';
  name: string;
  desc: string;
  currency: 'gems' | 'scrolls';
  cost: number;
  rates: Record<'3' | '4' | '5', number>;
  pityMax: number | null;
  featured: string | null;
  featuredShare: number;
  pools: Record<'3' | '4' | '5', string[]>;
}
export interface PullResult {
  heroId: string;
  rarity: 3 | 4 | 5;
  pityHit: boolean;
  featured: boolean;
  isNew: boolean;
}

const TOKEN_KEY = 'ninja-token';

export const currentToken = () => memToken;

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* trình duyệt chặn lưu trữ: chỉ giữ đăng nhập trong phiên này */
  }
  memToken = t;
}
let memToken: string | null = getToken();

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(memToken ? { authorization: `Bearer ${memToken}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Lỗi ${res.status}`);
  return data as T;
}

export const api = {
  register: (username: string, password: string) => req<Profile & { token: string }>('POST', '/api/auth/register', { username, password }),
  login: (username: string, password: string) => req<Profile & { token: string }>('POST', '/api/auth/login', { username, password }),
  me: () => req<Profile>('GET', '/api/me'),
  daily: () => req<Profile & { reward: Wallet }>('POST', '/api/daily'),
  saveTeam: (team: string[]) => req<{ team: string[] }>('PUT', '/api/team', { team }),
  banners: () => req<{ banners: BannerInfo[] }>('GET', '/api/gacha/banners'),
  pull: (banner: string, count: 1 | 10) => req<Profile & { results: PullResult[] }>('POST', '/api/gacha/pull', { banner, count }),
  history: () => req<{ history: { banner: string; heroId: string; rarity: number; pityHit: boolean; at: string }[] }>('GET', '/api/gacha/history'),
  levelUp: (heroId: string, books: number) => req<Profile>('POST', `/api/hero/${heroId}/level`, { books }),
  starUp: (heroId: string) => req<Profile>('POST', `/api/hero/${heroId}/star`),
  awaken: (heroId: string) => req<Profile>('POST', `/api/hero/${heroId}/awaken`),
  battleStart: (target: BattleTarget, team: string[]) => req<Profile & { battle: BattleTicket }>('POST', '/api/battle/start', { ...target, team }),
  arena: () => req<ArenaState>('GET', '/api/arena'),
  arenaRefresh: () => req<ArenaState>('POST', '/api/arena/refresh'),
  arenaDefense: (team: string[]) => req<ArenaState>('PUT', '/api/arena/defense', { team }),
  arenaClaim: () => req<Profile & { reward: { gems: number; coins: number }; arena: ArenaState }>('POST', '/api/arena/claim'),
  arenaLog: () =>
    req<{ attacks: { name: string; win: boolean; change: number; created_at: string }[]; defenses: { name: string; win: boolean; change: number; created_at: string }[] }>(
      'GET',
      '/api/arena/log',
    ),
  leaderboard: (type: 'arena' | 'rta') => req<{ season: number; rows: LeaderRow[] }>('GET', `/api/leaderboard?type=${type}`),
  rtaMe: () => req<RtaMe>('GET', '/api/rta/me'),
  gear: () => req<{ gear: GearItem[] }>('GET', '/api/gear'),
  equipGear: (id: number, heroId: string) => req<Profile & { gear: GearItem[] }>('POST', `/api/gear/${id}/equip`, { heroId }),
  unequipGear: (id: number) => req<Profile & { gear: GearItem[] }>('POST', `/api/gear/${id}/unequip`),
  salvageGear: (ids: number[]) => req<Profile & { gear: GearItem[]; coins: number }>('POST', '/api/gear/salvage', { ids }),
  devGear: (count: number) => req<Profile & { gear: GearItem[] }>('POST', '/api/dev/gear', { count }),
  battleFinish: (battleId: string, actions: Choice[]) => req<Profile & BattleOutcome>('POST', '/api/battle/finish', { battleId, actions }),
};
