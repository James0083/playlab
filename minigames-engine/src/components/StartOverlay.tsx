import type { ReactNode } from 'react';
import { Countdown } from './Countdown.tsx';

interface StartOverlayProps {
  /** 카운트다운 중이면 안내 카드 대신 가운데에 3·2·1을 보여준다 */
  isCounting: boolean;
  /** 카드 위에 보여줄 안내(예: 다른 화면으로 나가 판이 멈춤). 없으면 빈 문자열 */
  notice?: string;
  /** 카드 위치. 장면의 중요한 부분을 가리지 않는 쪽에 둔다. 기본은 아래 */
  align?: 'bottom' | 'center' | 'top';
  startLabel?: string;
  onStart: () => void;
  /** 안내 문구(`mg-start-guide` 문단 등) */
  children: ReactNode;
}

/**
 * 시작 화면 공통 카드. 게임 장면(그림) 위에 겹쳐 놓되 그림은 가리지 않고 카드에만 반투명 바탕을 깐다.
 * 모든 게임이 같은 카드와 같은 크기의 시작 버튼을 써서 첫 화면이 한 서비스처럼 보이게 한다(2026-11-11).
 */
export function StartOverlay({
  isCounting,
  notice = '',
  align = 'bottom',
  startLabel = '시작',
  onStart,
  children,
}: StartOverlayProps) {
  if (isCounting) {
    return (
      <div className="mg-start mg-start-center">
        <Countdown />
      </div>
    );
  }
  return (
    <div className={`mg-start mg-start-${align}`}>
      <div className="mg-start-card">
        {notice && (
          <p className="mg-notice" role="status">
            {notice}
          </p>
        )}
        {children}
        <button type="button" className="mg-button mg-button-wide" onClick={onStart}>
          {startLabel}
        </button>
      </div>
    </div>
  );
}
