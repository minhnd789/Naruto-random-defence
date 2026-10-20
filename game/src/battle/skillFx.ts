// Biên đạo hiệu ứng cho từng kỹ năng (tên file trong public/fx, không kèm đuôi)
import { Element, SkillDef } from '../engine/types';

export interface SkillFx {
  /** Hiệu ứng lúc tụ chiêu, đặt tại người dùng. */
  cast?: string;
  castScale?: number;
  /** Hiệu ứng lặp cầm trên tay khi lao tới (Rasengan, Chidori). */
  hold?: string;
  /** Cách tiếp cận: lao tới, đứng tại chỗ, hay dịch chuyển tức thời (Phi Lôi Thần). */
  move?: 'dash' | 'stay' | 'teleport';
  /** Vật bay từ người dùng (hoặc rơi từ trời) tới mục tiêu / giữa đội địch. */
  proj?: string;
  projScale?: number;
  projFrom?: 'actor' | 'sky';
  projMs?: number;
  /** Vụ nổ lớn khi tới nơi: một cái giữa đội địch, hoặc trên từng mục tiêu. */
  burst?: string;
  burstAt?: 'center' | 'each';
  burstScale?: number;
  /** Khung của vụ nổ mà sát thương bắt đầu hiện (khớp lúc đánh trúng). */
  impactFrame?: number;
  /** Hiệu ứng nhỏ trên mục tiêu mỗi lần gây sát thương. */
  hit?: string;
  hitScale?: number;
  /** Hiệu ứng trên đồng đội được hồi máu / tăng sức mạnh / nhận khiên. */
  ally?: string;
  allyScale?: number;
}

const ELEMENT_HIT: Record<Element, string> = {
  fire: 'fx_fire_burst',
  wind: 'fx_wind_blades',
  lightning: 'fx_lightning',
  earth: 'fx_earth_spikes',
  water: 'fx_water_splash',
  yin: 'fx_dark_burst',
  yang: 'fx_light_burst',
};

