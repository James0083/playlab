/**
 * Supabase에서 클라이언트가 호출하는 함수의 타입.
 * supabase/migrations의 함수 시그니처를 바꾸면 여기도 같이 바꾼다.
 * (Supabase 프로젝트를 만든 뒤에는 `supabase gen types typescript`로 생성한 파일로 대체한다.)
 */
export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      submit_score: {
        Args: {
          p_game_slug: string;
          p_player_id: string;
          p_nickname: string;
          p_score: number;
          p_metadata?: Record<string, unknown>;
        };
        Returns: undefined;
      };
      get_top10: {
        Args: { p_game_slug: string };
        Returns: { rank: number; nickname: string; score: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
