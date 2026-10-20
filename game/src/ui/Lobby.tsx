import { useState } from 'react';
import { api, Profile } from '../api';
import { heroUrl } from '../battle/BattleScene';
import { HEROES, heroById } from '../engine/heroes';
import { ALL_STAGES } from '../engine/stages';
import { isUnlocked } from './Campaign';
import { Portrait } from './Portrait';

export type Screen = 'lobby' | 'team' | 'gacha' | 'collection' | 'campaign' | 'dungeons' | 'arena' | 'rta';

export function Lobby({ profile, setProfile, go, topBar }: { profile: Profile; setProfile: (p: Profile) => void; go: (s: Screen) => void; topBar: React.ReactNode }) {
  const [toast, setToast] = useState('');
  const owned = new Set(profile.heroes.map((h) => h.heroId));
  // Nhân vật đại diện: tướng hiếm nhất đang sở hữu
  const leader = [...profile.heroes].map((h) => heroById(h.heroId)).sort((a, b) => b.rarity - a.rarity)[0];

  const nextStage = ALL_STAGES.find((s) => !profile.stageClears.includes(s.id) && isUnlocked(profile, s.id));
  const claim = async () => {
    try {
      const r = await api.daily();
      setProfile(r);
      setToast(`Đã nhận ${r.reward.gems} Ngọc, ${r.reward.scrolls} Cuộn, ${r.reward.coins.toLocaleString('vi-VN')} Xu`);
    } catch (e) {
      setToast((e as Error).message);
    }
    setTimeout(() => setToast(''), 3000);
  };

  return (
    <div className="lobby">
      {topBar}
      <div className="lobby-body">
        <div className="lobby-hero">
          {leader && <img src={heroUrl(leader.image)} alt={leader.name} draggable={false} />}
          {leader && (
            <div className="lobby-hero-name">
              <small>{'★'.repeat(leader.rarity)}</small>
              <b>{leader.name}</b>
              <span>{leader.title}</span>
            </div>
          )}
        </div>
        <nav className="lobby-menu">
          <button className="menu-tile fight" onClick={() => go('campaign')}>
            <span className="mt-k">戦</span>
            <div>
              <b>Vượt Ải</b>
              <small>{nextStage ? `Tiếp theo: ${nextStage.id} · ${nextStage.name}` : 'Đã chinh phục mọi ải!'}</small>
            </div>
            <div className="mt-faces">
              {profile.team.slice(0, 5).map((id) => (
                <Portrait key={id} hero={heroById(id)} size={30} className="mini-face a" />
              ))}
            </div>
          </button>
          <div className="tile-pair">
            <button className="menu-tile dungeon" onClick={() => go('dungeons')}>
              <span className="mt-k">印</span>
              <div>
                <b>Bí Cảnh</b>
                <small>Nguyên liệu nâng cấp</small>
              </div>
            </button>
            <button className="menu-tile practice" onClick={() => go('team')}>
              <span className="mt-k">練</span>
              <div>
                <b>Luyện Tập</b>
                <small>Không tốn thể lực</small>
              </div>
            </button>
          </div>
          <button className="menu-tile summon" onClick={() => go('gacha')}>
            <span className="mt-k">召</span>
            <div>
              <b>Triệu Hồi</b>
              <small>Tăng tỉ lệ: Madara · Bảo hiểm {profile.pity.premium?.pity ?? 0}/120</small>
            </div>
            <img className="mt-art" src={heroUrl('Madara.webp')} alt="" draggable={false} />
          </button>
          <button className="menu-tile ninja" onClick={() => go('collection')}>
            <span className="mt-k">忍</span>
            <div>
              <b>Ninja</b>
              <small>
                Bộ sưu tập {owned.size}/{HEROES.length}
              </small>
            </div>
          </button>
          <button className={`menu-tile daily ${profile.user.dailyAvailable ? 'ready' : ''}`} onClick={claim} disabled={!profile.user.dailyAvailable}>
            <span className="mt-k">賞</span>
            <div>
              <b>Quà hằng ngày</b>
              <small>{profile.user.dailyAvailable ? '300 Ngọc · 5 Cuộn · 5.000 Xu' : 'Đã nhận hôm nay, quay lại ngày mai'}</small>
            </div>
            {profile.user.dailyAvailable && <span className="dot" />}
          </button>
          <div className="tile-pair">
            <button className="menu-tile arena" onClick={() => go('arena')}>
              <span className="mt-k">闘</span>
              <div>
                <b>Đấu Trường</b>
                <small>Đánh đội phòng thủ</small>
              </div>
            </button>
            <button className="menu-tile rta" onClick={() => go('rta')}>
              <span className="mt-k">刃</span>
              <div>
                <b>RTA</b>
                <small>Cấm/chọn realtime</small>
              </div>
            </button>
          </div>
        </nav>

        {/* Mobile: nút tròn hai bên + thanh tab dưới cùng (ẩn trên màn hình rộng) */}
        <div className="lm-side left">
          <button className={`lm-btn daily ${profile.user.dailyAvailable ? 'ready' : ''}`} onClick={claim} disabled={!profile.user.dailyAvailable}>
            <span className="lm-ic">賞</span>
            <small>Quà ngày</small>
            {profile.user.dailyAvailable && <span className="dot" />}
          </button>
          <button className="lm-btn practice" onClick={() => go('team')}>
            <span className="lm-ic">練</span>
            <small>Luyện tập</small>
          </button>
        </div>
        <div className="lm-side right">
          <button className="lm-btn summon" onClick={() => go('gacha')}>
            <span className="lm-ic">
              <img src={heroUrl('Madara.webp')} alt="" draggable={false} />
            </span>
            <small>Triệu Hồi</small>
            <em>{profile.pity.premium?.pity ?? 0}/120</em>
          </button>
        </div>
        <button className="lm-next" onClick={() => go('campaign')}>
          {nextStage ? (
            <>
              Tiếp theo <b>{nextStage.id}</b> · {nextStage.name}
            </>
          ) : (
            'Đã chinh phục mọi ải!'
          )}
        </button>
      </div>
      <nav className="lm-dock">
        <button className="lm-tab ninja" onClick={() => go('collection')}>
          <span className="lm-ic">忍</span>
          <small>Ninja</small>
        </button>
        <button className="lm-tab dungeon" onClick={() => go('dungeons')}>
          <span className="lm-ic">印</span>
          <small>Bí Cảnh</small>
        </button>
        <button className="lm-tab fight" onClick={() => go('campaign')}>
          <span className="lm-ic">戦</span>
          <small>Vượt Ải</small>
        </button>
        <button className="lm-tab arena" onClick={() => go('arena')}>
          <span className="lm-ic">闘</span>
          <small>Đấu Trường</small>
        </button>
        <button className="lm-tab rta" onClick={() => go('rta')}>
          <span className="lm-ic">刃</span>
          <small>RTA</small>
        </button>
      </nav>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
