import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useLeaderboard } from '../hooks/useLeaderboard.ts';
import { getLocalBest, getSavedNickname, saveLocalBest, submitScore } from '../lib/score.ts';
import { goHome } from '../lib/navigation.ts';
import { isSupabaseConfigured } from '../lib/supabase.ts';
import { Leaderboard } from './Leaderboard.tsx';
import { ShareButton } from './ShareButton.tsx';

interface ScoreResultProps {
  slug: string;
  /** 게임 안의 기록 단위(예: 달고나 모양). 최고기록·랭킹이 보드마다 따로다. 없으면 게임 하나 */
  board?: string;
  title: string;
  score: number;
  /** 점수 위에 보여줄 한 줄. 예: "완성!", "깨졌어요!" */
  headline?: string;
  /** 점수 아래에 보여줄 게임별 기록(판정별 개수, 뽑은 모양 등) */
  details?: ReactNode;
  metadata?: Record<string, unknown>;
  /** 주 버튼. 이름은 실제로 일어날 일과 맞춘다(같은 판을 다시 시작하면 "다시 하기") */
  onRestart: () => void;
  restartLabel?: string;
  /** 두 번째 버튼(선택). 예: 다른 모양 고르기 */
  secondaryAction?: { label: string; onClick: () => void };
}

type SubmitState = 'idle' | 'submitting' | 'done' | 'error';

/** 이번 점수와 이전 최고기록을 비교한 한 줄 */
function bestRecordMessage(score: number, previousBest: number): string {
  if (score > previousBest) return '최고기록 달성!';
  if (previousBest === 0) return '아직 기록이 없어요. 다시 도전해 보세요!';
  return `내 최고기록 ${previousBest}점`;
}

export function ScoreResult({
  slug,
  board = '',
  title,
  score,
  headline,
  details,
  metadata,
  onRestart,
  restartLabel = '다시 하기',
  secondaryAction,
}: ScoreResultProps) {
  const [previousBest] = useState(() => getLocalBest({ slug, board }));
  const [nickname, setNickname] = useState(getSavedNickname);
  const [submit, setSubmit] = useState<SubmitState>('idle');
  const { entries, status, refresh } = useLeaderboard({ slug, board });

  useEffect(() => saveLocalBest({ slug, board }, score), [slug, board, score]);

  const register = async () => {
    setSubmit('submitting');
    try {
      await submitScore({ slug, board, nickname: nickname.trim(), score, metadata });
      setSubmit('done');
      refresh();
    } catch (error) {
      console.error('[engine] 점수 저장 실패', error);
      setSubmit('error');
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void register();
  };

  return (
    <section className="mg-result">
      {/* 결과 제목은 화면이 바뀌자마자 스크린리더가 읽도록 status로 둔다 */}
      {headline && (
        <p className="mg-headline" role="status">
          {headline}
        </p>
      )}
      <p className="mg-score">{score}점</p>
      <p className="mg-muted">{bestRecordMessage(score, previousBest)}</p>
      {details}

      <div className="mg-actions">
        {/* 키보드 사용자도 바로 다음 행동을 할 수 있게 주 버튼에 포커스를 준다 */}
        <button type="button" className="mg-button" onClick={onRestart} autoFocus>
          {restartLabel}
        </button>
        {secondaryAction && (
          <button
            type="button"
            className="mg-button mg-button-secondary"
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.label}
          </button>
        )}
        {/* 0점은 자랑할 거리가 없어 공유 버튼을 숨긴다 */}
        {score > 0 && <ShareButton title={title} score={score} headline={headline} />}
        {/* 모든 게임 공통: 결과를 보고 다른 게임으로 갈 수 있게 한다(헤더의 ←와 같은 동작) */}
        <button type="button" className="mg-button mg-button-secondary" onClick={goHome}>
          게임 목록으로
        </button>
      </div>

      {/* 랭킹은 결과와 함께 바로 보인다 */}
      <h2 className="mg-section-title">랭킹 Top 10</h2>
      {/* 0점(실패)은 랭킹에 올릴 의미가 없어 등록 폼을 숨긴다 */}
      {isSupabaseConfigured() && score > 0 && submit !== 'done' && (
        <form className="mg-submit" onSubmit={handleSubmit}>
          <input
            aria-label="닉네임"
            placeholder="닉네임"
            maxLength={12}
            required
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <button type="submit" className="mg-button" disabled={submit === 'submitting'}>
            랭킹 등록
          </button>
        </form>
      )}
      {submit === 'error' && (
        <p className="mg-muted" role="alert">
          등록하지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}
      <Leaderboard entries={entries} status={status} />
    </section>
  );
}
