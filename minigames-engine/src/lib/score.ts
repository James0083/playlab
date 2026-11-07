import { readStorage as read, writeStorage as write } from './storage.ts';
import { getSupabase } from './supabase.ts';

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  score: number;
}

const PLAYER_KEY = 'minigames:player-id';
const NICKNAME_KEY = 'minigames:nickname';
/**
 * 기록을 나누는 단위. 게임(slug) 안에서 보드별로 최고기록·랭킹을 따로 둔다.
 * 예: 달고나는 모양별(board = 'circle'), 떡치기는 보드 하나(board = '').
 */
export interface RecordBoard {
  slug: string;
  board?: string;
}

const bestKey = ({ slug, board = '' }: RecordBoard) =>
  board ? `minigames:best:${slug}:${board}` : `minigames:best:${slug}`;

export function getPlayerId(): string {
  const existing = read(PLAYER_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  write(PLAYER_KEY, id);
  return id;
}

export const getSavedNickname = (): string => read(NICKNAME_KEY) ?? '';

export function getLocalBest(record: RecordBoard): number {
  const value = Number(read(bestKey(record)));
  return Number.isFinite(value) ? value : 0;
}

export function saveLocalBest(record: RecordBoard, score: number): void {
  if (score > getLocalBest(record)) write(bestKey(record), String(score));
}

export interface ScoreSubmission extends RecordBoard {
  nickname: string;
  score: number;
  /** 게임별 추가 데이터(콤보, 완성도 등). 2KB 이하. */
  metadata?: Record<string, unknown>;
}

export async function submitScore({
  slug,
  board = '',
  nickname,
  score,
  metadata = {},
}: ScoreSubmission): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.rpc('submit_score', {
    p_game_slug: slug,
    p_board: board,
    p_player_id: getPlayerId(),
    p_nickname: nickname,
    p_score: score,
    p_metadata: metadata,
  });
  if (error) throw error;
  write(NICKNAME_KEY, nickname);
}

export async function fetchTop10({ slug, board = '' }: RecordBoard): Promise<LeaderboardEntry[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('get_top10', { p_game_slug: slug, p_board: board });
  if (error) throw error;
  return data;
}
