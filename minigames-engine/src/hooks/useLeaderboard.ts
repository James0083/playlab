import { useCallback, useEffect, useState } from 'react';
import { fetchTop10, type LeaderboardEntry } from '../lib/score';
import { isSupabaseConfigured } from '../lib/supabase';

export type LeaderboardStatus = 'offline' | 'loading' | 'ready' | 'error';

/**
 * Top 10 조회. Realtime 구독 대신 결과 화면에서 한 번 조회하고 refresh()로 갱신한다.
 * Supabase Free의 동시 Realtime 연결 한도(200)를 플레이어가 소모하지 않게 하기 위함이다.
 */
export function useLeaderboard(slug: string) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState<LeaderboardStatus>(
    isSupabaseConfigured() ? 'loading' : 'offline',
  );
  // 값이 바뀌면 아래 effect가 다시 조회한다.
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    // 응답이 오기 전에 화면을 떠나거나 slug가 바뀌면 결과를 버린다.
    let stale = false;
    fetchTop10(slug).then(
      (next) => {
        if (stale) return;
        setEntries(next);
        setStatus('ready');
      },
      (error: unknown) => {
        if (stale) return;
        console.error('[engine] 리더보드 조회 실패', error);
        setStatus('error');
      },
    );
    return () => {
      stale = true;
    };
  }, [slug, requestId]);

  const refresh = useCallback(() => {
    if (!isSupabaseConfigured()) return;
    setStatus('loading');
    setRequestId((id) => id + 1);
  }, []);

  return { entries, status, refresh };
}
