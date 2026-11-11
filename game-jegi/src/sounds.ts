import { getAudioContext, scheduleNoise, scheduleTone } from '@minigames/engine';
import type { Judgement } from './rules.ts';

// 효과음은 Web Audio로 합성한다. 음원 파일이 없어 라이선스 확인과 다운로드가 필요 없다.

/** 오디오가 재생 가능할 때만 출력 노드와 지금 시각(초)을 돌려준다 */
function speaker(): { output: AudioNode; now: number } | null {
  const audio = getAudioContext();
  if (audio?.state !== 'running') return null;
  return { output: audio.destination, now: audio.currentTime };
}

/** 발등으로 차는 "탁". PERFECT는 맑은 소리가 한 겹 더 붙는다 */
export function playKick(judgement: Judgement): void {
  const out = speaker();
  if (!out) return;
  scheduleNoise(out.output, { at: out.now, durationS: 0.05, volume: 0.3, lowpassHz: 1_500 });
  scheduleTone(out.output, { at: out.now, frequency: 200, durationS: 0.09, volume: 0.2 });
  if (judgement === 'PERFECT') {
    scheduleTone(out.output, {
      at: out.now + 0.03,
      frequency: 1_320,
      durationS: 0.1,
      volume: 0.12,
      type: 'triangle',
    });
  }
}

/** 제기가 땅에 떨어지는 "툭" */
export function playDrop(): void {
  const out = speaker();
  if (!out) return;
  scheduleNoise(out.output, { at: out.now, durationS: 0.08, volume: 0.25, lowpassHz: 700 });
  scheduleTone(out.output, {
    at: out.now,
    frequency: 150,
    durationS: 0.12,
    volume: 0.18,
    type: 'triangle',
  });
}