const SKILL_FX: Record<string, SkillFx> = {
  // Naruto (Tiên Nhân)
  naruto_sage_s1: { hold: 'fx_rasengan', hit: 'fx_impact', burst: 'fx_shockwave', burstAt: 'each', burstScale: 0.9 },
  naruto_sage_s2: { cast: 'fx_death_smoke', hit: 'fx_punch_impact', hitScale: 0.9 },
  naruto_sage_s3: { move: 'stay', cast: 'fx_cast_circle', proj: 'fx_rasenshuriken', projScale: 1.3, burst: 'fx_wind_explosion', burstAt: 'center', burstScale: 3, impactFrame: 4, hit: 'fx_wind_blades', hitScale: 0.7 },
  // Sasuke
  sasuke_ems_s1: { move: 'stay', proj: 'fx_fireball', projScale: 1, hit: 'fx_fire_burst', hitScale: 1 },
  sasuke_ems_s2: { hold: 'fx_chidori', hit: 'fx_lightning', hitScale: 1.1 },
  sasuke_ems_s3: { move: 'stay', cast: 'fx_dark_orb', proj: 'fx_susanoo_arrow', projScale: 1.6, projMs: 220, burst: 'fx_dark_burst', burstAt: 'each', burstScale: 1.8, hit: 'fx_lightning' },
  // Itachi
  itachi_s1: { move: 'stay', burst: 'fx_crows', burstAt: 'each', burstScale: 1.2, impactFrame: 5, hit: 'fx_impact', hitScale: 0.6 },
  itachi_s2: { move: 'stay', cast: 'fx_cast_circle', burst: 'fx_amaterasu', burstAt: 'each', burstScale: 1.3, impactFrame: 5, hit: 'fx_impact', hitScale: 0.5 },
  itachi_s3: { move: 'stay', burst: 'fx_tsukuyomi', burstAt: 'each', burstScale: 1.8, impactFrame: 8, hit: 'fx_dark_burst' },
  // Kakashi
  kakashi_s1: { hold: 'fx_chidori', hit: 'fx_lightning', hitScale: 0.8 },
  kakashi_s2: { hold: 'fx_chidori', hit: 'fx_slash_x', ally: 'fx_buff', allyScale: 0.8 },
  kakashi_s3: { move: 'stay', burst: 'fx_kamui', burstAt: 'each', burstScale: 1.8, impactFrame: 7, hit: 'fx_dark_burst', hitScale: 0.7 },
  // Minato
  minato_s1: { move: 'teleport', cast: 'fx_flash_step', hit: 'fx_slash', hitScale: 1 },
  minato_s2: { move: 'stay', cast: 'fx_flash_step', castScale: 1.3, ally: 'fx_flash_step', allyScale: 0.9 },
  minato_s3: { move: 'teleport', cast: 'fx_flash_step', hold: 'fx_rasengan', burst: 'fx_wind_explosion', burstAt: 'each', burstScale: 1.6, impactFrame: 3, hit: 'fx_impact' },
  // Gaara
  gaara_s1: { move: 'stay', burst: 'fx_sand_burst', burstAt: 'each', burstScale: 1.1, impactFrame: 5, hit: 'fx_impact', hitScale: 0.5 },
  gaara_s2: { move: 'stay', cast: 'fx_sand_burst', ally: 'fx_shield', allyScale: 1.1 },
  gaara_s3: { move: 'stay', cast: 'fx_cast_circle', burst: 'fx_sand_coffin', burstAt: 'each', burstScale: 1.7, impactFrame: 10, hit: 'fx_sand_burst', hitScale: 0.8 },
  // Tsunade
  tsunade_s1: { hit: 'fx_sakura_punch', hitScale: 1.2 },
  tsunade_s2: { move: 'stay', cast: 'fx_cast_circle', ally: 'fx_heal', allyScale: 1.1 },
  tsunade_s3: { move: 'stay', cast: 'fx_light_burst', castScale: 1.6, ally: 'fx_heal', allyScale: 1.3 },
  // Sakura
  sakura_s1: { hit: 'fx_punch_impact', hitScale: 1 },
  sakura_s2: { move: 'stay', ally: 'fx_heal', allyScale: 1.2 },
  sakura_s3: { hit: 'fx_sakura_punch', hitScale: 1.6, ally: 'fx_heal' },
  // Kisame
  kisame_s1: { hit: 'fx_slash', burst: 'fx_water_splash', burstAt: 'each', burstScale: 0.9 },
  kisame_s2: { move: 'stay', burst: 'fx_water_splash', burstAt: 'each', burstScale: 1.5, impactFrame: 4, hit: 'fx_impact', hitScale: 0.6 },
  kisame_s3: { move: 'stay', cast: 'fx_cast_circle', proj: 'fx_water_shark', projScale: 2.2, projMs: 520, burst: 'fx_water_splash', burstAt: 'each', burstScale: 1.4, hit: 'fx_impact', hitScale: 0.6 },
  // Hinata
  hinata_s1: { hit: 'fx_punch_impact', hitScale: 0.8 },
  hinata_s2: { move: 'stay', burst: 'fx_shockwave', burstAt: 'each', burstScale: 1.3, impactFrame: 4, hit: 'fx_punch_impact', hitScale: 0.6 },
  hinata_s3: { cast: 'fx_twin_lions', castScale: 1, hit: 'fx_punch_impact', burst: 'fx_twin_lions', burstAt: 'each', burstScale: 1.4, impactFrame: 6, ally: 'fx_buff', allyScale: 0.8 },
  // Madara
  madara_s1: { hit: 'fx_slash_x', hitScale: 1.1 },
  madara_s2: { move: 'stay', proj: 'fx_fireball', projScale: 2.4, projMs: 480, burst: 'fx_fire_burst', burstAt: 'each', burstScale: 1.5, hit: 'fx_impact', hitScale: 0.5 },
  madara_s3: { move: 'stay', cast: 'fx_cast_circle', proj: 'fx_meteor', projFrom: 'sky', projScale: 2, projMs: 900, burst: 'fx_meteor_impact', burstAt: 'center', burstScale: 3.2, impactFrame: 3, hit: 'fx_fire_burst', hitScale: 0.8 },
  // Pain
  pain_s1: { move: 'stay', proj: 'fx_kunai', projScale: 0.8, hit: 'fx_dark_burst', hitScale: 0.7 },
  pain_s2: { move: 'stay', burst: 'fx_shinra_tensei', burstAt: 'center', burstScale: 3, impactFrame: 4, hit: 'fx_impact', hitScale: 0.6 },
  pain_s3: { move: 'stay', cast: 'fx_dark_orb', castScale: 1.4, burst: 'fx_dark_orb', burstAt: 'center', burstScale: 2, impactFrame: 6, hit: 'fx_earth_spikes', hitScale: 1 },
  // Tenten
  tenten_s1: { move: 'stay', proj: 'fx_kunai', hit: 'fx_impact', hitScale: 0.8 },
  tenten_s2: { move: 'stay', burst: 'fx_slash_x', burstAt: 'each', burstScale: 1, impactFrame: 4, hit: 'fx_impact', hitScale: 0.5 },
  tenten_s3: { move: 'stay', proj: 'fx_kunai', burst: 'fx_fire_burst', burstAt: 'each', burstScale: 1.5, hit: 'fx_impact' },
  // Kiba
  kiba_s1: { hit: 'fx_slash' },
  kiba_s2: { hit: 'fx_wind_blades', hitScale: 1.1 },
  kiba_s3: { hit: 'fx_slash_x', burst: 'fx_wind_blades', burstAt: 'each', burstScale: 1.5 },
  // Shino
  shino_s1: { move: 'stay', burst: 'fx_debuff', burstAt: 'each', burstScale: 0.9, impactFrame: 6, hit: 'fx_dark_burst', hitScale: 0.5 },
  shino_s2: { move: 'stay', burst: 'fx_debuff', burstAt: 'each', burstScale: 1, impactFrame: 6, hit: 'fx_dark_burst', hitScale: 0.5 },
  shino_s3: { move: 'stay', burst: 'fx_dark_orb', burstAt: 'each', burstScale: 1.3, impactFrame: 5, hit: 'fx_dark_burst', hitScale: 0.8 },
  // Choji
  choji_s1: { hit: 'fx_punch_impact', hitScale: 1.1 },
  choji_s2: { move: 'stay', cast: 'fx_buff', castScale: 1.2 },
  choji_s3: { hit: 'fx_sakura_punch', hitScale: 1.6 },
  // Shikamaru
  shikamaru_s1: { move: 'stay', burst: 'fx_shadow_bind', burstAt: 'each', burstScale: 0.9, impactFrame: 7, hit: 'fx_impact', hitScale: 0.5 },
  shikamaru_s2: { move: 'stay', burst: 'fx_shadow_bind', burstAt: 'each', burstScale: 1.2, impactFrame: 8, hit: 'fx_impact', hitScale: 0.5 },
  shikamaru_s3: { move: 'stay', cast: 'fx_cast_circle', burst: 'fx_shadow_bind', burstAt: 'each', burstScale: 1.3, impactFrame: 8, hit: 'fx_dark_burst', hitScale: 0.6 },
  // Rock Lee
  lee_s1: { hit: 'fx_punch_impact' },
  lee_s2: { move: 'stay', cast: 'fx_eight_gates', castScale: 1.4 },
  lee_s3: { cast: 'fx_eight_gates', hit: 'fx_punch_impact', hitScale: 1.2, burst: 'fx_shockwave', burstAt: 'each', burstScale: 1.2 },
  // Ino
  ino_s1: { move: 'stay', proj: 'fx_kunai', projScale: 0.7, hit: 'fx_light_burst', hitScale: 0.7 },
  ino_s2: { move: 'stay', ally: 'fx_heal', allyScale: 1.1 },
  ino_s3: { move: 'stay', burst: 'fx_light_burst', burstAt: 'each', burstScale: 1.3, impactFrame: 6, hit: 'fx_impact', ally: 'fx_heal', allyScale: 0.9 },
  // Temari
  temari_s1: { move: 'stay', burst: 'fx_wind_blades', burstAt: 'each', burstScale: 1, impactFrame: 4 },
  temari_s2: { move: 'stay', burst: 'fx_wind_blades', burstAt: 'each', burstScale: 1.3, impactFrame: 4, hit: 'fx_impact', hitScale: 0.5 },
  temari_s3: { move: 'stay', cast: 'fx_cast_circle', burst: 'fx_wind_explosion', burstAt: 'center', burstScale: 3, impactFrame: 4, hit: 'fx_wind_blades', hitScale: 0.8 },
};

