import { Countdown, type MotionStatus } from '@minigames/engine';
import type { ReactNode } from 'react';
import { DURATION_MS } from './rules.ts';

/** 센서 권한 상태에 따라 덧붙이는 안내 */
const PERMISSION_NOTES: Partial<Record<MotionStatus, string>> = {
  'needs-permission': '시작하면 동작 센서 사용 권한을 물어봐요.',
  denied: '동작 센서 권한이 없어 컵을 문질러서 흔들어요.',
};

interface ReadyFieldProps {
  /** 카운트다운 중이면 true, 시작 화면이면 false */
  isCounting: boolean;
  motionStatus: MotionStatus;
  onStart: () => void;
  /** 컵 그림. 시작 전에도 보여줘 무엇을 할지 바로 알 수 있게 한다 */
  children: ReactNode;
}

/** 시작 화면과 카운트다운: 컵 위에 안내·시작 버튼 또는 3·2·1을 겹쳐 보여준다 */
export function ReadyField({ isCounting, motionStatus, onStart, children }: ReadyFieldProps) {
  const note = PERMISSION_NOTES[motionStatus];
  return (
    <div className="bt-field">
      {children}
      <div className="bt-overlay">
        {isCounting ? (
          <Countdown />
        ) : (
          <>
            <p className="bt-guide">
              {DURATION_MS / 1_000}초 동안 폰을 흔들어 섞어요!
              <br />
              너무 세게 흔들면 넘쳐요.
            </p>
            <p className="mg-muted">센서가 없으면 컵을 문질러 흔들 수 있어요.</p>
            {note && <p className="mg-muted">{note}</p>}
            <button type="button" className="mg-button" onClick={onStart}>
              시작
            </button>
          </>
        )}
      </div>
    </div>
  );
}
