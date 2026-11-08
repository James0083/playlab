// GitHub Pages 임시 배포용 사이트를 만든다(Cloudflare 배포 전까지).
// 홈과 레포의 모든 게임을 한 폴더(pages-dist/)에 배포 경로 그대로 모은다.
//   pages-dist/                 ← 홈: index.html, 404.html (minigames-home/dist가 아니라 여기에 바로 빌드한다.
//                                  minigames-home/dist는 실행 중인 pnpm dev가 서빙하기 때문이다)
//   pages-dist/games/<slug>/    ← 각 게임(game-<slug>/dist)
// Cloudflare와 달리 Worker 프록시 없이 정적 파일로만 서빙하므로, 경로 앞부분(base)을 빌드할 때 넣는다.
//
// 실행: pnpm build:pages                       경로 앞부분 기본값 /playlab/ (저장소 이름)
//       PLAYLAB_BASE_PATH=/other/ pnpm build:pages
// GitHub Actions(.github/workflows/deploy-pages.yml)는 configure-pages가 알려 주는 경로를 넘긴다.
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeBasePath } from '../minigames-home/lib/renderHome.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(ROOT, 'pages-dist');
/** 저장소 이름(github.com/James0083/playlab) → https://james0083.github.io/playlab/ */
const DEFAULT_BASE_PATH = '/playlab/';

const basePath = normalizeBasePath(process.env.PLAYLAB_BASE_PATH ?? DEFAULT_BASE_PATH);
const env = {
  ...process.env,
  PLAYLAB_BASE_PATH: basePath,
  PLAYLAB_LINK_LOCAL_GAMES: '1',
  PLAYLAB_HOME_OUT_DIR: OUT_DIR,
};
const run = (args) => execFileSync('pnpm', args, { cwd: ROOT, stdio: 'inherit', env });

const slugs = (await readdir(ROOT, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('game-'))
  .map((entry) => entry.name.slice('game-'.length))
  .sort();

console.log(`[pages] 경로 앞부분 ${basePath}, 게임 ${slugs.join(', ')}`);
run(['--filter', '@minigames/engine', 'build']);
// 홈 빌드가 OUT_DIR을 비우고 index.html·404.html을 쓴다. 게임은 그 아래에 모은다
run(['--filter', 'minigames-home', 'build']);
await mkdir(join(OUT_DIR, 'games'), { recursive: true });
for (const slug of slugs) {
  run(['--filter', `game-${slug}`, 'build']);
  await cp(join(ROOT, `game-${slug}`, 'dist'), join(OUT_DIR, 'games', slug), { recursive: true });
}
// GitHub Pages의 Jekyll 처리를 끈다. 밑줄로 시작하는 파일을 빼는 등 Vite 산출물을 건드리지 않게 한다
await writeFile(join(OUT_DIR, '.nojekyll'), '');

console.log(`[pages] ${OUT_DIR} 완성 → https://<사용자>.github.io${basePath}`);
