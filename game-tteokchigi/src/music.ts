import { scheduleNoise, scheduleTone } from '@minigames/engine';

// 배경음악은 박자표(beats)에 맞춰 합성한다. BPM이 오르면 음악도 같이 빨라진다.
// 정점(박자) = 북 "동", 바닥(반박자) = 북 가장자리 "딱". 북소리가 곧 탭 타이밍이다.

export type MusicVoice = 'don' | 'donAccent' | 'ka' | 'melody';

export interface MusicEvent {
  voice: MusicVoice;
  /** 플레이 시작 기준 시각(ms) */
  atMs: number;
  /** melody만 쓴다(Hz) */
  frequency?: number;
}

/** 4박마다 첫 박을 세게 쳐 마디감을 준다 */
const BEATS_PER_BAR = 4;
/**
 * 일본 축제풍 5음계(요나누키 장음계: 레·미·솔·라·시) 멜로디. 8박마다 반복한다.
 * D5 E5 G5 E5 A5 G5 E5 D5
 */
const MELODY_HZ = [587, 659, 784, 659, 880, 784, 659, 587];
/** 멜로디의 으뜸음(D5) */
const ROOT_HZ = 587;

/** 박자표로 배경음악 악보를 만든다. 소리 없이 테스트할 수 있도록 순수 함수로 둔다. */
export function composeBackgroundMusic(beats: readonly number[]): MusicEvent[] {
  return beats.flatMap((beat, index) => {
    const previous = beats[index - 1] ?? 0;
    return [
      { voice: 'ka', atMs: (previous + beat) / 2 },
      { voice: index % BEATS_PER_BAR === 0 ? 'donAccent' : 'don', atMs: beat },
      { voice: 'melody', atMs: beat, frequency: MELODY_HZ[index % MELODY_HZ.length] },
    ] satisfies MusicEvent[];
  });
}

const VOICES: Record<
  MusicVoice,
  (output: AudioNode, event: { at: number; frequency?: number }) => void
> = {
  don: (output, { at }) => {
    scheduleTone(output, { at, frequency: 110, endFrequency: 60, durationS: 0.25, volume: 0.35 });
  },
  donAccent: (output, { at }) => {
    scheduleTone(output, { at, frequency: 110, endFrequency: 55, durationS: 0.3, volume: 0.55 });
    scheduleNoise(output, { at, durationS: 0.04, volume: 0.2, lowpassHz: 400 });
  },
  ka: (output, { at }) => {
    scheduleNoise(output, { at, durationS: 0.03, volume: 0.1, lowpassHz: 5_000 });
  },
  melody: (output, { at, frequency = ROOT_HZ }) => {
    scheduleTone(output, { at, frequency, durationS: 0.28, volume: 0.07, type: 'triangle' });
  },
};

/**
 * 악보 전체를 미리 예약한다. 예약된 소리는 output을 dispose하면 함께 멈춘다.
 * toAudioTime이 null을 돌려주면(오디오 사용 불가) 해당 소리는 건너뛴다.
 */
export function scheduleBackgroundMusic(
  output: AudioNode,
  events: readonly MusicEvent[],
  toAudioTime: (elapsedMs: number) => number | null,
): void {
  for (const event of events) {
    const at = toAudioTime(event.atMs);
    if (at !== null) VOICES[event.voice](output, { at, frequency: event.frequency });
  }
}
