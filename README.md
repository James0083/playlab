# minigames

james-playlab.com 미니게임 모노레포. 계획과 결정 사항은 [minigames-dev-plan.md](minigames-dev-plan.md)에 있습니다.

| 폴더 | 내용 | 배포 |
|---|---|---|
| `minigames-engine/` | `@minigames/engine`: 훅, 공통 컴포넌트, Supabase 래퍼, `supabase/migrations` | 배포 안 함 (`workspace:*`) |
| `minigames-home/` | 홈(정적) + 라우터 Worker. 게임 목록 단일 소스는 `lib/games.ts` | wrangler |
| `game-tteokchigi/` | 떡치기 (Vite + React). 판정 규칙은 `src/rules.ts` | Cloudflare Pages |

요구 사항: Node 24, pnpm 12.15.0 (`packageManager` 필드에 고정)

```sh
pnpm install
pnpm dev:game     # 엔진 빌드 후 떡치기 개발 서버
pnpm test         # Worker 라우팅 + 떡치기 규칙
pnpm typecheck
pnpm build        # 엔진 → 홈/게임 순서로 빌드
```

Supabase 없이도 동작합니다(로컬 최고기록만 사용). 연결하려면 `game-tteokchigi/.env.example`을 `.env`로 복사해 값을 채우고
`minigames-engine/supabase/migrations/0001_init.sql`을 적용하세요.

## 패키지 버전 규칙

안정적이고 사용량이 일정 이상인 버전 중 최신을 쓰고, 정확한 버전으로 고정합니다.

- 정식 릴리스만 쓴다
- 게시 후 14일 이상 지난 버전만 쓴다. `pnpm-workspace.yaml`의 `minimumReleaseAge`로 강제된다
- 해당 버전의 주간 다운로드가 100만 이상이어야 한다
- 새 메이저 버전은 출시 후 60일이 지나야 쓴다

## 새 게임 추가

1. `game-tteokchigi`를 복사해 `game-<slug>`로 만들고 `package.json`의 `name`과 `vite.config.ts`의 `base`(`/games/<slug>/`)를 바꾼다
2. Cloudflare Pages 프로젝트 생성
   - 빌드 명령: `pnpm --filter game-<slug>... build`
   - 출력 디렉터리: `game-<slug>/dist`
   - 감시 경로: `game-<slug>/*`, `minigames-engine/*`, `pnpm-lock.yaml`
3. Supabase `games` 테이블에 행 추가 (없으면 점수 저장이 `unknown game`으로 거부된다)
4. `minigames-home/lib/games.ts`에 항목 추가(`origin`에 실제 `*.pages.dev` 주소) → `status: 'live'` → `pnpm --filter minigames-home deploy`
