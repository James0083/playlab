export { useGameSession } from './hooks/useGameSession';
export type { GamePhase, GameSession, GameSessionOptions } from './hooks/useGameSession';
export { useLeaderboard } from './hooks/useLeaderboard';
export type { LeaderboardStatus } from './hooks/useLeaderboard';
export { useDeviceMotion } from './hooks/useDeviceMotion';
export type { MotionSample, MotionStatus } from './hooks/useDeviceMotion';
export { useHaptics } from './hooks/useHaptics';

export { GameShell } from './components/GameShell';
export { Countdown } from './components/Countdown';
export { ScoreResult } from './components/ScoreResult';
export { Leaderboard } from './components/Leaderboard';
export { ShareButton } from './components/ShareButton';

export { configureSupabase, isSupabaseConfigured } from './lib/supabase';
export {
  fetchTop10,
  getLocalBest,
  getPlayerId,
  getSavedNickname,
  saveLocalBest,
  submitScore,
} from './lib/score';
export type { LeaderboardEntry } from './lib/score';
