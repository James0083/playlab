import { getSupabase } from './supabase.ts';

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  score: number;
}

const PLAYER_KEY = 'minigames:player-id';
const NICKNAME_KEY = 'minigames:nickname';
const bestKey = (slug: string) => `minigames:best:${slug}`;

// 사생활 보호 모드 등에서 localStorage 접근이 실패해도 게임은 계속되어야 한다.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 저장하지 못해도 플레이에는 영향이 없다 */
  }
}

export function getPlayerId(): string {
  const existing = read(PLAYER_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  write(PLAYER_KEY, id);
  return id;
}

export const getSavedNickname = (): string => read(NICKNAME_KEY) ?? '';

export function getLocalBest(slug: string): number {
  const value = Number(read(bestKey(slug)));
  return Number.isFinite(value) ? value : 0;
}

export function saveLocalBest(slug: string, score: number): void {
  if (score > getLocalBest(slug)) write(bestKey(slug), String(score));
}

export interface ScoreSubmission {
  slug: string;
  nickname: string;
  score: number;
  /** 게임별 추가 데이터(콤보, 완성도 등). 2KB 이하. */
  metadata?: Record<string, unknown>;
}

export async function submitScore({
  slug,
  nickname,
  score,
  metadata = {},
}: ScoreSubmission): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.rpc('submit_score', {
    p_game_slug: slug,
    p_player_id: getPlayerId(),
    p_nickname: nickname,
    p_score: score,
    p_metadata: metadata,
  });
  if (error) throw error;
  write(NICKNAME_KEY, nickname);
}

export async function fetchTop10(slug: string): Promise<LeaderboardEntry[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('get_top10', { p_game_slug: slug });
  if (error) throw error;
  return data;
}
