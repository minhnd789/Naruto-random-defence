// Mùa giải, bậc xếp hạng và Elo (dùng chung client + server)

const DAY = 86_400_000;
export const SEASON_LENGTH_MS = 7 * DAY;
/** Mùa 1 bắt đầu thứ Hai 05/01/2026 (UTC). Mỗi mùa kéo dài 1 tuần. */
export const SEASON_EPOCH = Date.UTC(2026, 0, 5);

export const seasonOf = (now = Date.now()) => Math.floor((now - SEASON_EPOCH) / SEASON_LENGTH_MS) + 1;
export const seasonEndsAt = (season: number) => SEASON_EPOCH + season * SEASON_LENGTH_MS;

export interface Tier {
  id: string;
  name: string;
  min: number;
  color: string;
  icon: string;
  reward: { gems: number; coins: number };
}

export const TIERS: Tier[] = [
  { id: 'bronze', name: 'Đồng', min: 0, color: '#c98a5a', icon: '銅', reward: { gems: 100, coins: 10000 } },
  { id: 'silver', name: 'Bạc', min: 1100, color: '#c8d4e0', icon: '銀', reward: { gems: 200, coins: 20000 } },
  { id: 'gold', name: 'Vàng', min: 1300, color: '#ffcf5a', icon: '金', reward: { gems: 400, coins: 40000 } },
  { id: 'platinum', name: 'Bạch Kim', min: 1500, color: '#7af0ff', icon: '白', reward: { gems: 700, coins: 70000 } },
  { id: 'diamond', name: 'Kim Cương', min: 1700, color: '#b98cff', icon: '剛', reward: { gems: 1000, coins: 100000 } },
  { id: 'legend', name: 'Huyền Thoại', min: 1900, color: '#ff6a4a', icon: '伝', reward: { gems: 1500, coins: 150000 } },
];

export const tierOf = (rating: number): Tier => [...TIERS].reverse().find((t) => rating >= t.min)!;

/** Thay đổi điểm Elo của người có điểm `a` khi gặp `b` (score: 1 thắng, 0 thua). */
export function eloDelta(a: number, b: number, score: 0 | 1, k = 32): number {
  const expected = 1 / (1 + Math.pow(10, (b - a) / 400));
  return Math.round(k * (score - expected));
}

/** Đầu mùa mới: điểm kéo về gần mốc khởi đầu một nửa. */
export const softReset = (prev: number, base: number) => Math.round(base + (prev - base) / 2);

export const ARENA_BASE = 1000;
export const RTA_BASE = 1200;
export const ARENA_TICKETS_MAX = 5;
export const ARENA_TICKET_REGEN_MS = 30 * 60 * 1000;
export const ARENA_WIN = { coins: 1500, gems: 10 };
export const ARENA_LOSS = { coins: 300, gems: 0 };

// ---------- RTA ----------
export const RTA_MIN_HEROES = 6;
export const RTA_TEAM_SIZE = 5;
/** Thứ tự chọn kiểu rắn: A1, B1 B2, A2 A3, B3 B4, A4 A5, B5. */
export const PICK_ORDER: ('A' | 'B')[] = ['A', 'B', 'B', 'A', 'A', 'B', 'B', 'A', 'A', 'B'];
export const DRAFT_TIMEOUT_MS = 25_000;
export const TURN_TIMEOUT_MS = 30_000;
