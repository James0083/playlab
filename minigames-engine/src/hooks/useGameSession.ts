import { useCallback, useEffect, useRef, useState } from 'react';

export type GamePhase = 'idle' | 'countdown' | 'playing' | 'result';

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

const TICK_MS = 100;

export function useGameSession({ durationMs, countdownMs = 3000 }: GameSessionOptions): GameSession {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [score, setScore] = useState(0);
  const [remainingMs, setRemainingMs] = useState<number | null>(durationMs);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const start = useCallback(() => {
    setScore(0);
    setRemainingMs(durationMs);
    setStartedAt(null);
    setPhase('countdown');
  }, [durationMs]);

  const addScore = useCallback((delta: number) => {
    if (phaseRef.current === 'playing') setScore((s) => s + delta);
  }, []);

  const end = useCallback(() => {
    setStartedAt(null);
    setPhase('result');
  }, []);

  const reset = useCallback(() => {
    setScore(0);
    setRemainingMs(durationMs);
    setStartedAt(null);
    setPhase('idle');
  }, [durationMs]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    const id = setTimeout(() => {
      setStartedAt(performance.now());
      setPhase('playing');
    }, countdownMs);
    return () => clearTimeout(id);
  }, [phase, countdownMs]);

  useEffect(() => {
    if (phase !== 'playing' || durationMs === null || startedAt === null) return;
    const id = setInterval(() => {
      const left = durationMs - (performance.now() - startedAt);
      if (left <= 0) {
        setRemainingMs(0);
        end();
      } else {
        setRemainingMs(left);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [phase, durationMs, startedAt, end]);

  return { phase, score, remainingMs, startedAt, start, addScore, end, reset };
}
