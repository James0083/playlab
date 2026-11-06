import { getAudioContext, scheduleNoise, scheduleTone } from '@minigames/engine';

// 모든 효과음은 Web Audio로 합성한다(음원 파일 없음). 짧은 단발음이라 바로 스피커로 보낸다.

/** 오디오가 재생 가능할 때만 출력 노드를 돌려준다 */
function speaker(): { output: AudioNode; now: number } | null {
  const audio = getAudioContext();
  if (audio?.state !== 'running') return null;
  return { output: audio.destination, now: audio.currentTime };
}

/** 금 가는 소리: 짧고 날카로운 "딱" */
export function playCrack(): void {
  const out = speaker();
  if (!out) return;
  const { output, now: at } = out;
  scheduleNoise(output, { at, durationS: 0.12, volume: 0.5, lowpassHz: 3_000 });
  scheduleTone(output, {
    at,
    frequency: 1_800,
    endFrequency: 500,
    durationS: 0.08,
    volume: 0.08,
    type: 'square',
  });
}

/** 깨지는 소리: 길게 부서지는 잡음 + 떨어지는 저음 */
export function playBreak(): void {
  const out = speaker();
  if (!out) return;
  const { output, now: at } = out;
  scheduleNoise(output, { at, durationS: 0.4, volume: 0.6, lowpassHz: 1_500 });
  scheduleTone(output, { at, frequency: 300, endFrequency: 80, durationS: 0.4, volume: 0.2 });
}

/** 완성 효과음: 올라가는 세 음 (G5 B5 D6) */
const COMPLETE_NOTES_HZ = [784, 988, 1_175];
const NOTE_GAP_S = 0.1;

export function playComplete(): void {
  const out = speaker();
  if (!out) return;
  COMPLETE_NOTES_HZ.forEach((frequency, i) => {
    scheduleTone(out.output, {
      at: out.now + i * NOTE_GAP_S,
      frequency,
      durationS: 0.25,
      volume: 0.15,
      type: 'triangle',
    });
  });
}
