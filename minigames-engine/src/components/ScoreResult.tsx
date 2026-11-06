import { useEffect, useState, type FormEvent } from 'react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { getLocalBest, getSavedNickname, saveLocalBest, submitScore } from '../lib/score';
import { isSupabaseConfigured } from '../lib/supabase';
import { Leaderboard } from './Leaderboard';
import { ShareButton } from './ShareButton';

interface ScoreResultProps {
  slug: string;
  title: string;
  score: number;
  metadata?: Record<string, unknown>;
  onRestart: () => void;
}

type SubmitState = 'idle' | 'submitting' | 'done' | 'error';

export function ScoreResult({ slug, title, score, metadata, onRestart }: ScoreResultProps) {
  const [previousBest] = useState(() => getLocalBest(slug));
  const [nickname, setNickname] = useState(getSavedNickname);
  const [submit, setSubmit] = useState<SubmitState>('idle');
  const { entries, status, refresh } = useLeaderboard(slug);

  useEffect(() => saveLocalBest(slug, score), [slug, score]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmit('submitting');
    try {
      await submitScore(slug, nickname.trim(), score, metadata);
      setSubmit('done');
      await refresh();
    } catch (error) {
      console.error('[engine] 점수 저장 실패', error);
      setSubmit('error');
    }
  };

  return (
    <section className="mg-result">
      <p className="mg-score">{score}점</p>
      <p className="mg-muted">
        {score > previousBest ? '최고기록 달성!' : `내 최고기록 ${previousBest}점`}
      </p>

      {isSupabaseConfigured() && submit !== 'done' && (
        <form className="mg-submit" onSubmit={onSubmit}>
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
        <ShareButton title={title} score={score} />
      </div>
    </section>
  );
}
