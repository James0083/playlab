import { ScoreResult } from '@minigames/engine';
import { ResultArt, type FinaleKind } from './Finale.tsx';
import type { Shape } from './shapes.ts';

interface ResultDetailsProps {
  shape: Shape;
  kind: FinaleKind;
  /** 0~1 */
  precision: number;
  cracks: number;
}

/** 결과 화면 기록: 뽑은 모양(또는 깨진 과자) 그림과 정확도·균열 수 */
export function ResultDetails({ shape, kind, precision, cracks }: ResultDetailsProps) {
  return (
    <>
      <ResultArt shape={shape} kind={kind} />
      <ul className="mg-stats" aria-label="뽑기 기록">
        <li>
          <strong>{shape.name}</strong>
          <span>모양</span>
        </li>
        <li>
          <strong>{kind === 'complete' ? `${Math.round(precision * 100)}%` : '-'}</strong>
          <span>정확도</span>
        </li>
        <li>
          <strong>{cracks}</strong>
          <span>균열</span>
        </li>
      </ul>
    </>
  );
}

export type Outcome = 'complete' | 'broken' | 'timeout';

const HEADLINES: Record<Outcome, string> = {
  complete: '완성!',
  broken: '깨졌어요!',
  timeout: '시간 초과!',
};

interface DalgonaResultProps {
  slug: string;
  title: string;
  score: number;
  shape: Shape;
  /** 완성했고 다음 모양이 있으면 그 모양. 없으면 같은 모양을 다시 한다 */
  nextShape: Shape | null;
  outcome: Outcome;
  precision: number;
  cracks: number;
  onRestart: () => void;
  onPickShape: () => void;
}

/** 달고나 결과 화면. 최고기록·랭킹은 모양별로 따로다(board = 모양 id) */
export function DalgonaResult({
  slug,
  title,
  score,
  shape,
  nextShape,
  outcome,
  precision,
  cracks,
  onRestart,
  onPickShape,
}: DalgonaResultProps) {
  return (
    <ScoreResult
      slug={slug}
      board={shape.id}
      title={`${title} ${shape.name}`}
      score={score}
      headline={HEADLINES[outcome]}
      details={
        <ResultDetails
          shape={shape}
          kind={outcome === 'complete' ? 'complete' : 'broken'}
          precision={precision}
          cracks={cracks}
        />
      }
      metadata={{ shape: shape.id, cracks, precision }}
      onRestart={onRestart}
      restartLabel={nextShape ? `다음: ${nextShape.name}` : '다시 하기'}
      secondaryAction={{ label: '모양 고르기', onClick: onPickShape }}
    />
  );
}
