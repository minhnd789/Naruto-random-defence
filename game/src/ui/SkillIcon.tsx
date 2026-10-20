import { CSSProperties } from 'react';
import { skillFx } from '../battle/skillFx';
import { ELEMENT_INFO } from '../engine/heroes';
import { Element, SkillDef } from '../engine/types';

const SHEET_COLS = 4;
/** Khung dùng làm icon: khung 8 (hàng 2, cột 4) thường là lúc hiệu ứng rõ nhất. */
const ICON_FRAME = 7;

/** Hiệu ứng đại diện cho kỹ năng: ưu tiên vụ nổ, vật bay, thứ cầm trên tay… */
export function iconFxOf(skill: SkillDef, element: Element): string | undefined {
  const f = skillFx(skill, element);
  const offensive = skill.target === 'enemy' || skill.target === 'allEnemies';
  // Kỹ năng hỗ trợ: lấy hiệu ứng lên đồng đội (hồi máu, khiên…) thay vì vòng ấn chú
  if (!offensive) return f.ally ?? f.cast;
  return f.burst ?? f.proj ?? f.hold ?? f.hit ?? f.cast ?? f.ally;
}

/** Icon kỹ năng cắt từ spritesheet hiệu ứng của chính kỹ năng đó. */
export function SkillIcon({ skill, element, size, className, style }: { skill: SkillDef; element: Element; size: number; className?: string; style?: CSSProperties }) {
  const fx = iconFxOf(skill, element);
  const col = ICON_FRAME % SHEET_COLS;
  const row = Math.floor(ICON_FRAME / SHEET_COLS);
  // Phóng 1.35 lần để hiệu ứng lấp đầy ô tròn
  const zoom = 1.35;
  const cell = size * zoom;
  const off = (cell - size) / 2;
  return (
    <span
      className={`skill-icon ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        '--el': ELEMENT_INFO[element].css,
        backgroundImage: fx ? `url(/fx/${fx}.webp)` : undefined,
        backgroundSize: `${cell * SHEET_COLS}px ${cell * SHEET_COLS}px`,
        backgroundPosition: `${-(col * cell + off)}px ${-(row * cell + off)}px`,
        ...style,
      } as CSSProperties}
    >
      {!fx && ELEMENT_INFO[element].icon}
    </span>
  );
}
