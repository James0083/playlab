import { StartOverlay, type MotionStatus } from '@minigames/engine';
import { useState, type ReactNode } from 'react';
import { SPIN_MS } from './rules.ts';

const SPIN_SECONDS_TEXT = `${SPIN_MS / 1_000}초`;

/** 센서 권한 상태에 따라 덧붙이는 안내 */
const PERMISSION_NOTES: Partial<Record<MotionStatus, string>> = {
  'needs-permission': '시작하면 동작 센서 사용 권한을 물어봐요.',
  denied: '동작 센서 권한이 없어 화면을 눌러 플레이해요.',
};

/** 손가락이 주 입력인 기기(폰·태블릿)인지. 시작 안내 문구만 고르는 용도다 */
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
  /** 판과 팽이 그림. 시작 전에도 보여줘 무엇을 할지 바로 알 수 있게 한다 */
  children: ReactNode;
}

/** 시작 화면과 카운트다운: 판 위에 안내·시작 버튼 또는 3·2·1을 겹쳐 보여준다 */
export function ReadyField({
  isCounting,
  motionStatus,
  notice,
  onStart,
  children,
}: ReadyFieldProps) {
  const [isTouch] = useState(isTouchDevice);
  const canUsePhone = isTouch && motionStatus !== 'unsupported' && motionStatus !== 'denied';
  const permissionNote = isTouch ? PERMISSION_NOTES[motionStatus] : undefined;

  return (
    <div className="pg-field">
      {children}
      <StartOverlay isCounting={isCounting} notice={notice} onStart={onStart}>
        <p className="pg-steps">
          <span>
            <strong>① 돌리기 {SPIN_SECONDS_TEXT}</strong>
            {canUsePhone ? '폰을 원 그리듯 한 방향으로' : '점선 위에 한 방향으로 원 그리기'}
          </span>
          <span>
            <strong>② 균형</strong>
            {canUsePhone ? '폰을 기울여 팽이를 가운데에' : '팽이 반대쪽을 눌러 가운데로'}
          </span>
        </p>
        {!canUsePhone && <p className="mg-muted">키보드는 ↑→↓← 차례로, 방향키로 기울이기</p>}
        <p className="mg-muted">오래 버틸수록 높은 점수예요</p>
        {permissionNote && <p className="mg-muted">{permissionNote}</p>}
      </StartOverlay>
    </div>
  );
}
