import { useCallback, useEffect, useEffectEvent, useState } from 'react';

export type MotionStatus = 'unsupported' | 'needs-permission' | 'granted' | 'denied';

export interface MotionSample {
  /** 중력 포함 가속도(m/s²). 센서 값이 없는 이벤트는 샘플로 보내지 않는다 */
  acceleration: { x: number; y: number; z: number };
  /**
   * 중력을 뺀 가속도(m/s²). 흔드는 세기를 방향과 관계없이 잴 수 있다.
   * 자이로가 없어 중력을 분리하지 못하는 기기는 null
   */
  linearAcceleration: { x: number; y: number; z: number } | null;
  /**
   * 회전 속도(도/초). alpha는 화면에 수직인 축(z), beta는 x축, gamma는 y축 둘레.
   * 화면을 볼 때 반시계 방향 회전이 alpha의 양수다. 자이로가 없는 기기는 null
   */
  rotationRate: { alpha: number; beta: number; gamma: number } | null;
  /** 기기 방향(도) */
  orientation: { alpha: number; beta: number; gamma: number };
  /** 이벤트 시각(ms, performance.now와 같은 기준) */
  timestamp: number;
}

/** 센서 값 셋이 모두 있을 때만 벡터로. 하나라도 없으면(센서 없음) null */
function vectorOf(value: DeviceMotionEventAcceleration | null) {
  if (value?.x == null || value.y == null || value.z == null) return null;
  return { x: value.x, y: value.y, z: value.z };
}

function rotationOf(value: DeviceMotionEventRotationRate | null) {
  if (value?.alpha == null || value.beta == null || value.gamma == null) return null;
  return { alpha: value.alpha, beta: value.beta, gamma: value.gamma };
}

type PermissionCapable = { requestPermission?: () => Promise<'granted' | 'denied'> };

function initialStatus(): MotionStatus {
  if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return 'unsupported';
  const needsPrompt =
    typeof (DeviceMotionEvent as unknown as PermissionCapable).requestPermission === 'function';
  return needsPrompt ? 'needs-permission' : 'granted';
}

/**
 * DeviceMotion + DeviceOrientation 통합.
 * iOS에서는 requestPermission()을 탭 같은 사용자 제스처 안에서 호출해야 한다.
 * 데스크톱에서는 이벤트가 오지 않을 수 있으므로 게임 쪽에 대체 입력이 필요하다.
 */
export function useDeviceMotion(onSample: (sample: MotionSample) => void, enabled = true) {
  const [status, setStatus] = useState<MotionStatus>(initialStatus);
  // 항상 최신 onSample을 호출하되, onSample이 바뀌어도 이벤트를 다시 구독하지 않는다.
  const emitSample = useEffectEvent(onSample);

  const requestPermission = useCallback(async () => {
    const motion = DeviceMotionEvent as unknown as PermissionCapable;
    const orientation = DeviceOrientationEvent as unknown as PermissionCapable;
    if (typeof motion.requestPermission !== 'function') return;
    try {
      // 제스처가 유효한 동안 두 요청을 동시에 시작한다.
      const results = await Promise.all([
        motion.requestPermission(),
        orientation.requestPermission?.() ?? 'granted',
      ]);
      setStatus(results.every((r) => r === 'granted') ? 'granted' : 'denied');
    } catch {
      setStatus('denied');
    }
  }, []);

  useEffect(() => {
    if (!enabled || status !== 'granted') return;
    const orientation = { alpha: 0, beta: 0, gamma: 0 };
    const onOrientation = (e: DeviceOrientationEvent) => {
      orientation.alpha = e.alpha ?? 0;
      orientation.beta = e.beta ?? 0;
      orientation.gamma = e.gamma ?? 0;
    };
    const onMotion = (e: DeviceMotionEvent) => {
      // 스크립트가 만든 가짜 이벤트(dispatchEvent)로 점수를 올리지 못하게 한다
      if (!e.isTrusted) return;
      const acceleration = vectorOf(e.accelerationIncludingGravity);
      // 센서가 없는 기기(데스크톱 등)는 값이 모두 null인 이벤트를 보내기도 한다.
      // 0으로 바꿔 보내면 "중력 없음 = 세게 흔듦"으로 읽히므로 샘플로 치지 않는다.
      if (!acceleration) return;
      emitSample({
        acceleration,
        linearAcceleration: vectorOf(e.acceleration),
        rotationRate: rotationOf(e.rotationRate),
        orientation: { ...orientation },
        timestamp: e.timeStamp,
      });
    };
    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('devicemotion', onMotion);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('devicemotion', onMotion);
    };
  }, [enabled, status]);

  return { status, requestPermission };
}
