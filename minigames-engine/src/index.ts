// 게임이 쓰는 공개 API. 랭킹 조회·점수 제출·공유·오류 화면은 ScoreResult·GameShell 안에서만 쓰는 내부 구현이다.
export { useGameSession } from './hooks/useGameSession.ts';
export type { GamePhase, GameSession, GameSessionOptions } from './hooks/useGameSession.ts';
export { useDeviceMotion } from './hooks/useDeviceMotion.ts';
export type { MotionSample, MotionStatus } from './hooks/useDeviceMotion.ts';
export { useHaptics } from './hooks/useHaptics.ts';

export { GameShell } from './components/GameShell.tsx';
export { Countdown } from './components/Countdown.tsx';
export { ScoreResult } from './components/ScoreResult.tsx';

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
export { readStorage, writeStorage } from './lib/storage.ts';
export { backGoesHome, goHome } from './lib/navigation.ts';

export { configureSupabase } from './lib/supabase.ts';
export { getLocalBest } from './lib/score.ts';
export type { RecordBoard } from './lib/score.ts';
