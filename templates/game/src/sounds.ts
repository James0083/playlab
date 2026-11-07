import { getAudioContext, scheduleTone } from '@minigames/engine';

// 효과음은 Web Audio로 합성한다. 음원 파일이 없어 라이선스 확인과 다운로드가 필요 없다.
// 소리를 쓰지 않는 게임이면 이 파일을 지운다.

/** 오디오가 재생 가능할 때만 출력 노드와 지금 시각(초)을 돌려준다 */
function speaker(): { output: AudioNode; now: number } | null {
  const audio = getAudioContext();
  if (audio?.state !== 'running') return null;
  return { output: audio.destination, now: audio.currentTime };
}

/** 탭 소리: 짧고 맑은 "톡" (A5) */
export function playTapSound(): void {
  const out = speaker();
  if (!out) return;
  scheduleTone(out.output, { at: out.now, frequency: 880, durationS: 0.08, volume: 0.2 });
}
