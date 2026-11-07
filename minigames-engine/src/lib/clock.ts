/** AudioContext 중 시계에 필요한 부분. 테스트에서 가짜로 바꿔 끼울 수 있게 좁혀 둔다. */
export interface AudioTimeSource {
  readonly currentTime: number;
  readonly state: AudioContextState;
  /** 소리가 실제로 스피커에서 나기까지 걸리는 시간(초). 블루투스 이어폰이면 0.1~0.3초 */
  readonly baseLatency?: number;
  readonly outputLatency?: number;
}

export interface GameClock {
  /** 시계를 만든 뒤 지난 시간(ms) */
  elapsedMs: () => number;
  /**
   * 경과 시간(ms)을 AudioContext 시각(초)으로 바꾼다. 효과음을 미리 예약할 때 쓴다.
   * 오디오를 쓸 수 없으면 null.
   */
  toAudioTime: (elapsedMs: number) => number | null;
}

const MS_PER_SECOND = 1_000;

/**
 * 게임 판정과 애니메이션, 효과음이 함께 쓰는 시계.
 *
 * 오디오가 재생 중이면 AudioContext 시각을 기준으로 한다. 예약한 효과음과 판정이 같은 시계를 써야
 * BPM이 바뀌어도 소리와 화면이 어긋나지 않는다. 오디오가 막혀 있으면(권한 거부, 미지원)
 * performance.now로 대체한다. 멈춘 AudioContext의 시각은 흐르지 않기 때문이다.
 */
export function createGameClock(
  audio: AudioTimeSource | null,
  now: () => number = () => performance.now(),
): GameClock {
  if (audio?.state === 'running') {
    const startS = audio.currentTime;
    // 예약한 소리는 출력 지연만큼 늦게 들린다. 경과 시간을 그만큼 늦춰 화면·판정을 들리는 소리에 맞춘다.
    const latencyS = (audio.baseLatency ?? 0) + (audio.outputLatency ?? 0);
    return {
      elapsedMs: () => (audio.currentTime - startS - latencyS) * MS_PER_SECOND,
      toAudioTime: (elapsedMs) => startS + elapsedMs / MS_PER_SECOND,
    };
  }

  const startMs = now();
  return {
    elapsedMs: () => now() - startMs,
    toAudioTime: () => null,
  };
}
