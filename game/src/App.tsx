import { useEffect, useState } from 'react';
import { api, ApiError, BattleTarget, getToken, Profile, setToken } from './api';
import type { BattleTheme } from './battle/BattleScene';
import { buildTeam, UnitSetup } from './engine/progression';
import { enemySetup, stageById } from './engine/stages';
import { HeroDef } from './engine/types';
import { Arena } from './ui/Arena';
import { AuthScreen } from './ui/AuthScreen';
import { BattleView } from './ui/BattleView';
import { Campaign } from './ui/Campaign';
import { Collection } from './ui/Collection';
import { Dungeons } from './ui/Dungeons';
import { Gacha } from './ui/Gacha';
import { Lobby, Screen } from './ui/Lobby';
import { Rta } from './ui/Rta';
import { Mission, progOf, TeamSelect } from './ui/TeamSelect';
import { TopBar } from './ui/TopBar';

interface Prep {
  target: BattleTarget | null; // null = luyện tập
  mission: Mission | null;
  back: Screen;
}
interface ActiveBattle {
  team: HeroDef[];
  enemy: HeroDef[];
  seed: number;
  battleId?: string;
  teamIds: string[];
  practiceEnemy?: string[];
}

/** Bối cảnh trận đấu theo chế độ chơi. */
function themeOf(target: BattleTarget | null | undefined): BattleTheme {
  if (!target) return 'konoha';
  if (target.mode === 'arena') return 'arena';
  if (target.mode === 'dungeon') return target.dungeon === 'exp' ? 'forest' : target.dungeon === 'rune' ? 'desert' : 'valley';
  const ch = stageById(target.stageId)?.chapter ?? 1;
  return (['konoha', 'forest', 'rain', 'valley'] as const)[Math.min(3, ch - 1)];
}

const BACK_LABEL: Partial<Record<Screen, string>> = { campaign: 'Về bản đồ', dungeons: 'Về bí cảnh', arena: 'Về đấu trường', lobby: 'Đổi đội hình' };

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checking, setChecking] = useState(!!getToken());
  const [screen, setScreen] = useState<Screen>('lobby');
  const [prep, setPrep] = useState<Prep | null>(null);
  const [battle, setBattle] = useState<ActiveBattle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [prepError, setPrepError] = useState('');

  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(setProfile)
      .catch((e: ApiError) => {
        if (e.status === 401) setToken(null);
        else setError(e.message);
      })
      .finally(() => setChecking(false));
  }, []);

  const logout = () => {
    setToken(null);
    setProfile(null);
    setScreen('lobby');
  };

  if (checking) return <div className="loading full">Đang tải…</div>;
  if (error && !profile)
    return (
      <div className="loading full">
        {error}
        <button className="btn-ghost" style={{ width: 'auto', marginTop: 12 }} onClick={() => location.reload()}>
          Thử lại
        </button>
      </div>
    );
  if (!profile)
    return (
      <AuthScreen
        onAuthed={(p) => {
          setProfile(p);
          setScreen('lobby');
        }}
      />
    );

  /** Vào trận: nhiệm vụ thì xin server cấp seed và đội hình, luyện tập thì chạy hoàn toàn trên trình duyệt. */
  const startBattle = async (teamIds: string[], practiceEnemy?: string[]) => {
    setPrepError('');
    if (!prep?.target) {
      const mine: UnitSetup[] = teamIds.map((id) => ({ heroId: id, ...progOf(profile.heroes, id) }));
      const avg = Math.round(mine.reduce((s, u) => s + u.level, 0) / mine.length);
      const enemies = (practiceEnemy ?? []).map((id) => enemySetup(id, avg));
      setBattle({ team: buildTeam(mine), enemy: buildTeam(enemies), seed: (Math.random() * 1e9) | 0, teamIds, practiceEnemy });
      return;
    }
    setBusy(true);
    try {
      const r = await api.battleStart(prep.target, teamIds);
      setProfile(r);
      setBattle({ team: buildTeam(r.battle.team), enemy: buildTeam(r.battle.enemies), seed: r.battle.seed, battleId: r.battle.battleId, teamIds });
    } catch (e) {
      setPrepError((e as Error).message);
      setBattle(null);
    } finally {
      setBusy(false);
    }
  };

  if (battle) {
    return (
      <BattleView
        key={battle.battleId ?? battle.seed}
        team={battle.team}
        enemy={battle.enemy}
        seed={battle.seed}
        battleId={battle.battleId}
        theme={themeOf(prep?.target)}
        onProfile={setProfile}
        backLabel={BACK_LABEL[prep?.back ?? 'lobby'] ?? 'Quay lại'}
        onRetry={prep?.target?.mode === 'arena' ? undefined : () => startBattle(battle.teamIds, battle.practiceEnemy)}
        onBack={() => {
          setBattle(null);
          if (prep?.target) {
            setPrep(null);
            setScreen(prep.back);
          }
        }}
      />
    );
  }

  const topBar = <TopBar profile={profile} onLogout={logout} />;
  const toLobby = () => setScreen('lobby');
  const prepare = (back: Screen) => (target: BattleTarget, mission: Mission) => {
    setPrepError('');
    setPrep({ target, mission, back });
    setScreen('team');
  };

  switch (screen) {
    case 'team':
      return (
        <TeamSelect
          owned={profile.heroes}
          initial={profile.team}
          mission={prep?.mission ?? null}
          stamina={profile.user.stamina}
          topBar={topBar}
          busy={busy}
          error={prepError}
          backLabel={prep?.back === 'campaign' ? 'Bản đồ' : prep?.back === 'dungeons' ? 'Bí cảnh' : prep?.back === 'arena' ? 'Đấu trường' : 'Sảnh'}
          onBack={() => {
            setScreen(prep?.back ?? 'lobby');
            setPrep(null);
          }}
          onStart={(teamIds, practiceEnemy) => {
            if (teamIds.join() !== profile.team.join()) {
              setProfile({ ...profile, team: teamIds });
              if (!prep?.target) api.saveTeam(teamIds).catch(() => {});
            }
            startBattle(teamIds, practiceEnemy);
          }}
        />
      );
    case 'campaign':
      return <Campaign profile={profile} onBack={toLobby} onPrepare={prepare('campaign')} topBar={topBar} />;
    case 'dungeons':
      return <Dungeons profile={profile} onBack={toLobby} onPrepare={prepare('dungeons')} topBar={topBar} />;
    case 'arena':
      return <Arena profile={profile} setProfile={setProfile} onBack={toLobby} onPrepare={prepare('arena')} topBar={topBar} />;
    case 'rta':
      return <Rta profile={profile} onBack={toLobby} topBar={topBar} />;
    case 'gacha':
      return <Gacha profile={profile} setProfile={setProfile} onBack={toLobby} topBar={topBar} />;
    case 'collection':
      return <Collection profile={profile} setProfile={setProfile} onBack={toLobby} topBar={topBar} />;
    default:
      return (
        <Lobby
          profile={profile}
          setProfile={setProfile}
          topBar={topBar}
          go={(s) => {
            if (s === 'team') setPrep({ target: null, mission: null, back: 'lobby' });
            setScreen(s);
          }}
        />
      );
  }
}
