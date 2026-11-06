import { useEffect, useMemo, useReducer } from 'react';
import { createInitialState, gameSessionReducer, type GamePhase } from './gameSessionReducer.ts';

export type { GamePhase };

export interface GameSessionOptions {
  /** 플레이 시간(ms). null이면 무한 콤보 방식으로, end()를 호출해야 끝난다. */
  durationMs: number | null;
  countdownMs?: number;
}

export interface GameSession {
  phase: GamePhase;
  score: number;
  /** 남은 시간(ms). 무한 콤보 방식이면 null. */
  remainingMs: number | null;
  /** 플레이 시작 시각(performance.now 기준). 플레이 중이 아니면 null. */
  startedAt: number | null;
  start: () => void;
  addScore: (delta: number) => void;
  end: () => void;
  reset: () => void;
}

const DEFAULT_COUNTDOWN_MS = 3_000;
/** 남은 시간 표시 갱신 주기. 화면에는 초 단위로만 보이므로 매 프레임 갱신할 필요가 없다. */
const TICK_MS = 100;

export function useGameSession({
  durationMs,
  countdownMs = DEFAULT_COUNTDOWN_MS,
}: GameSessionOptions): GameSession {
  const [state, dispatch] = useReducer(gameSessionReducer, durationMs, createInitialState);
  const { phase } = state;

  useEffect(() => {
    if (phase !== 'countdown') return;
    const id = setTimeout(() => dispatch({ type: 'begin', now: performance.now() }), countdownMs);
    return () => clearTimeout(id);
  }, [phase, countdownMs]);

  useEffect(() => {
    if (phase !== 'playing' || durationMs === null) return;
    const id = setInterval(() => dispatch({ type: 'tick', now: performance.now() }), TICK_MS);
    return () => clearInterval(id);
  }, [phase, durationMs]);

  const actions = useMemo(
    () => ({
      start: () => dispatch({ type: 'start' }),
      addScore: (delta: number) => dispatch({ type: 'addScore', delta }),
      end: () => dispatch({ type: 'end' }),
      reset: () => dispatch({ type: 'reset' }),
    }),
    [],
  );

  return {
    phase,
    score: state.score,
    remainingMs: state.remainingMs,
    startedAt: state.startedAt,
    ...actions,
  };
}
