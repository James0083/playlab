import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { GAMES } from '../lib/games.ts';
import { renderHome } from '../lib/renderHome.ts';

// 개발 모드(PLAYLAB_DEV=1, pnpm dev가 켠다)에서는 배포 상태와 관계없이
// 레포에 폴더(game-<slug>)가 있는 게임을 모두 링크로 보여준다.
const isDev = process.env.PLAYLAB_DEV === '1';
const hasLocalGame = (slug) => existsSync(new URL(`../../game-${slug}/`, import.meta.url));

const template = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
const html = renderHome(template, GAMES, {
  isPlayable: (game) => game.status === 'live' || (isDev && hasLocalGame(game.slug)),
});

const dist = new URL('../dist/', import.meta.url);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await writeFile(new URL('index.html', dist), html);
// 없는 경로용 페이지. Worker는 not_found_handling = "404-page"로, pnpm dev는 직접 이 파일을 돌려준다
await writeFile(
  new URL('404.html', dist),
  await readFile(new URL('../src/404.html', import.meta.url)),
);
