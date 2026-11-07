import { useEffect, useEffectEvent, type ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary.tsx';

interface GameShellProps {
  title: string;
  score?: number;
  remainingMs?: number | null;
  /**
   * 뒤로 가기(헤더 버튼, ESC 키). 넘기지 않으면 버튼이 보이지 않는다.
   * 보통 플레이 중이면 시작 화면으로, 시작 화면이면 홈(goHome)으로 보낸다.
   */
  onBack?: () => void;
  children: ReactNode;
}

/** 남은 시간이 이 이하이면 빨갛게 맥동시켜 긴장감을 준다 */
const URGENT_MS = 10_000;

export function GameShell({ title, score, remainingMs, onBack, children }: GameShellProps) {
  const hasBack = onBack !== undefined;
  // 최신 onBack을 부르되, onBack이 바뀔 때마다 키 이벤트를 다시 구독하지 않는다
  const handleBack = useEffectEvent(() => onBack?.());

  useEffect(() => {
    if (!hasBack) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleBack();
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
            <span className={remainingMs <= URGENT_MS ? 'mg-time mg-time-urgent' : 'mg-time'}>
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
