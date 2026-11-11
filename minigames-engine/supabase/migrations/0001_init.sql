-- 게임 목록
create table public.games (
  slug        text primary key,
  name        text not null,
  description text,
  active      boolean not null default true,
  max_score   int check (max_score is null or max_score >= 0), -- 이론상 최고 점수. 초과 제출을 거부한다
  created_at  timestamptz not null default now()
);

-- 점수 기록
create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_slug   text not null references public.games (slug),
  board       text not null default '' check (char_length(board) <= 32), -- 게임 안의 기록 단위(예: 달고나 모양). 랭킹을 따로 둔다
  player_id   uuid not null,  -- 익명 UUID (localStorage)
  nickname    text not null check (char_length(nickname) between 1 and 12),
  score       int not null check (score >= 0),
  metadata    jsonb not null default '{}' check (pg_column_size(metadata) <= 2048),
  created_at  timestamptz not null default now()
);

create index scores_rank_idx   on public.scores (game_slug, board, score desc);
create index scores_recent_idx on public.scores (game_slug, created_at desc);
create index scores_player_idx on public.scores (player_id, game_slug, created_at desc);

-- RLS: 게임 목록은 읽기만 허용하고, scores는 직접 접근을 막아 아래 함수로만 다룬다.
-- 주의: 클라이언트가 계산한 점수를 받는 구조라 위조를 완전히 막을 수는 없다.
-- 여기서는 범위 검증과 빈도 제한으로 명백한 조작만 걸러낸다.
-- TODO(Supabase 연결 시): 점수 대신 입력 기록(떡치기 탭 시각, 달고나 경로)을 받아
-- Edge Function에서 같은 규칙으로 다시 판정한다. 설계는 minigames-dev-plan.md Phase 1 참고.
alter table public.games enable row level security;
alter table public.scores enable row level security;

create policy games_read on public.games for select to anon, authenticated using (true);

create function public.submit_score(
  p_game_slug text,
  p_board     text,
  p_player_id uuid,
  p_nickname  text,
  p_score     int,
  p_metadata  jsonb default '{}'
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max int;
begin
  select g.max_score into v_max
  from public.games g
  where g.slug = p_game_slug and g.active;

  if not found then
    raise exception 'unknown game' using errcode = 'P0002';
  end if;

  if v_max is not null and p_score > v_max then
    raise exception 'score out of range' using errcode = '22003';
  end if;

  if exists (
    select 1 from public.scores s
    where s.player_id = p_player_id
      and s.game_slug = p_game_slug
      and s.created_at > now() - interval '5 seconds'
  ) then
    raise exception 'too many submissions' using errcode = 'P0001';
  end if;

  insert into public.scores (game_slug, board, player_id, nickname, score, metadata)
  values (p_game_slug, coalesce(p_board, ''), p_player_id, btrim(p_nickname), p_score, coalesce(p_metadata, '{}'));
end;
$$;

-- 게임·보드별, 플레이어별 최고 기록 기준 Top 10. 한 사람이 순위를 독점하지 않는다.
create function public.get_top10(p_game_slug text, p_board text default '')
returns table (rank bigint, nickname text, score int)
language sql
stable
security definer
set search_path = ''
as $$
  select row_number() over (order by b.score desc, b.created_at asc), b.nickname, b.score
  from (
    select distinct on (s.player_id) s.player_id, s.nickname, s.score, s.created_at
    from public.scores s
    where s.game_slug = p_game_slug and s.board = coalesce(p_board, '')
    order by s.player_id, s.score desc, s.created_at asc
  ) b
  order by 1
  limit 10;
$$;

revoke all on function public.submit_score(text, text, uuid, text, int, jsonb) from public;
revoke all on function public.get_top10(text, text) from public;
grant execute on function public.submit_score(text, text, uuid, text, int, jsonb) to anon, authenticated;
grant execute on function public.get_top10(text, text) to anon, authenticated;

-- max_score: 떡치기는 game-tteokchigi/src/scoring.ts의 MAX_SCORE(84박자 모두 PERFECT + 콤보 배율)와 같아야 한다.
-- 달고나는 game-dalgona/src/rules.ts의 MAX_SCORE(우산 기준 점수 800)와 같아야 한다.
-- 버블티는 game-bubble-tea/src/rules.ts의 MAX_SCORE(섞임 100 + 적정 세기 30 + 넘치지 않음 20)와 같아야 한다.
-- 짜장면은 game-jjajang/src/rules.ts의 MAX_SCORE(비빔 100 + 방향 바꾸기 30 + 빨리 다 비빔 20)와 같아야 한다.
-- 팽이는 game-paengi/src/rules.ts의 MAX_SCORE(가장 빠른 회전 1800에서 쓰러질 때까지 25초, 0.1초당 1점)와 같아야 한다.
-- 나머지 게임은 규칙이 정해지면 채운다(null이면 상한 검사를 하지 않는다).
insert into public.games (slug, name, description, max_score) values
  ('tteokchigi', '떡치기', '떡메가 떡에 닿는 순간 탭', 642),
  ('dalgona', '달고나 뽑기', '점선을 따라 정확하게 그리기', 800),
  ('bubble-tea', '버블티 흔들기', '넘치지 않게 폰 흔들기', 150),
  ('jjajang', '짜장면 비비기', '원을 그리며 방향 바꿔 비비기', 150),
  ('paengi', '팽이 돌리기', '빨리 돌리고 기울여서 오래 버티기', 250);
