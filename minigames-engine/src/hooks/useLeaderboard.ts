import { useCallback, useEffect, useState } from 'react';
import { fetchTop10, type LeaderboardEntry } from '../lib/score';
import { isSupabaseConfigured } from '../lib/supabase';

export type LeaderboardStatus = 'offline' | 'loading' | 'ready' | 'error';

/**
 * Top 10 조회. 플랜의 Realtime 구독 대신 결과 화면에서 한 번 조회하고 refresh()로 갱신한다.
 * Supabase Free의 동시 Realtime 연결 한도(200)를 플레이어가 소모하지 않게 하기 위함이다.
 */
export function useLeaderboard(slug: string) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState<LeaderboardStatus>(isSupabaseConfigured() ? 'loading' : 'offline');

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setStatus('loading');
    try {
      setEntries(await fetchTop10(slug));
      setStatus('ready');
    } catch (error) {
      console.error('[engine] 리더보드 조회 실패', error);
      setStatus('error');
    }
  }, [slug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, status, refresh };
}
