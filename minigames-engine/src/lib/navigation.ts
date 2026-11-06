/** 미니게임 홈 경로. 게임은 /games/<slug>/ 아래에 있고 홈은 Worker가 서빙한다 */
const HOME_PATH = '/';

/** 홈(게임 목록)으로 이동한다 */
export function goHome(): void {
  location.assign(HOME_PATH);
}
