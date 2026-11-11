import { getLocalBest } from '@minigames/engine';
import { useState } from 'react';
import { unlockHint } from './rules.ts';
import { formatPoints, type Shape } from './shapes.ts';

interface ShapePickerProps {
  slug: string;
  shapes: readonly Shape[];
  /** 앞에서부터 이 개수만큼 열려 있다 */
  unlockedCount: number;
  onSelect: (index: number) => void;
}

/** 모양 선택 화면. 앞 모양을 완성해야 다음 모양이 열린다 */
export function ShapePicker({ slug, shapes, unlockedCount, onSelect }: ShapePickerProps) {
  const [hint, setHint] = useState('');

  const handleClick = (index: number) => {
    const previous = shapes[unlockedCount - 1];
    if (index < unlockedCount) onSelect(index);
    else if (previous) setHint(unlockHint(previous));
  };

  return (
    <div className="dg-picker">
      {/* 카드 6장이 함께 쓰는 달고나 판 그라데이션(판 그림 Candy.tsx와 같은 색) */}
      <svg className="dg-pick-defs" width="0" height="0" aria-hidden="true">
        <defs>
          <radialGradient id="dg-pick-dome" cx="42%" cy="38%" r="65%">
            <stop offset="0%" stopColor="var(--dg-candy-light)" />
            <stop offset="60%" stopColor="var(--dg-candy)" />
            <stop offset="92%" stopColor="var(--dg-candy-edge)" />
            <stop offset="100%" stopColor="var(--dg-candy-rim)" />
          </radialGradient>
        </defs>
      </svg>
      <p className="mg-muted">
        점선을 따라 정확하게 그릴수록 점수가 높아요. 선을 벗어나면 금이 가요(3번이면 끝).
      </p>
      <ul className="dg-shapes">
        {shapes.map((shape, i) => {
          const isLocked = i >= unlockedCount;
          const best = getLocalBest({ slug, board: shape.id });
          return (
            <li key={shape.id}>
              {/* 잠긴 모양도 눌러서 해금 조건을 볼 수 있게 disabled 대신 aria-disabled를 쓴다 */}
              <button
                type="button"
                className="dg-shape"
                aria-disabled={isLocked}
                onClick={() => handleClick(i)}
                aria-label={
                  isLocked
                    ? `${shape.name}, 잠김`
                    : `${shape.name}, 난이도 ${shape.stars}, 만점 ${shape.baseScore}점, 내 최고 ${best}점`
                }
              >
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx={52} cy={54} r={46} fill="#000" opacity={0.18} />
                  <circle cx={50} cy={50} r={46} fill="url(#dg-pick-dome)" />
                  {shape.strokes.map((stroke, j) => (
                    <polyline key={j} points={formatPoints(stroke)} />
                  ))}
                </svg>
                <span className="dg-shape-name">
                  {isLocked && '🔒 '}
                  {shape.name}
                </span>
                <span className="dg-stars">{'★'.repeat(shape.stars)}</span>
                <span className="dg-best">{best > 0 ? `최고 ${best}점` : ' '}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="dg-hint" role="status">
        {hint}
      </p>
    </div>
  );
}
