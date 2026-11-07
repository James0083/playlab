import type { RefObject } from 'react';
import { callAt, speedUpNoticeAt } from './cues.ts';
import { malletHeight, type Judgement } from './rules.ts';
import { drawMallet, Scene, type SceneElements } from './Scene.tsx';

export interface TapFeedback {
  /** 탭마다 증가한다. 같은 판정이 연속돼도 이펙트가 다시 재생되도록 key로 쓴다 */
  id: number;
  judgement: Judgement;
  /** 이 탭 뒤의 연속 성공 수와 점수 배율 */
  combo: number;
  multiplier: number;
}

/** 플레이를 시작하는 순간 떡메 높이. 첫 박자 전에는 가장 높이 들려 있다(떡에 닿아 보이면 일찍 치게 된다) */
const START_MALLET_HEIGHT = 1;

/** 키보드로 칠 때 쓰는 키. 꾹 누르고 있을 때의 자동 반복은 무시한다 */
const TAP_KEYS = new Set([' ', 'Enter']);

/** 매 프레임 직접 갱신하는 요소들. React 상태로 다루면 초당 60번 다시 렌더링하게 된다 */
export interface FieldElements extends SceneElements {
  call: HTMLDivElement | null;
  speedUp: HTMLDivElement | null;
}

export interface FrameState {
  elapsedMs: number;
  /** 마지막으로 탭한 시각(ms). 없으면 null */
  lastStrikeMs: number | null;
}

/** 한 프레임을 그린다: 떡메 높이, 요-이 말풍선, 속도 증가 알림 */
export function drawFrame(elements: FieldElements, beats: readonly number[], frame: FrameState) {
  drawMallet(elements, malletHeight(beats, frame));

  const { call, speedUp } = elements;
  if (call) {
    const { text, isPeak } = callAt(beats, frame.elapsedMs);
    // 글자가 바뀔 때만 DOM을 건드려 매 프레임 레이아웃 계산을 피한다
    if (call.textContent !== text) call.textContent = text;
    call.classList.toggle('tt-call-visible', text !== '');
    call.classList.toggle('tt-call-peak', isPeak);
  }
  if (speedUp) {
    const notice = speedUpNoticeAt(frame.elapsedMs) ?? '';
    if (speedUp.textContent !== notice) speedUp.textContent = notice;
    speedUp.classList.toggle('tt-speed-up-visible', notice !== '');
  }
}

interface PlayFieldProps {
  elementsRef: RefObject<FieldElements>;
  feedback: TapFeedback | null;
  onTap: () => void;
}

/** 떡치기 장면과 말풍선·판정 문구를 겹쳐 그리는 플레이 영역. 화면 어디를 탭해도 판정한다 */
export function PlayField({ elementsRef, feedback, onTap }: PlayFieldProps) {
  const hitId = feedback !== null && feedback.judgement !== 'MISS' ? feedback.id : null;

  return (
    <button
      type="button"
      className="tt-field"
      aria-label="떡 치기 (탭, 스페이스, 엔터)"
      onPointerDown={onTap}
      onKeyDown={(event) => {
        if (!TAP_KEYS.has(event.key) || event.repeat) return;
        event.preventDefault();
        onTap();
      }}
      // 플레이가 시작되면 바로 키보드로 칠 수 있게 한다
      autoFocus
    >
      <Scene elementsRef={elementsRef} hitId={hitId} restHeight={START_MALLET_HEIGHT} />
      {feedback && (
        <span
          key={feedback.id}
          className={`tt-judgement tt-judgement-${feedback.judgement.toLowerCase()}`}
          role="status"
        >
          {feedback.judgement}
        </span>
      )}
      {feedback && feedback.combo >= 2 && (
        <span key={`combo-${feedback.id}`} className="tt-combo" aria-hidden="true">
          {feedback.combo} 콤보{feedback.multiplier > 1 && ` ×${feedback.multiplier}`}
        </span>
      )}
      {/* 말풍선과 속도 알림은 매 프레임 바뀌므로 스크린리더에는 읽히지 않게 한다 */}
      <div
        ref={(node) => {
          elementsRef.current.speedUp = node;
        }}
        className="tt-speed-up"
        aria-hidden="true"
      />
      <div
        ref={(node) => {
          elementsRef.current.call = node;
        }}
        className="tt-call"
        aria-hidden="true"
      />
    </button>
  );
}
