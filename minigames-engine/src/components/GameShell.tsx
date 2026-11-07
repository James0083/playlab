import { useEffect, useEffectEvent, type ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary.tsx';

interface GameShellProps {
  title: string;
  score?: number;
  remainingMs?: number | null;
  /**
   * 남은 시간이 이 이하(ms)이면 빨갛게 맥동시켜 긴장감을 준다. 기본 10초.
   * 플레이 시간이 짧은 게임(예: 10초)은 처음부터 빨갛지 않도록 줄인다.
   */
  urgentMs?: number;
  /**
   * 뒤로 가기(헤더 버튼, ESC 키). 넘기지 않으면 버튼이 보이지 않는다.
   * 보통 플레이 중이면 시작 화면으로, 시작 화면이면 홈(goHome)으로 보낸다.
   */
  onBack?: () => void;
  children: ReactNode;
}

const DEFAULT_URGENT_MS = 10_000;

/**
 * 글자를 입력하는 중의 ESC인지. 닉네임을 쓰다(한글 조합 취소 포함) ESC를 누르면
 * 결과 화면을 떠나 기록을 등록하지 못했다.
 */
function isTyping(event: KeyboardEvent): boolean {
  if (event.isComposing || event.defaultPrevented) return true;
  const target = event.target;
  return target instanceof Element && target.closest('input, textarea, [contenteditable]') !== null;
}

export function GameShell({
  title,
  score,
  remainingMs,
  urgentMs = DEFAULT_URGENT_MS,
  onBack,
  children,
}: GameShellProps) {
  const hasBack = onBack !== undefined;
  // 최신 onBack을 부르되, onBack이 바뀔 때마다 키 이벤트를 다시 구독하지 않는다
  const handleBack = useEffectEvent(() => onBack?.());

  useEffect(() => {
    if (!hasBack) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isTyping(event)) return;
      handleBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasBack]);

  return (
    <div className="mg-shell">
      <header className="mg-header">
        {hasBack && (
          <button type="button" className="mg-back" aria-label="뒤로 가기 (Esc)" onClick={onBack}>
            ←
          </button>
        )}
        <h1 className="mg-title">{title}</h1>
        <div className="mg-hud">
          {remainingMs != null && (
            <span className={remainingMs <= urgentMs ? 'mg-time mg-time-urgent' : 'mg-time'}>
              {Math.ceil(remainingMs / 1000)}초
            </span>
          )}
          {score != null && <strong>{score}점</strong>}
        </div>
      </header>
      <main className="mg-stage">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
