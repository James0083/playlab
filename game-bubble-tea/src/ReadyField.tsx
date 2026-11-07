import { Countdown, type MotionStatus } from '@minigames/engine';
import { useState, type ReactNode } from 'react';
import { DURATION_MS } from './rules.ts';

const SECONDS_TEXT = `${DURATION_MS / 1_000}초`;

/** 센서 권한 상태에 따라 덧붙이는 안내 */
const PERMISSION_NOTES: Partial<Record<MotionStatus, string>> = {
  'needs-permission': '시작하면 동작 센서 사용 권한을 물어봐요.',
  denied: '동작 센서 권한이 없어 컵을 문질러 섞어요.',
};

/**
 * 손가락이 주 입력인 기기(폰·태블릿)인지. 시작 안내 문구만 고르는 용도다.
 * 실제 입력 방식은 카운트다운 동안 센서 값이 오는지로 정한다
 */
function isTouchDevice(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

interface ReadyFieldProps {
  /** 카운트다운 중이면 true, 시작 화면이면 false */
  isCounting: boolean;
  motionStatus: MotionStatus;
  /** 시작 화면 위쪽에 보여줄 안내(예: 다른 화면으로 나가 판이 멈춤). 없으면 빈 문자열 */
  notice: string;
  onStart: () => void;
  /** 컵 그림. 시작 전에도 보여줘 무엇을 할지 바로 알 수 있게 한다 */
  children: ReactNode;
}

/** 시작 화면과 카운트다운: 컵 위에 안내·시작 버튼 또는 3·2·1을 겹쳐 보여준다 */
export function ReadyField({
  isCounting,
  motionStatus,
  notice,
  onStart,
  children,
}: ReadyFieldProps) {
  const [isTouch] = useState(isTouchDevice);
  const canShakePhone = isTouch && motionStatus !== 'unsupported' && motionStatus !== 'denied';
  // 데스크톱 Chrome도 권한 함수를 갖고 있어 'needs-permission'이 되지만 흔들 폰이 없으니 안내하지 않는다
  const permissionNote = isTouch ? PERMISSION_NOTES[motionStatus] : undefined;

  return (
    <div className="bt-field">
      {children}
      <div className="bt-overlay">
        {isCounting ? (
          <Countdown />
        ) : (
          <>
            {notice && (
              <p className="bt-notice" role="status">
                {notice}
              </p>
            )}
            {canShakePhone ? (
              <p className="bt-guide">
                {SECONDS_TEXT} 동안 폰을 흔들어 섞어요!
                <br />
                세게 흔들면 넘쳐요.
              </p>
            ) : (
              <p className="bt-guide">
                {SECONDS_TEXT} 동안 컵을 누른 채
                <br />
                좌우로 문질러 섞어요! (←→ 키도 돼요)
              </p>
            )}
            <p className="mg-muted">소리를 켜면 넘치기 전에 알려 줘요 🔊</p>
            {permissionNote && <p className="mg-muted">{permissionNote}</p>}
            <button type="button" className="mg-button" onClick={onStart}>
              시작
            </button>
          </>
        )}
      </div>
    </div>
  );
}
