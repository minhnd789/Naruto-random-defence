import { CSSProperties } from 'react';
import { HeroDef } from '../engine/types';
import { heroUrl } from '../battle/BattleScene';

/** Avatar khuôn mặt cắt từ ảnh toàn thân dựa trên vị trí face của tướng. */
export function Portrait({ hero, size, zoom = 0.16, className, style }: { hero: HeroDef; size: number; zoom?: number; className?: string; style?: CSSProperties }) {
  const bgH = size / zoom;
  const bgW = bgH * hero.aspect;
  const x = (hero.face[0] / 100) * bgW - size / 2;
  const y = (hero.face[1] / 100) * bgH - size / 2;
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${heroUrl(hero.image)})`,
        backgroundSize: `${bgW}px ${bgH}px`,
        backgroundPosition: `${-x}px ${-y}px`,
        backgroundRepeat: 'no-repeat',
        ...style,
      }}
    />
  );
}
