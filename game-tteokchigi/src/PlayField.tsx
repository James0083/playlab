import type { RefObject } from 'react';
import { callAt, speedUpNoticeAt } from './cues.ts';
import { pestleHeight, type Judgement } from './rules.ts';

export interface TapFeedback {
  /** 탭마다 증가한다. 같은 판정이 연속돼도 이펙트가 다시 재생되도록 key로 쓴다 */
  id: number;
  judgement: Judgement;
}

/** 매 프레임 직접 갱신하는 요소들. React 상태로 다루면 초당 60번 다시 렌더링하게 된다. */
export interface FieldElements {
  pestle: HTMLDivElement | null;
  call: HTMLDivElement | null;
  speedUp: HTMLDivElement | null;
}

const PESTLE_TRAVEL_PX = 180;

/** 한 프레임을 그린다: 절굿공이 높이, よーい 말풍선, 속도 증가 알림 */
export function drawFrame(elements: FieldElements, beats: readonly number[], elapsedMs: number) {
  const { pestle, call, speedUp } = elements;
  if (pestle) {
    pestle.style.transform = `translateY(${-pestleHeight(beats, elapsedMs) * PESTLE_TRAVEL_PX}px)`;
  }
  if (call) {
    const { text, isPeak } = callAt(beats, elapsedMs);
    // 글자가 바뀔 때만 DOM을 건드려 매 프레임 레이아웃 계산을 피한다
    if (call.textContent !== text) call.textContent = text;
    call.classList.toggle('tt-call-visible', text !== '');
    call.classList.toggle('tt-call-peak', isPeak);
  }
  if (speedUp) {
    const notice = speedUpNoticeAt(elapsedMs) ?? '';
    if (speedUp.textContent !== notice) speedUp.textContent = notice;
    speedUp.classList.toggle('tt-speed-up-visible', notice !== '');
  }
}

interface PlayFieldProps {
  elementsRef: RefObject<FieldElements>;
  feedback: TapFeedback | null;
  onTap: () => void;
}

/** 절굿공이·떡·말풍선·판정 문구를 그리는 플레이 영역. 화면 어디를 탭해도 판정한다. */
export function PlayField({ elementsRef, feedback, onTap }: PlayFieldProps) {
  const isHit = feedback !== null && feedback.judgement !== 'MISS';

  return (
    <button type="button" className="tt-field" aria-label="떡 치기" onPointerDown={onTap}>
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
      <div
        ref={(node) => {
          elementsRef.current.pestle = node;
        }}
        className="tt-pestle"
      />
      <div
        key={isHit ? feedback.id : 'idle'}
        className={isHit ? 'tt-mochi tt-mochi-hit' : 'tt-mochi'}
      />
    </button>
  );
}
