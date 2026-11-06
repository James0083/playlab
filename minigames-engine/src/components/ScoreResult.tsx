import { useEffect, useState, type FormEvent } from 'react';
import { useLeaderboard } from '../hooks/useLeaderboard.ts';
import { getLocalBest, getSavedNickname, saveLocalBest, submitScore } from '../lib/score.ts';
import { isSupabaseConfigured } from '../lib/supabase.ts';
import { Leaderboard } from './Leaderboard.tsx';
import { ShareButton } from './ShareButton.tsx';

interface ScoreResultProps {
  slug: string;
  title: string;
  score: number;
  /** 점수 위에 보여줄 한 줄. 예: "완성!", "깨졌어요!" */
  headline?: string;
  metadata?: Record<string, unknown>;
  onRestart: () => void;
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
  title,
  score,
  headline,
  metadata,
  onRestart,
}: ScoreResultProps) {
  const [previousBest] = useState(() => getLocalBest(slug));
  const [nickname, setNickname] = useState(getSavedNickname);
  const [submit, setSubmit] = useState<SubmitState>('idle');
  const { entries, status, refresh } = useLeaderboard(slug);

  useEffect(() => saveLocalBest(slug, score), [slug, score]);

  const register = async () => {
    setSubmit('submitting');
    try {
      await submitScore({ slug, nickname: nickname.trim(), score, metadata });
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
      {headline && <p className="mg-headline">{headline}</p>}
      <p className="mg-score">{score}점</p>
      <p className="mg-muted">{bestRecordMessage(score, previousBest)}</p>

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

      <div className="mg-actions">
        <button type="button" className="mg-button" onClick={onRestart}>
          다시 하기
        </button>
        {/* 0점은 자랑할 거리가 없어 공유 버튼을 숨긴다 */}
        {score > 0 && <ShareButton title={title} score={score} />}
      </div>
    </section>
  );
}
