import { formatPoints, type Shape } from './shapes.ts';

interface ShapePickerProps {
  shapes: readonly Shape[];
  /** 앞에서부터 이 개수만큼 열려 있다 */
  unlockedCount: number;
  onSelect: (index: number) => void;
}

/** 모양 선택 화면. 앞 모양을 완성해야 다음 모양이 열린다 */
export function ShapePicker({ shapes, unlockedCount, onSelect }: ShapePickerProps) {
  return (
    <div className="dg-picker">
      <p className="mg-muted">
        선을 따라 긁어 모양을 뽑으세요. 선을 벗어나면 금이 가요(3번이면 끝).
      </p>
      <ul className="dg-shapes">
        {shapes.map((shape, i) => {
          const isLocked = i >= unlockedCount;
          return (
            <li key={shape.id}>
              <button
                type="button"
                className="dg-shape"
                disabled={isLocked}
                onClick={() => onSelect(i)}
                aria-label={
                  isLocked
                    ? `${shape.name}, 잠김. 앞 모양을 완성하면 열려요`
                    : `${shape.name}, 난이도 ${shape.stars}, 최고 ${shape.baseScore}점`
                }
              >
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  {shape.strokes.map((stroke, j) => (
                    <polyline key={j} points={formatPoints(stroke)} />
                  ))}
                </svg>
                <span className="dg-shape-name">
                  {isLocked && '🔒 '}
                  {shape.name}
                </span>
                <span className="dg-stars">{'★'.repeat(shape.stars)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
