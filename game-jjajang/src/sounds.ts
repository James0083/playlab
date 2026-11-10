import { getAudioContext, scheduleNoise, scheduleTone } from '@minigames/engine';

// 효과음은 Web Audio로 합성한다. 음원 파일이 없어 라이선스 확인과 다운로드가 필요 없다.

/** 오디오가 재생 가능할 때만 출력 노드와 지금 시각(초)을 돌려준다 */
function speaker(): { output: AudioNode; now: number } | null {
  const audio = getAudioContext();
  if (audio?.state !== 'running') return null;
  return { output: audio.destination, now: audio.currentTime };
}

/**
 * 면을 휘젓는 "척": 낮고 짧은 잡음. 비빌수록(mix 0~1) 소스가 묻어 더 둔탁해진다.
 * 돌리는 동안 자주 불리므로 부르는 쪽에서 간격을 둔다
 */
export function playStir(mix: number): void {
  const out = speaker();
  if (!out) return;
  scheduleNoise(out.output, {
    at: out.now,
    durationS: 0.06,
    volume: 0.25,
    lowpassHz: 1_400 - 700 * mix,
  });
}

/** 방향 바꾸기 인정 "뾱": 짧게 올라가는 음 */
export function playSwitch(): void {
  const out = speaker();
  if (!out) return;
  scheduleTone(out.output, {
    at: out.now,
    frequency: 660,
    endFrequency: 990,
    durationS: 0.09,
    volume: 0.2,
    type: 'triangle',
  });
}

/**
 * 면이 뭉치기 시작할 때 경고: 낮게 두 번 "뚱뚱". 돌리는 동안은 화면을 보기 어려워
 * 뭉치는 구간에 들어가는 순간을 소리로 알린다
 */
export function playClump(): void {
  const out = speaker();
  if (!out) return;
  [0, 0.11].forEach((offsetS) => {
    scheduleTone(out.output, {
      at: out.now + offsetS,
      frequency: 220,
      endFrequency: 180,
      durationS: 0.09,
      volume: 0.28,
      type: 'square',
    });
  });
}

/** 다 비볐을 때(100%) "띵": 맑은 음 하나(A6) */
export function playFullyMixed(): void {
  const out = speaker();
  if (!out) return;
  scheduleTone(out.output, { at: out.now, frequency: 1_760, durationS: 0.35, volume: 0.2 });
}

/** 면을 들어 올리는 "후루룩" + 완성 효과음(올라가는 두 음: C6 E6) */
export function playFinish(): void {
  const out = speaker();
  if (!out) return;
  scheduleNoise(out.output, { at: out.now, durationS: 0.35, volume: 0.3, lowpassHz: 2_500 });
  [1_047, 1_319].forEach((frequency, i) => {
    scheduleTone(out.output, {
      at: out.now + 0.3 + i * 0.1,
      frequency,
      durationS: 0.25,
      volume: 0.15,
      type: 'triangle',
    });
  });
}
