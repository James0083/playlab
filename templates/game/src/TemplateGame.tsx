import {
  createGameClock,
  GameShell,
  getAudioContext,
  backGoesHome,
  goHome,
  ScoreResult,
  StartOverlay,
  unlockAudio,
  useGameSession,
  useHaptics,
  type GameClock,
} from '@minigames/engine';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { DURATION_MS, scoreTap } from './rules.ts';
import { playTapSound } from './sounds.ts';

// 화면과 입력 처리. 판정·점수는 rules.ts에 두고 여기서는 부르기만 한다.
// TODO: 게임 화면을 처음 구현할 때 아래 예시(제한 시간 동안 버튼 탭)를 이 게임의 화면으로 바꾼다.

/** 랭킹·최고기록을 나누는 게임 id. 폴더 이름(game-<slug>)·vite base와 같아야 한다 */
const SLUG = 'template';
const TITLE = '게임 이름';
/** 점수가 오를 때 진동 길이(ms). 짧게 쳐서 빠른 탭에도 진동이 겹치지 않게 한다 */
const TAP_VIBRATION_MS = 15;
/** 키보드로 칠 때 쓰는 키. 꾹 누를 때의 자동 반복은 무시한다 */
const TAP_KEYS = new Set([' ', 'Enter']);

export function TemplateGame() {
  const session = useGameSession({ durationMs: DURATION_MS });
  const { vibrate } = useHaptics();
  // 아래 값은 한 판 동안만 유효하다. 탭마다 바뀌지만 화면에 그대로 보이지 않으므로 ref에 둔다
  const clock = useRef<GameClock | null>(null);
  const lastScoredMs = useRef<number | null>(null);
  /** 너무 빨라 점수로 치지 않은 탭 수. 결과 화면에 보여준다 */
  const [ignoredTaps, setIgnoredTaps] = useState(0);
  const { phase } = session;

  // 판정에 쓰는 게임 시계는 플레이가 시작되는 순간 만든다(오디오가 재생 중이면 오디오 시각 기준)
  useEffect(() => {
    if (phase !== 'playing') return;
    clock.current = createGameClock(getAudioContext());
    lastScoredMs.current = null;
    return () => {
      clock.current = null;
    };
  }, [phase]);

  const handleStart = () => {
    unlockAudio(); // 사용자 제스처 안에서 호출해야 iOS에서 소리가 난다
    setIgnoredTaps(0);
    session.start();
  };

  const handleTap = () => {
    const gameClock = clock.current;
    if (!gameClock) return;
    const elapsedMs = gameClock.elapsedMs();
    const points = scoreTap({ elapsedMs, lastScoredMs: lastScoredMs.current });
    if (points === 0) {
      setIgnoredTaps((count) => count + 1);
      return;
    }
    lastScoredMs.current = elapsedMs;
    session.addScore(points);
    vibrate(TAP_VIBRATION_MS);
    playTapSound();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!TAP_KEYS.has(event.key) || event.repeat) return;
    event.preventDefault();
    handleTap();
  };

  // 시작 화면·결과 화면에서는 게임 목록(홈)으로, 카운트다운·플레이 중에는 시작 화면으로 돌아간다
  const handleBack = backGoesHome(phase) ? goHome : session.reset;

  return (
    <GameShell
      title={TITLE}
      onBack={handleBack}
      score={phase === 'playing' ? session.score : undefined}
      remainingMs={phase === 'playing' ? session.remainingMs : undefined}
    >
      {(phase === 'idle' || phase === 'countdown') && (
        <div className="tp-field">
          {/* 시작 화면: 엔진 공통 카드. 그림이 있으면 카드 뒤에 보인다 */}
          <StartOverlay isCounting={phase === 'countdown'} align="center" onStart={handleStart}>
            <p className="mg-start-guide">{DURATION_MS / 1_000}초 동안 최대한 많이 탭!</p>
          </StartOverlay>
        </div>
      )}
      {phase === 'playing' && (
        <button
          type="button"
          className="tp-field tp-target"
          aria-label="탭 (스페이스, 엔터)"
          onPointerDown={handleTap}
          onKeyDown={handleKeyDown}
          // 플레이가 시작되면 바로 키보드로 칠 수 있게 한다
          autoFocus
        >
          탭!
        </button>
      )}
      {phase === 'result' && (
        <ScoreResult
          slug={SLUG}
          title={TITLE}
          score={session.score}
          headline="끝!"
          details={<ResultStats score={session.score} ignoredTaps={ignoredTaps} />}
          metadata={{ ignoredTaps }}
          onRestart={handleStart}
        />
      )}
    </GameShell>
  );
}

/** 결과 화면에 보여줄 게임별 기록. 엔진의 mg-stats 칸 모양을 쓴다 */
function ResultStats({ score, ignoredTaps }: { score: number; ignoredTaps: number }) {
  return (
    <ul className="mg-stats" aria-label="탭 기록">
      <li>
        <strong>{score}</strong>
        <span>인정된 탭</span>
      </li>
      <li>
        <strong>{ignoredTaps}</strong>
        <span>너무 빠른 탭</span>
      </li>
    </ul>
  );
}
