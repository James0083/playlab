import { getAudioContext, scheduleNoise, scheduleTone } from '@minigames/engine';

// 효과음은 Web Audio로 합성한다. 음원 파일이 없어 라이선스 확인과 다운로드가 필요 없다.

/** 오디오가 재생 가능할 때만 출력 노드와 지금 시각(초)을 돌려준다 */
function speaker(): { output: AudioNode; now: number } | null {
  const audio = getAudioContext();
  if (audio?.state !== 'running') return null;
  return { output: audio.destination, now: audio.currentTime };
}

/** 돌릴 때 "휙": 빠를수록(strength 0~1) 밝다. 부르는 쪽에서 간격을 둔다 */
export function playWhoosh(strength: number): void {
  const out = speaker();
  if (!out) return;
  scheduleNoise(out.output, {
    at: out.now,
    durationS: 0.07,
    volume: 0.2,
    lowpassHz: 800 + 2_400 * strength,
  });
}

/**
 * 팽이가 도는 "윙": 회전이 빠를수록(strength 0~1) 높은 음. 균형 단계에서 일정한 간격으로 부른다.
 * 소리가 낮아지면 느려진 것이라 화면을 보지 않아도 알 수 있다
 */
export function playHum(strength: number): void {
  const out = speaker();
  if (!out) return;
  scheduleTone(out.output, {
    at: out.now,
    frequency: 140 + 360 * strength,
    durationS: 0.2,
    volume: 0.08,
    type: 'triangle',
  });
}

/** 팽이를 판에 내려놓는 "탁" */
export function playLand(): void {
  const out = speaker();
  if (!out) return;
  scheduleNoise(out.output, { at: out.now, durationS: 0.05, volume: 0.35, lowpassHz: 1_800 });
  scheduleTone(out.output, { at: out.now, frequency: 220, durationS: 0.08, volume: 0.15 });
}

/** 가장자리에 다가갈 때 경고: 짧게 두 번 */
export function playEdgeWarning(): void {
  const out = speaker();
  if (!out) return;
  [0, 0.1].forEach((offsetS) => {
    scheduleTone(out.output, {
      at: out.now + offsetS,
      frequency: 660,
      durationS: 0.06,
      volume: 0.18,
      type: 'square',
    });
  });
}

/** 쓰러지는 소리: 덜그럭 + 내려가는 음 */
export function playFall(): void {
  const out = speaker();
  if (!out) return;
  [0, 0.08, 0.18].forEach((offsetS, i) => {
    scheduleNoise(out.output, {
      at: out.now + offsetS,
      durationS: 0.05,
      volume: 0.3 - i * 0.08,
      lowpassHz: 1_500,
    });
  });
  scheduleTone(out.output, {
    at: out.now,
    frequency: 400,
    endFrequency: 120,
    durationS: 0.4,
    volume: 0.15,
  });
}
