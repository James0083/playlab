import { getAudioContext, scheduleNoise, scheduleTone } from '@minigames/engine';

// 효과음은 Web Audio로 합성한다. 음원 파일이 없어 라이선스 확인과 다운로드가 필요 없다.

/** 오디오가 재생 가능할 때만 출력 노드와 지금 시각(초)을 돌려준다 */
function speaker(): { output: AudioNode; now: number } | null {
  const audio = getAudioContext();
  if (audio?.state !== 'running') return null;
  return { output: audio.destination, now: audio.currentTime };
}

/** 가장 세게 흔들 때 달그락 소리 크기 */
const RATTLE_MAX_VOLUME = 0.35;

/**
 * 펄과 얼음이 컵에 부딪는 "달그락". strength(0~1)가 클수록 크고 밝게 들린다.
 * 흔드는 동안 자주 불리므로 부르는 쪽에서 간격을 둔다.
 */
export function playRattle(strength: number): void {
  const out = speaker();
  if (!out) return;
  scheduleNoise(out.output, {
    at: out.now,
    durationS: 0.05,
    volume: RATTLE_MAX_VOLUME * strength,
    lowpassHz: 1_500 + 4_000 * strength,
  });
}

/** 넘치는 소리: 출렁이며 쏟아지는 잡음 + 미끄러지는 저음 */
export function playSpill(): void {
  const out = speaker();
  if (!out) return;
  scheduleNoise(out.output, { at: out.now, durationS: 0.3, volume: 0.4, lowpassHz: 900 });
  scheduleTone(out.output, {
    at: out.now,
    frequency: 400,
    endFrequency: 150,
    durationS: 0.25,
    volume: 0.12,
  });
}

/** 빨대를 꽂는 "뽁" + 완성 효과음(올라가는 두 음: C6 E6) */
export function playFinish(): void {
  const out = speaker();
  if (!out) return;
  scheduleTone(out.output, {
    at: out.now,
    frequency: 220,
    endFrequency: 660,
    durationS: 0.08,
    volume: 0.3,
  });
  [1_047, 1_319].forEach((frequency, i) => {
    scheduleTone(out.output, {
      at: out.now + 0.12 + i * 0.1,
      frequency,
      durationS: 0.25,
      volume: 0.15,
      type: 'triangle',
    });
  });
}
