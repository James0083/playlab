// 템플릿(templates/game)을 복사해 새 게임 폴더(game-<slug>)를 만든다.
// 실행: pnpm new-game --slug bubble-tea --name BubbleTea --prefix bt --title "버블티 흔들기"
import { existsSync } from 'node:fs';
import { cp, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEMPLATE_DIR = join(ROOT, 'templates', 'game');
/** 템플릿 안의 자리표시자. 템플릿을 고칠 때 이 낱말들을 다른 뜻으로 쓰지 않는다 */
const PLACEHOLDER = { slug: 'template', name: 'Template', prefix: 'tp', title: '게임 이름' };
/** 복사하지 않는 설치·빌드 결과물 */
const SKIPPED = new Set(['node_modules', 'dist']);

const RULES = {
  slug: { pattern: /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, example: 'bubble-tea (URL /games/<slug>/)' },
  name: { pattern: /^[A-Z][A-Za-z0-9]*$/, example: 'BubbleTea (컴포넌트 BubbleTeaGame)' },
  prefix: { pattern: /^[a-z]{2}$/, example: 'bt (CSS 클래스 접두사 2글자)' },
  title: { pattern: /\S/, example: '"버블티 흔들기" (화면 제목)' },
};

function fail(message) {
  console.error(`[new-game] ${message}`);
  console.error(
    '사용법: pnpm new-game --slug bubble-tea --name BubbleTea --prefix bt --title "버블티 흔들기"',
  );
  process.exit(1);
}

const { values } = parseArgs({
  options: Object.fromEntries(Object.keys(RULES).map((key) => [key, { type: 'string' }])),
});

for (const [key, { pattern, example }] of Object.entries(RULES)) {
  if (!pattern.test(values[key] ?? ''))
    fail(`--${key} 값이 없거나 형식이 맞지 않아요. 예: ${example}`);
}
const { slug, name, prefix, title } = values;

const target = join(ROOT, `game-${slug}`);
if (existsSync(target)) fail(`game-${slug} 폴더가 이미 있어요.`);
if (prefix === 'mg') fail('mg-는 엔진 접두사예요. 다른 2글자를 고르세요.');

// 다른 게임이 이미 쓰는 CSS 접두사면 스타일이 섞인다
const games = (await readdir(ROOT)).filter((entry) => entry.startsWith('game-'));
for (const game of games) {
  const css = await readFile(join(ROOT, game, 'src', 'game.css'), 'utf8').catch(() => '');
  if (css.includes(`.${prefix}-`)) fail(`${game}이(가) 이미 ${prefix}- 접두사를 써요.`);
}

await cp(TEMPLATE_DIR, target, {
  recursive: true,
  filter: (source) => !SKIPPED.has(basename(source)),
});
await rename(
  join(target, 'src', `${PLACEHOLDER.name}Game.tsx`),
  join(target, 'src', `${name}Game.tsx`),
);

const entries = await readdir(target, { recursive: true, withFileTypes: true });
for (const entry of entries.filter((item) => item.isFile())) {
  const file = join(entry.parentPath, entry.name);
  const text = await readFile(file, 'utf8');
  const replaced = text
    .replaceAll(PLACEHOLDER.title, title)
    .replaceAll(`${PLACEHOLDER.name}Game`, `${name}Game`)
    .replace(new RegExp(`\\b${PLACEHOLDER.slug}\\b`, 'g'), slug)
    // 앞에 글자나 -가 붙은 경우(예: http-)는 접두사가 아니다
    .replace(new RegExp(`(?<![\\w-])${PLACEHOLDER.prefix}-`, 'g'), `${prefix}-`);
  if (replaced !== text) await writeFile(file, replaced);
}

console.log(`[new-game] game-${slug}을(를) 만들었어요. 다음 순서로 진행하세요.
  1. pnpm install                       새 패키지를 워크스페이스에 연결
  2. minigames-home/lib/games.ts        항목 추가(status: 'coming-soon') → pnpm dev 홈에 보인다
  3. src/rules.ts, src/${name}Game.tsx   TODO 주석의 예시를 이 게임 내용으로 교체
  나머지는 minigames-dev-plan.md의 "새 게임 추가 체크리스트"를 따른다.`);