/** Biên đạo của kỹ năng: lấy bảng riêng, thiếu trường nào thì suy ra theo hệ và kiểu đòn. */
export function skillFx(skill: SkillDef, element: Element): SkillFx {
  const own = SKILL_FX[skill.id] ?? {};
  const offensive = skill.target === 'enemy' || skill.target === 'allEnemies';
  const healing = skill.effects.some((e) => e.kind === 'heal');
  return {
    move: skill.melee ? 'dash' : 'stay',
    hit: offensive ? (skill.melee ? 'fx_slash' : ELEMENT_HIT[element]) : undefined,
    ally: !offensive ? (healing ? 'fx_heal' : 'fx_buff') : undefined,
    cast: !skill.melee && skill.slot > 1 ? 'fx_cast_circle' : undefined,
    ...own,
  };
}

/** Mọi file hiệu ứng mà một danh sách kỹ năng cần (để tải trước khi vào trận). */
export function fxNeeded(skills: { skill: SkillDef; element: Element }[]): string[] {
  const set = new Set<string>([
    'fx_impact', 'fx_slash', 'fx_dash_trail', 'fx_death_smoke', 'fx_cast_circle',
    'fx_stun', 'fx_burn', 'fx_shield', 'fx_buff', 'fx_debuff', 'fx_heal',
  ]);
  for (const { skill, element } of skills) {
    const f = skillFx(skill, element);
    for (const k of ['cast', 'hold', 'proj', 'burst', 'hit', 'ally'] as const) if (f[k]) set.add(f[k]!);
  }
  return [...set];
}
