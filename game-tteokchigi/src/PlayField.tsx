import type { RefObject } from 'react';
import { callAt, speedUpNoticeAt } from './cues.ts';
import { malletHeight, type Judgement } from './rules.ts';
import { drawMallet, Scene, type SceneElements } from './Scene.tsx';

export interface TapFeedback {
  /** 탭마다 증가한다. 같은 판정이 연속돼도 이펙트가 다시 재생되도록 key로 쓴다 */
  id: number;
  judgement: Judgement;
}

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

/** 한 프레임을 그린다: 떡메 높이, よーい 말풍선, 속도 증가 알림 */
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
    <button type="button" className="tt-field" aria-label="떡 치기" onPointerDown={onTap}>
      <Scene elementsRef={elementsRef} hitId={hitId} />
      {feedback && (
        <span
          key={feedback.id}
          className={`tt-judgement tt-judgement-${feedback.judgement.toLowerCase()}`}
          role="status"
        >
          {feedback.judgement}
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
