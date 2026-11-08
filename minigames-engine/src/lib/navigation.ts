/** 게임은 홈 아래 이 경로에 있다(<홈>/games/<slug>/) */
const GAMES_SEGMENT = '/games/';

/**
 * 지금 주소에서 홈(게임 목록) 경로를 구한다.
 * 배포처마다 홈 위치가 다르다: Cloudflare는 `/`, GitHub Pages는 `/playlab/`.
 * 게임 주소 `<홈>/games/<slug>/...`에서 `/games/` 앞까지가 홈이다. 게임 주소가 아니면 `/`.
 */
export function homePathOf(pathname: string): string {
  const index = pathname.indexOf(GAMES_SEGMENT);
  return index < 0 ? '/' : pathname.slice(0, index + 1);
}

/** 홈(게임 목록)으로 이동한다 */
export function goHome(): void {
  location.assign(homePathOf(location.pathname));
}
