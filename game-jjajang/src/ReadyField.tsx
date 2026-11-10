import { Countdown, type MotionStatus } from '@minigames/engine';
import { useState, type ReactNode } from 'react';
import { CLUMP_FROM_TURNS, DURATION_MS, SWITCH_MIN_TURNS } from './rules.ts';

const SECONDS_TEXT = `${DURATION_MS / 1_000}초`;

/** 센서 권한 상태에 따라 덧붙이는 안내 */
const PERMISSION_NOTES: Partial<Record<MotionStatus, string>> = {
  'needs-permission': '시작하면 동작 센서 사용 권한을 물어봐요.',
  denied: '동작 센서 권한이 없어 화면에 원을 그려 비벼요.',
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
  /** 그릇 그림. 시작 전에도 보여줘 무엇을 할지 바로 알 수 있게 한다 */
  children: ReactNode;
}

/** 시작 화면과 카운트다운: 그릇 위에 안내·시작 버튼 또는 3·2·1을 겹쳐 보여준다 */
export function ReadyField({
  isCounting,
  motionStatus,
  notice,
  onStart,
  children,
}: ReadyFieldProps) {
  const [isTouch] = useState(isTouchDevice);
  const canTurnPhone = isTouch && motionStatus !== 'unsupported' && motionStatus !== 'denied';
  // 데스크톱 Chrome도 권한 함수를 갖고 있어 'needs-permission'이 되지만 돌릴 폰이 없으니 안내하지 않는다
  const permissionNote = isTouch ? PERMISSION_NOTES[motionStatus] : undefined;

  return (
    <div className="jj-field">
      {children}
      <div className="jj-overlay">
        {isCounting ? (
          <Countdown />
        ) : (
          <>
            {notice && (
              <p className="jj-notice" role="status">
                {notice}
              </p>
            )}
            {canTurnPhone ? (
              <p className="jj-guide">
                {SECONDS_TEXT} 동안 폰을 원 그리듯 돌려
                <br />
                짜장면을 비벼요! (화면에 그려도 돼요)
              </p>
            ) : (
              <p className="jj-guide">
                {SECONDS_TEXT} 동안 그릇 위에 원을 그려
                <br />
                짜장면을 비벼요! (↑→↓← 키도 돼요)
              </p>
            )}
            <p className="jj-rule">
              한쪽으로 {SWITCH_MIN_TURNS}~{CLUMP_FROM_TURNS}바퀴 돌리고 <strong>반대로!</strong>
              <br />
              계속 한쪽으로만 돌리면 면이 뭉쳐요
            </p>
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
