import { scheduleNoise, scheduleTone } from '@minigames/engine';
import type { Judgement } from './rules.ts';

// 모든 효과음은 Web Audio로 합성한다. 음원 파일이 없어 라이선스 확인이 필요 없다.
// "よーい" 음성은 쓰지 않고 말풍선으로 보여준다(cues.ts). 음성은 추후 추가 사항이다.
// 박자 안내는 배경음악의 북소리가 맡는다(music.ts).

/** 떡을 치는 둔탁한 소리: 아래로 미끄러지는 저음 + 짧은 타격 잡음 */
function scheduleThud(output: AudioNode, { at, volume }: { at: number; volume: number }): void {
  scheduleTone(output, { at, frequency: 140, endFrequency: 45, durationS: 0.18, volume });
  scheduleNoise(output, { at, durationS: 0.06, volume: volume * 0.5, lowpassHz: 600 });
}

const HIT_SOUNDS: Record<Judgement, (output: AudioNode, at: number) => void> = {
  PERFECT: (output, at) => {
    scheduleThud(output, { at, volume: 0.9 });
    // 정확히 맞혔을 때만 맑은 음을 얹어 GOOD과 구별되게 한다
    scheduleTone(output, { at, frequency: 880, durationS: 0.15, volume: 0.15 });
  },
  GOOD: (output, at) => scheduleThud(output, { at, volume: 0.6 }),
  MISS: (output, at) =>
    scheduleNoise(output, { at, durationS: 0.15, volume: 0.2, lowpassHz: 4_000 }),
};

/** 탭 판정 결과에 맞는 소리를 바로 재생한다. */
export function playHitSound(output: AudioNode, judgement: Judgement): void {
  HIT_SOUNDS[judgement](output, output.context.currentTime);
}
