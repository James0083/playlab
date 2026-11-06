import type { Game } from './games.ts';

/** 템플릿에서 게임 목록이 들어갈 자리 */
export const GAMES_PLACEHOLDER = '<!--GAMES-->';

export interface RenderOptions {
  /** 이 게임을 눌러서 들어갈 수 있는지(배포됨, 또는 개발 모드에서 로컬에 있음) */
  isPlayable: (game: Game) => boolean;
}

function cardBody(game: Game, playable: boolean): string {
  const suffix = playable ? '' : ' (준비 중)';
  return `
  <span class="emoji" aria-hidden="true">${game.emoji}</span>
  <span><span class="name">${game.name}</span>${suffix}<br><span class="desc">${game.description}</span></span>`;
}

/** 게임 목록을 HTML로 만든다. 들어갈 수 없는 게임은 링크 없이 흐리게 보인다 */
export function renderGameList(games: readonly Game[], { isPlayable }: RenderOptions): string {
  return games
    .map((game) => {
      const playable = isPlayable(game);
      return playable
        ? `<li><a class="card" href="/games/${game.slug}/">${cardBody(game, true)}</a></li>`
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
