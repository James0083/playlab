import type { Game } from './games.ts';

/** 템플릿에서 게임 목록이 들어갈 자리 */
export const GAMES_PLACEHOLDER = '<!--GAMES-->';
/** 템플릿(404.html 등)에서 사이트 경로 앞부분이 들어갈 자리. 예: href="{{BASE_PATH}}" */
export const BASE_PATH_PLACEHOLDER = '{{BASE_PATH}}';

/**
 * 사이트 경로 앞부분을 `/` 또는 `/playlab/`처럼 앞뒤에 /가 붙은 꼴로 맞춘다.
 * Cloudflare는 도메인 루트(`/`), GitHub Pages는 저장소 이름 경로(`/playlab/`)에 배포한다.
 * 비었거나 없으면 `/`.
 */
export function normalizeBasePath(raw: string | undefined): string {
  const trimmed = (raw ?? '').replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? '/' : `/${trimmed}/`;
}

export interface RenderOptions {
  /** 이 게임을 눌러서 들어갈 수 있는지(배포됨, 또는 레포에 있는 게임을 모두 링크하는 빌드) */
  isPlayable: (game: Game) => boolean;
  /** 사이트 경로 앞부분(normalizeBasePath 결과). 기본 `/` */
  basePath?: string;
}

function cardBody(game: Game, playable: boolean): string {
  const suffix = playable ? '' : ' (준비 중)';
  return `
  <span class="emoji" aria-hidden="true">${game.emoji}</span>
  <span><span class="name">${game.name}</span>${suffix}<br><span class="desc">${game.description}</span>
  <span class="best" data-best-slug="${game.slug}"></span></span>`;
}

/** 게임 목록을 HTML로 만든다. 들어갈 수 없는 게임은 링크 없이 흐리게 보인다 */
export function renderGameList(
  games: readonly Game[],
  { isPlayable, basePath = '/' }: RenderOptions,
): string {
  return games
    .map((game) => {
      const playable = isPlayable(game);
      return playable
        ? `<li><a class="card" href="${basePath}games/${game.slug}/">${cardBody(game, true)}</a></li>`
        : `<li><div class="card" aria-disabled="true">${cardBody(game, false)}</div></li>`;
    })
    .join('\n');
}

/**
 * 템플릿의 자리표시자를 게임 목록으로 바꾼다.
 * 자리표시자가 없으면 목록 없는 홈이 조용히 배포되지 않도록 오류를 던진다.
 */
export function renderHome(
  template: string,
  games: readonly Game[],
  options: RenderOptions,
): string {
  if (!template.includes(GAMES_PLACEHOLDER)) {
    throw new Error(`홈 템플릿에 ${GAMES_PLACEHOLDER} 자리표시자가 없습니다.`);
  }
  return template.replace(GAMES_PLACEHOLDER, renderGameList(games, options));
}

/** 템플릿의 경로 자리표시자를 사이트 경로 앞부분으로 바꾼다(404 페이지의 "홈으로" 링크 등) */
export function withBasePath(template: string, basePath: string): string {
  return template.replaceAll(BASE_PATH_PLACEHOLDER, basePath);
}
