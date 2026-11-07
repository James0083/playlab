import { useEffect, useMemo, useReducer } from 'react';
import { createInitialState, gameSessionReducer, type GamePhase } from './gameSessionReducer.ts';

export type { GamePhase };

export interface GameSessionOptions {
  /** 플레이 시간(ms). null이면 무한 콤보 방식으로, end()를 호출해야 끝난다. */
  durationMs: number | null;
  /**
   * 카운트다운 길이(ms). null이면 카운트다운 대신 준비 상태로 기다리다가 begin()을 부르면 시작한다
   * (예: 달고나는 바늘을 처음 댈 때부터 시간을 잰다).
   */
  countdownMs?: number | null;
}

export interface GameSession {
  phase: GamePhase;
  score: number;
  /** 남은 시간(ms). 무한 콤보 방식이면 null. */
  remainingMs: number | null;
  /** 플레이 시작 시각(performance.now 기준). 플레이 중이 아니면 null. */
  startedAt: number | null;
  /** 카운트다운(준비) 단계에서 플레이를 바로 시작한다. countdownMs가 null일 때 쓴다 */
  begin: () => void;
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
    if (phase !== 'countdown' || countdownMs === null) return;
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
      begin: () => dispatch({ type: 'begin', now: performance.now() }),
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
