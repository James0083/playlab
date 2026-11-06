export { useGameSession } from './hooks/useGameSession.ts';
export type { GamePhase, GameSession, GameSessionOptions } from './hooks/useGameSession.ts';
export { useLeaderboard } from './hooks/useLeaderboard.ts';
export type { LeaderboardStatus } from './hooks/useLeaderboard.ts';
export { useDeviceMotion } from './hooks/useDeviceMotion.ts';
export type { MotionSample, MotionStatus } from './hooks/useDeviceMotion.ts';
export { useHaptics } from './hooks/useHaptics.ts';

export { GameShell } from './components/GameShell.tsx';
export { Countdown } from './components/Countdown.tsx';
export { ScoreResult } from './components/ScoreResult.tsx';
export { Leaderboard } from './components/Leaderboard.tsx';
export { ShareButton } from './components/ShareButton.tsx';
export { ErrorBoundary } from './components/ErrorBoundary.tsx';

export {
  createSoundBus,
  getAudioContext,
  scheduleNoise,
  scheduleTone,
  unlockAudio,
} from './lib/audio.ts';
export type { NoiseOptions, ToneOptions } from './lib/audio.ts';
export { createGameClock } from './lib/clock.ts';
export type { AudioTimeSource, GameClock } from './lib/clock.ts';

export { configureSupabase, isSupabaseConfigured } from './lib/supabase.ts';
export {
  fetchTop10,
  getLocalBest,
  getPlayerId,
  getSavedNickname,
  saveLocalBest,
  submitScore,
} from './lib/score.ts';
export type { ScoreSubmission } from './lib/score.ts';
export type { LeaderboardEntry } from './lib/score.ts';
