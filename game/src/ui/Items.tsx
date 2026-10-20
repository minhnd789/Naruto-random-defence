import { CSSProperties } from 'react';
import { ITEMS } from '../engine/progression';
import { Reward } from '../engine/stages';
import { Currency } from './TopBar';

export function ItemIcon({ id, qty, need }: { id: string; qty?: number; need?: number }) {
  const it = ITEMS[id];
  if (!it) return null;
  const lacking = need !== undefined && (qty ?? 0) < need;
  return (
    <span className={`item ${lacking ? 'lack' : ''}`} style={{ '--c': it.color } as CSSProperties} title={`${it.name}: ${it.desc}`}>
      <i>{it.icon}</i>
      {need !== undefined ? (
        <b>
          {qty ?? 0}/{need}
        </b>
      ) : (
        qty !== undefined && <b>×{qty}</b>
      )}
      <small>{it.name}</small>
    </span>
  );
}

export function RewardList({ reward, label }: { reward: Reward; label?: string }) {
  return (
    <div className="reward-list">
      {label && <span className="rl-label">{label}</span>}
      {reward.coins > 0 && <Currency kind="coins" value={reward.coins} />}
      {!!reward.gems && <Currency kind="gems" value={reward.gems} />}
      {Object.entries(reward.items).map(([id, q]) => (
        <ItemIcon key={id} id={id} qty={q} />
      ))}
    </div>
  );
}
