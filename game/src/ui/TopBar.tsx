import { Profile } from '../api';

export function Currency({ kind, value }: { kind: 'coins' | 'gems' | 'scrolls'; value: number }) {
  const icon = kind === 'coins' ? '金' : kind === 'gems' ? '玉' : '巻';
  const label = kind === 'coins' ? 'Xu' : kind === 'gems' ? 'Ngọc Chakra' : 'Cuộn Triệu Hồi';
  return (
    <span className={`cur cur-${kind}`} title={label}>
      <i>{icon}</i>
      {value.toLocaleString('vi-VN')}
    </span>
  );
}

export function TopBar({ profile, onLogout }: { profile: Profile; onLogout: () => void }) {
  const u = profile.user;
  return (
    <header className="topbar">
      <div className="tb-user">
        <span className="logo-k small">忍</span>
        <div>
          <b>{u.displayName}</b>
          <small>{profile.heroes.length} ninja</small>
        </div>
      </div>
      <div className="tb-wallet">
        <span className="cur cur-stamina" title={u.staminaNextMs ? `Hồi 1 thể lực sau ${Math.ceil(u.staminaNextMs / 60000)} phút` : 'Thể lực đầy'}>
          <i>⚡</i>
          {u.stamina}/{u.staminaMax}
        </span>
        <Currency kind="coins" value={u.coins} />
        <Currency kind="gems" value={u.gems} />
        <Currency kind="scrolls" value={u.scrolls} />
        <button className="btn-mini" onClick={onLogout}>
          Đăng xuất
        </button>
      </div>
    </header>
  );
}
