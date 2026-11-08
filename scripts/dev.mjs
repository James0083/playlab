// 로컬 통합 개발 서버. 배포 환경과 같은 경로 구조로 띄운다.
//   /                 → 홈 (minigames-home, 개발 모드로 빌드: 레포에 있는 게임을 모두 링크)
//   /games/<slug>/    → 게임 Vite 개발 서버 (코드 수정 시 바로 반영)
// 실행: pnpm dev
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { connect } from 'node:net';
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

/** 포트에 이미 누가 듣고 있는지. 이전 pnpm dev가 남긴 서버가 있으면 그 서버로 프록시되어 엉뚱한 게임이 뜬다 */
const isPortInUse = (port) =>
  new Promise((resolve) => {
    const socket = connect({ port, host: 'localhost' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });

const ports = [FRONT_PORT, ...slugs.map((_, i) => FIRST_GAME_PORT + i)];
const busyPorts = [];
for (const port of ports) if (await isPortInUse(port)) busyPorts.push(port);
if (busyPorts.length > 0) {
  console.error(`[dev] 이미 쓰는 포트가 있어요: ${busyPorts.join(', ')}`);
  console.error(
    '[dev] 이전 pnpm dev가 남아 있을 수 있어요. 아래로 확인한 뒤 해당 PID를 끄고 다시 실행하세요.',
  );
  console.error(
    `      lsof -nP -sTCP:LISTEN ${busyPorts.map((port) => `-iTCP:${port}`).join(' ')}`,
  );
  console.error('[dev] 서버를 하나 더 띄우려면 PORT, GAME_PORT로 다른 번호를 주세요.');
  process.exit(1);
}

console.log('[dev] 엔진 빌드');
run(['--filter', '@minigames/engine', 'build']);
console.log('[dev] 홈 빌드(개발 모드)');
run(['--filter', 'minigames-home', 'build'], { PLAYLAB_LINK_LOCAL_GAMES: '1' });

let isShuttingDown = false;
/** 홈 개발 서버. 게임 서버가 먼저 죽으면 아직 null일 수 있다 */
let front = null;
const children = slugs.map((slug, i) => {
  const port = FIRST_GAME_PORT + i;
  const child = spawn(
    'pnpm',
    ['--filter', `game-${slug}`, 'exec', 'vite', '--port', String(port), '--strictPort'],
    // 게임 서버(pnpm → vite)를 따로 프로세스 그룹으로 묶어, 끌 때 그룹째 끈다.
    // pnpm만 끄면 그 아래 vite가 고아로 남아 포트를 계속 차지했다.
    { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'], detached: true },
  );
  // 게임 서버 하나가 죽으면 그 경로만 빈 채로 돌지 않게 전체를 끝낸다
  child.once('exit', (code) => {
    if (isShuttingDown) return;
    console.error(`[dev] game-${slug} 개발 서버가 종료됐어요(코드 ${code}). 전체를 끕니다.`);
    void shutdown(1);
  });
  return { slug, port, child };
});

/** 게임 서버 프로세스 그룹을 끈다. 이미 꺼졌으면 무시한다 */
function killGameServers() {
  for (const { child } of children) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* 이미 종료됨 */
    }
  }
}
// 어떤 이유로 끝나든(오류 포함) 게임 서버를 남기지 않는다
process.on('exit', killGameServers);

front = await createServer({
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

async function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  killGameServers();
  await front?.close();
  process.exit(exitCode);
}
// Ctrl+C, kill, 터미널 창 닫기(SIGHUP) 모두 같은 정리를 거친다
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => void shutdown());
