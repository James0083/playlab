// 로컬 통합 개발 서버. 배포 환경과 같은 경로 구조로 띄운다.
//   /                 → 홈 (minigames-home, 개발 모드로 빌드: 레포에 있는 게임을 모두 링크)
//   /games/<slug>/    → 게임 Vite 개발 서버 (코드 수정 시 바로 반영)
// 실행: pnpm dev
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FRONT_PORT = Number(process.env.PORT ?? 5173);
/** 게임 개발 서버는 이 번호부터 차례로 쓴다(GAME_PORT로 바꿀 수 있다. 서버를 두 개 띄울 때) */
const FIRST_GAME_PORT = Number(process.env.GAME_PORT ?? 5201);

const run = (args, env = {}) =>
  execFileSync('pnpm', args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });

const slugs = readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('game-'))
  .map((entry) => entry.name.slice('game-'.length))
  .sort();

console.log('[dev] 엔진 빌드');
run(['--filter', '@minigames/engine', 'build']);
console.log('[dev] 홈 빌드(개발 모드)');
run(['--filter', 'minigames-home', 'build'], { PLAYLAB_DEV: '1' });

const children = slugs.map((slug, i) => {
  const port = FIRST_GAME_PORT + i;
  const child = spawn(
    'pnpm',
    ['--filter', `game-${slug}`, 'exec', 'vite', '--port', String(port), '--strictPort'],
    { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] },
  );
  return { slug, port, child };
});

const front = await createServer({
  configFile: false,
  root: `${ROOT}/minigames-home/dist`,
  appType: 'mpa',
  logLevel: 'warn',
  plugins: [
    {
      // 없는 경로는 배포 환경(Worker의 not_found_handling)과 같이 홈의 404.html을 돌려준다
      name: 'playlab-not-found',
      configureServer(server) {
        return () => {
          server.middlewares.use((request, response, next) => {
            // 홈 빌드 결과에 실제로 있는 파일(예: /, /index.html)은 Vite가 그대로 제공하게 둔다
            const path = new URL(request.url ?? '/', 'http://localhost').pathname;
            const file = `${ROOT}/minigames-home/dist${path.endsWith('/') ? `${path}index.html` : path}`;
            if (existsSync(file)) return next();
            response.statusCode = 404;
            response.setHeader('content-type', 'text/html; charset=utf-8');
            response.end(readFileSync(`${ROOT}/minigames-home/dist/404.html`));
          });
        };
      },
    },
  ],
  server: {
    port: FRONT_PORT,
    strictPort: true,
    // 게임 경로는 해당 게임 개발 서버로 넘긴다. 경로는 그대로 둔다(게임의 base가 /games/<slug>/).
    proxy: Object.fromEntries(
      children.map(({ slug, port }) => [
        `/games/${slug}`,
        { target: `http://localhost:${port}`, ws: true },
      ]),
    ),
  },
});
await front.listen();

console.log(`\n[dev] http://localhost:${FRONT_PORT}/  (홈)`);
for (const { slug } of children) console.log(`[dev] http://localhost:${FRONT_PORT}/games/${slug}/`);
console.log('[dev] 끝내려면 Ctrl+C');

const shutdown = async () => {
  for (const { child } of children) child.kill();
  await front.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
