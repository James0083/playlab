import type { LeaderboardEntry } from '../lib/score';
import type { LeaderboardStatus } from '../hooks/useLeaderboard';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  status: LeaderboardStatus;
}

export function Leaderboard({ entries, status }: LeaderboardProps) {
  if (status === 'offline') return <p className="mg-muted">랭킹 서버에 연결되어 있지 않아요.</p>;
  if (status === 'error') return <p className="mg-muted">랭킹을 불러오지 못했어요.</p>;
  if (status === 'loading' && entries.length === 0) return <p className="mg-muted">랭킹을 불러오는 중…</p>;
  if (entries.length === 0) return <p className="mg-muted">아직 기록이 없어요. 첫 기록을 남겨 보세요!</p>;

  return (
    <ol className="mg-leaderboard">
      {entries.map((entry) => (
        <li key={entry.rank}>
          <span>{entry.rank}</span>
          <span>{entry.nickname}</span>
          <strong>{entry.score}</strong>
        </li>
      ))}
    </ol>
  );
}
