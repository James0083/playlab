let context: AudioContext | null = null;

/** 페이지 전체에서 AudioContext를 하나만 쓴다. 미지원 환경이면 null. */
export function getAudioContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  context ??= new AudioContext({ latencyHint: 'interactive' });
  return context;
}

/**
 * 오디오 잠금 해제. iOS Safari 등은 사용자 제스처 안에서 resume해야 소리가 난다.
 * 시작 버튼 같은 클릭·탭 핸들러 안에서 동기적으로 호출한다.
 */
export function unlockAudio(): void {
  const audio = getAudioContext();
  // iOS는 전화·백그라운드 뒤 'interrupted' 상태가 되기도 한다. 재생 중이 아니면 모두 다시 켠다
  if (audio && audio.state !== 'running') {
    audio.resume().catch((error: unknown) => console.warn('[engine] 오디오 잠금 해제 실패', error));
  }
}

/**
 * 한 판 동안 쓰는 출력 채널. dispose()하면 예약된 효과음까지 모두 끊긴다.
 * 판이 끝나거나 화면을 떠날 때 반드시 dispose()한다.
 */
export function createSoundBus(audio: AudioContext): { output: GainNode; dispose: () => void } {
  const output = audio.createGain();
  output.connect(audio.destination);
  return { output, dispose: () => output.disconnect() };
}

export interface ToneOptions {
  /** 재생 시각(AudioContext 시각, 초) */
  at: number;
  /** 시작 주파수(Hz) */
  frequency: number;
  /** 끝 주파수(Hz). 지정하면 재생 동안 이 값으로 미끄러진다 */
  endFrequency?: number;
  durationS: number;
  /** 0~1 */
  volume?: number;
  type?: OscillatorType;
}

const SILENT = 0.0001; // exponentialRamp는 0을 쓸 수 없어 아주 작은 값으로 끝낸다

/** 짧게 울리고 사라지는 음 하나를 예약한다. 합성음이라 음원 파일과 라이선스가 필요 없다. */
export function scheduleTone(output: AudioNode, options: ToneOptions): void {
  const { at, frequency, endFrequency, durationS, volume = 0.5, type = 'sine' } = options;
  const audio = output.context;
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, at);
  if (endFrequency !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + durationS);
  }
  envelope.gain.setValueAtTime(volume, at);
  envelope.gain.exponentialRampToValueAtTime(SILENT, at + durationS);

  oscillator.connect(envelope).connect(output);
  oscillator.start(at);
  oscillator.stop(at + durationS);
}

export interface NoiseOptions {
  at: number;
  durationS: number;
  volume?: number;
  /** 이 주파수(Hz) 위를 깎아 둔탁하게 만든다 */
  lowpassHz?: number;
}

/** 잡음은 이 길이까지 낼 수 있다. 효과음은 모두 이보다 짧다. */
const NOISE_BUFFER_S = 1;
// 잡음 버퍼는 컨텍스트마다 한 번만 만들어 재사용한다. 배경음악처럼 수백 개를 예약해도 메모리가 늘지 않는다.
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

function getNoiseBuffer(audio: BaseAudioContext): AudioBuffer {
  const cached = noiseBuffers.get(audio);
  if (cached) return cached;
  const buffer = audio.createBuffer(1, audio.sampleRate * NOISE_BUFFER_S, audio.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  noiseBuffers.set(audio, buffer);
  return buffer;
}

/** 짧은 잡음(타격음·헛스윙 바람 소리·북 가장자리 소리)을 예약한다. 최대 1초. */
export function scheduleNoise(output: AudioNode, options: NoiseOptions): void {
  const { at, durationS, volume = 0.5, lowpassHz = 2_000 } = options;
  const audio = output.context;
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const envelope = audio.createGain();
  source.buffer = getNoiseBuffer(audio);
  filter.type = 'lowpass';
  filter.frequency.value = lowpassHz;
  envelope.gain.setValueAtTime(volume, at);
  envelope.gain.exponentialRampToValueAtTime(SILENT, at + durationS);

  source.connect(filter).connect(envelope).connect(output);
  source.start(at, 0, Math.min(durationS, NOISE_BUFFER_S));
}
