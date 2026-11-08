import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { GAMES } from '../lib/games.ts';
import { normalizeBasePath, renderHome, withBasePath } from '../lib/renderHome.ts';

// 환경 변수
//   PLAYLAB_BASE_PATH=/playlab/    사이트 경로 앞부분. 기본 `/`(Cloudflare). GitHub Pages는 저장소 이름 경로
//   PLAYLAB_LINK_LOCAL_GAMES=1     배포 상태(status)와 관계없이 레포에 폴더(game-<slug>)가 있는 게임을 모두
//                                  링크한다. pnpm dev와 GitHub Pages 임시 배포가 켠다(게임을 함께 올리므로)
//   PLAYLAB_HOME_OUT_DIR=<절대 경로>  결과를 dist/ 대신 이 폴더에 쓴다. build:pages가 쓴다.
//                                  dist/는 실행 중인 pnpm dev가 서빙하므로 다른 경로용 빌드로 덮어쓰지 않는다
const basePath = normalizeBasePath(process.env.PLAYLAB_BASE_PATH);
const linksLocalGames = process.env.PLAYLAB_LINK_LOCAL_GAMES === '1';
const hasLocalGame = (slug) => existsSync(new URL(`../../game-${slug}/`, import.meta.url));

const template = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
const html = renderHome(template, GAMES, {
  isPlayable: (game) => game.status === 'live' || (linksLocalGames && hasLocalGame(game.slug)),
  basePath,
});

const outDir = process.env.PLAYLAB_HOME_OUT_DIR;
const dist = outDir ? pathToFileURL(`${outDir}/`) : new URL('../dist/', import.meta.url);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await writeFile(new URL('index.html', dist), withBasePath(html, basePath));
// 없는 경로용 페이지. Worker는 not_found_handling = "404-page", GitHub Pages는 사이트 루트의 404.html,
// pnpm dev는 직접 이 파일을 돌려준다
const notFound = await readFile(new URL('../src/404.html', import.meta.url), 'utf8');
await writeFile(new URL('404.html', dist), withBasePath(notFound, basePath));
