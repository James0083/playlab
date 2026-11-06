# 미니게임 개발 계획

> 웹앱 + 토스 미니앱(앱인토스) 타겟 / 모노레포 + 게임별 독립 배포 + 공통 엔진 패키지
> 최종 수정: 2026-11-06 (검토 결과 반영, 뼈대 구현 완료)

---

## 개요

단순 조작 한 가지로 경쟁할 수 있는 미니게임 시리즈.
각 게임은 **10~60초 플레이(또는 무한 콤보) → 점수 측정 → 최고기록 저장 + 공유** 구조를 공유한다.

### 결정 사항과 남은 결정

| 항목 | 상태 |
|---|---|
| 도메인 | **`james-playlab.com`으로 결정, 구매 전.** 2026-11-06 whois 기준 미등록. 원래 계획의 `minigames.com`은 다른 사람이 등록한 도메인이다 |
| 레포 구성 | **모노레포로 결정.** 아래 [레포 구성](#레포-구성) 참고 |
| 떡치기 시작 BPM | 임시 60. 플레이테스트 후 확정 |
| 홈 디자인 | "디자인 완료"로 적혀 있던 `minigames-home.html`이 작업 폴더에 없다. 파일을 찾아 `minigames-home/src/index.html`에 반영해야 한다 |

---

## 기술 스택과 버전

### 프레임워크: Vite + React (Next.js 사용 안 함)

- 빈 Next 14 페이지만 빌드해도 첫 로드 JS가 87.6KB라서, 첫 진입 번들 100KB gzip 목표를 지키기 어렵다
- 게임은 서버 기능이 필요 없는 정적 페이지라 Next의 장점이 거의 없다
- 현재 떡치기 첫 진입 JS: **gzip 약 72KB**. Supabase 클라이언트(약 55KB)는 결과 화면에서만 동적으로 불러온다

### 버전 선정 기준

안정적이고 사용량이 일정 이상인 버전 중 최신을 쓰고, 막 나왔거나 불안정한 버전은 제외한다.

- 정식 릴리스만 쓴다(prerelease 제외)
- 게시 후 14일 이상, 해당 버전 주간 다운로드 100만 이상
- 새 메이저 버전은 x.0.0 출시 후 60일 이상
- 기준을 통과해도 도구 호환이 깨지면 제외한다
- `package.json`은 정확한 버전으로 고정한다. `pnpm-workspace.yaml`의 `minimumReleaseAge: 20160`(14일)이 안전장치 역할을 한다

| 패키지 | 버전 | 비고 |
|---|---|---|
| Node.js | 24 (LTS) | 루트 `.node-version`. Cloudflare 빌드도 이 값을 따른다 |
| pnpm | 12.15.0 | `packageManager` 필드로 고정 |
| react / react-dom | 19.3.1 | |
| vite | 8.3.5 | 8.3.6은 게시 당일이라 제외 |
| @vitejs/plugin-react | 6.1.2 | 6.2.x는 3일 된 버전이라 제외 |
| typescript | 6.0.3 | 7.0.2는 tsup 타입 선언 빌드가 실패해 제외 |
| tsup | 8.5.1 | 9.0.0은 새 메이저 22일째라 제외 |
| wrangler | 4.152.0 | 매주 새 버전이 나온다. 14일 지난 것 중 최신 |
| @supabase/supabase-js | 2.118.0 | |
| @types/react, @types/react-dom | 19.3.0 | |
| @types/node | 24.19.2 | Node 24에 맞춤 |

> 엔진의 타입 선언은 tsup이 아니라 `tsc -p tsconfig.build.json`으로 만든다. tsup 8.5.1이 내부에서 쓰는 `baseUrl` 옵션이 TS 6에서 지원 중단 오류를 내기 때문이다.

---

## 배포 아키텍처 (Cloudflare 무료 플랜)

```
사용자 브라우저
      │
      ▼
james-playlab.com  (Cloudflare DNS)
      │
      ▼
Cloudflare Worker "minigames-router" (minigames-home)
      │
      ├── /                     → Worker 정적 자산(홈). Worker 코드를 거치지 않는다
      ├── /games/tteokchigi/*   → Cloudflare Pages: game-tteokchigi
      ├── /games/dalgona/*      → Cloudflare Pages: game-dalgona
      └── /games/<slug>/*       → Cloudflare Pages: game-<slug>
```

- 각 게임은 **독립된 Cloudflare Pages 프로젝트**로 배포한다. Worker가 경로를 보고 프록시하므로 사용자는 항상 `james-playlab.com` 안에 머문다
- 홈은 Pages가 아니라 **Worker 정적 자산(`[assets]`)**으로 서빙한다. `run_worker_first = ["/games/*"]`라 홈 요청은 무료 한도(하루 10만 요청)를 쓰지 않는다
- 게임 요청은 자산 하나하나가 Worker 요청으로 집계된다. 게임 1회 진입은 약 5~10 요청이므로 대략 하루 1만~2만 회 진입이 한계다. 넘으면 유료 플랜($5/월)을 검토한다

### 게임 목록: 단일 소스

`minigames-home/lib/games.ts`의 `GAMES` 배열 하나에서 Worker 라우팅과 홈 화면을 모두 만든다.

```ts
{ slug: 'tteokchigi', name: '떡치기', emoji: '🔨', description: '…',
  origin: 'https://game-tteokchigi.pages.dev', status: 'coming-soon' }
```

- `origin`은 직접 적는다. Pages 프로젝트 이름이 이미 쓰이면 `*.pages.dev` 주소에 접미사가 붙을 수 있다
- `status: 'live'`인 게임만 Worker가 라우팅한다

### Worker 동작 ([worker.js](minigames-home/worker.js), 테스트 6개)

- `/games/<slug>` 접두사를 제거하고 쿼리를 유지해 해당 Pages로 프록시한다
- Pages가 보낸 리다이렉트(예: `/about.html` → `/about`)의 `Location`을 공개 경로(`/games/<slug>/about`)로 되돌린다. 원래 계획의 코드는 이 부분이 없어 리다이렉트 시 홈으로 튕겼다
- GET/HEAD만 허용한다. 점수 API는 Supabase로 직접 간다
- 접두사만 비슷한 경로(`/games/abc` vs `/games/a`)는 홈으로 넘긴다

### `wrangler.toml`

```toml
name = "minigames-router"
main = "worker.js"
compatibility_date = "2026-11-01"

[assets]                      # Workers Sites([site])는 지원 중단 → Static Assets 사용
directory = "./dist"
binding = "ASSETS"
run_worker_first = ["/games/*"]

# [[routes]]                  # 도메인 확정 후 해제
# pattern = "james-playlab.com/*"
# zone_name = "james-playlab.com"
```

### 게임 빌드 규칙

- 각 게임의 `vite.config.ts`에 `base: '/games/<slug>/'`를 둔다. Worker가 접두사를 제거해 프록시하므로, 산출물 안의 자산 경로에는 접두사가 있어야 한다
- 효과음 등 `public/` 파일은 `import.meta.env.BASE_URL` 기준으로 참조한다

### 새 게임 추가 체크리스트

1. `game-tteokchigi`를 복사해 `game-<slug>`로 만들고 `vite.config.ts`의 `base`를 바꾼다
2. Cloudflare Pages 프로젝트를 만들어 레포에 연결([Pages 설정](#cloudflare-pages-설정-게임마다)) → 실제 `*.pages.dev` 주소 확인
3. Supabase `games` 테이블에 행을 추가한다. 없으면 점수 저장이 `unknown game`으로 거부된다
4. `minigames-home/lib/games.ts`에 항목 추가(`origin`에 2의 주소) → `status: 'live'` → `pnpm deploy`

---

## 레포 구성

**모노레포 1개** (GitHub [`James0083/playlab`](https://github.com/James0083/playlab)). 원래 계획의 게임별 독립 레포 대신 이 방식을 택했다.

```
playlab/                   ← pnpm workspace
├── minigames-engine/      ← @minigames/engine (npm에 배포하지 않음, workspace:*로 참조)
├── minigames-home/        ← 홈 + 라우터 Worker
├── game-tteokchigi/
└── game-…/
```

- **배포는 여전히 게임별로 독립적이다.** 게임마다 Cloudflare Pages 프로젝트를 따로 만들어 같은 레포에 연결한다
- 엔진 변경은 배포 없이 바로 모든 게임에 반영된다. 한 번의 `pnpm test` / `pnpm build`로 전체 영향을 확인한다
- 비공개 패키지 레지스트리와 토큰 설정이 필요 없다

### Cloudflare Pages 설정 (게임마다)

| 항목 | 값 |
|---|---|
| 루트 디렉터리 | (레포 루트) |
| 빌드 명령 | `pnpm --filter game-<slug>... build` (`...`는 엔진 같은 의존 패키지를 먼저 빌드) |
| 출력 디렉터리 | `game-<slug>/dist` |
| 빌드 감시 경로 | `game-<slug>/*`, `minigames-engine/*`, `pnpm-lock.yaml` (다른 게임 변경 시 재빌드하지 않음) |
| Node 버전 | 루트 `.node-version`(24) 자동 인식 |

홈과 Worker는 Pages가 아니라 `pnpm --filter minigames-home deploy`(wrangler)로 배포한다. 나중에 GitHub Actions로 자동화한다.

---

## Phase 0 — 공통 엔진 패키지 `@minigames/engine` ✅ 뼈대 완료

```
minigames-engine/
├── src/
│   ├── hooks/
│   │   ├── useGameSession.ts     # 상태머신 idle → countdown → playing → result, 타이머(null이면 무한 콤보)
│   │   ├── useLeaderboard.ts     # Top 10 조회 + refresh (Realtime 구독 안 함)
│   │   ├── useDeviceMotion.ts    # DeviceMotion + DeviceOrientation 통합, iOS 권한 요청
│   │   └── useHaptics.ts         # navigator.vibrate 래퍼 (미지원 환경에선 아무 동작 없음)
│   ├── components/
│   │   ├── GameShell.tsx         # 공통 레이아웃 (헤더, 남은 시간, 점수)
│   │   ├── Countdown.tsx         # 3·2·1·GO
│   │   ├── ScoreResult.tsx       # 점수, 최고기록 비교, 닉네임 등록, 리더보드, 공유
│   │   ├── Leaderboard.tsx       # Top 10
│   │   └── ShareButton.tsx       # Canvas로 카드 이미지 생성 → Web Share API (미지원 시 다운로드)
│   ├── lib/
│   │   ├── supabase.ts           # 설정 + 동적 import 클라이언트 (미설정 시 오프라인 모드)
│   │   └── score.ts              # 점수 제출/조회, 익명 player_id, 로컬 최고기록
│   ├── styles.css                # 공통 스타일, 라이트/다크 토큰
│   └── index.ts
├── supabase/migrations/0001_init.sql
├── tsup.config.ts                # JS 빌드
└── tsconfig.build.json           # 타입 선언 빌드
```

**원래 계획에서 바뀐 점**
- `next` peer dependency 제거. React 18/19만 peer로 둔다
- 리더보드: Realtime 구독 → 결과 화면에서 조회. Supabase 무료 플랜은 동시 Realtime 연결이 200개까지라, 동접 200명이면 막힌다
- 공유 이미지: html2canvas(약 45KB gzip) → Canvas API로 직접 그린다
- Supabase 미설정 시 오프라인 모드(로컬 최고기록만 사용)로 동작한다
- localStorage 접근 실패(사생활 보호 모드 등)에도 게임은 계속된다

### 남은 태스크

- [ ] 엔진 단위 테스트 (useGameSession 상태 전이, score.ts)
- [ ] 404 / 로딩 / 에러 공통 화면
- [ ] 사운드 유틸: Web Audio 기반 재생 + iOS 오디오 잠금 해제(첫 탭에서 AudioContext resume)

---

## Phase 1 — 공통 인프라 (Supabase) ✅ 마이그레이션 작성, 미적용

[0001_init.sql](minigames-engine/supabase/migrations/0001_init.sql). 메모리 Postgres(PGlite)에서 접근 규칙 10가지를 검증했다.

| 객체 | 내용 |
|---|---|
| `games` | slug, name, description, active, **max_score**(이론상 최고 점수, 초과 제출 거부) |
| `scores` | player_id는 uuid. 닉네임 1~12자, score ≥ 0, metadata 2KB 이하로 제약 |
| `submit_score()` | 점수 저장의 유일한 경로. 게임 존재·활성 여부, max_score, 같은 플레이어 5초당 1회를 검사 |
| `get_top10()` | **플레이어별 최고 기록** 기준 Top 10. 한 사람이 순위를 독점하지 않는다 |
| RLS | `games`는 읽기만 허용. `scores`는 직접 읽기/쓰기 모두 차단 |

> **점수 조작은 완전히 막을 수 없다.** 클라이언트가 계산한 점수를 받는 구조이기 때문이다. 위 장치는 명백한 조작만 걸러낸다. 순위 경쟁이 중요해지면 플레이 입력 로그를 함께 보내 서버에서 재계산하는 방식을 검토한다.

### 태스크

- [ ] Supabase 프로젝트 생성 후 마이그레이션 적용
- [ ] 게임별 `max_score` 확정 (떡치기는 박자 수 × 2로 계산 가능)
- [ ] 닉네임 금칙어 필터
- [ ] 무료 프로젝트는 1주일 동안 활동이 없으면 일시정지된다. 출시 후 트래픽이 적은 시기에 대비책 마련

---

## Phase 2 — 메인 홈 `minigames-home` ✅ 뼈대 완료 (임시 화면)

```
minigames-home/
├── worker.js / worker.test.js   # 라우터 + 테스트
├── wrangler.toml
├── lib/games.ts                 # 게임 목록 단일 소스
├── scripts/build.mjs            # games.ts → dist/index.html 생성
└── src/index.html               # 홈 템플릿 (임시)
```

### 태스크

- [ ] 디자인 완료본(`minigames-home.html`) 찾아서 `src/index.html`에 반영
- [ ] 도메인 구매 → Cloudflare에 연결 → `wrangler.toml` routes 해제
- [ ] Worker 배포 (`pnpm deploy`)

---

## Phase 3 — 1차 게임 (3종)

### 각 게임 공통 구조

```
game-<slug>/
├── index.html
├── vite.config.ts        # base: '/games/<slug>/'
├── src/
│   ├── main.tsx          # Supabase 설정 + 렌더링
│   ├── <slug>-game.tsx   # 게임 화면
│   ├── rules.ts          # 판정·점수 규칙 (순수 함수, 테스트 대상)
│   └── rules.test.ts
├── public/sounds/
└── .env.example          # VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
```

### 3-1. 떡치기 🔨 ✅ 플레이 가능한 뼈대

**조작:** 타이밍 탭 / **난이도:** ★★★

```
흐름: 절굿공이 올라감 → 정점 도달 → 탭
판정: ±100ms → PERFECT(2점), ±200ms → GOOD(1점), 그 외 → MISS(0점)
종료: 60초. 시작 BPM 60(임시), 10초마다 +5 (마지막 구간 85)
한 박자에 한 번만 인정 (연타 방지)
```

**완료된 것:** 판정·BPM·박자 스케줄 규칙과 테스트, 절굿공이 애니메이션, 진동, 결과 화면 연결

**원래 계획에서 바뀐 점:** 절굿공이를 CSS `@keyframes`가 아니라 requestAnimationFrame으로 움직인다. 애니메이션과 판정이 같은 시계를 써야 BPM이 바뀌어도 어긋나지 않는다.

**남은 태스크**
- [ ] 사운드 연결. 판정 시계를 `AudioContext.currentTime`으로 교체
- [ ] 입력 지연 보정(기기별 오프셋 캘리브레이션)
- [ ] PERFECT/GOOD/MISS 비주얼 이펙트, 떡/절굿공이 그래픽
- [ ] 사운드 파일 확보: `yoi-yoiyoi.mp3`, `thud-perfect.mp3`, `miss.mp3`. **사용 권한(라이선스)을 확인한 음원만 쓴다**

### 3-2. 달고나 뽑기 🍯

**조작:** 드래그 / **난이도:** 모양마다 다름 (동그라미 ★ → 토끼 ★★★★★)

```
외곽선 Path 정의 → 드래그 추적 → 이탈 거리 계산 → 균열 카운트
균열 3회 → 게임 오버
완성 → 모양 기준 점수 × 완성도(이탈 패널티) = 최종 점수
```

| 모양 | 난이도 | 기준 점수 |
|------|-------|-------|
| 동그라미 | ★ | 100 |
| 세모 | ★★ | 200 |
| 네모 | ★★★ | 300 |
| 우산 | ★★★★ | 500 |
| 집 | ★★★★ | 500 |
| 토끼 | ★★★★★ | 800 |

**구현 순서**
1. SVG로 모양 Path 정의 (6종), `getPointAtLength`로 샘플링
2. `PointerEvent` 드래그 추적(`touch-action: none`) + Path 근접도 계산
3. **"완성" 판정 정의**: 경로 샘플점 중 일정 비율 이상을 지나야 완성. 근접도만 보면 일부만 긋고 끝낼 수 있다
4. 균열 애니메이션: SVG filter는 모바일에서 느리므로 미리 만든 균열 이미지 오버레이 권장
5. 모양 선택 화면 (순차 해금, 로컬 저장)
6. 점수 계산 및 저장

### 3-3. 버블티 흔들기 🧋

**조작:** 폰 흔들기 (DeviceMotion) / **난이도:** ★ (튜토리얼 역할)

```
10초간 흔들기 → 가속도 크기 누적 → 균등함 보너스
너무 격렬하면 넘침 패널티
최종: 완성도 % + 넘침 없음 보너스
```

**구현 순서**
1. `useDeviceMotion`으로 `accelerationIncludingGravity` 샘플링. iOS는 시작 버튼 탭 안에서 권한 요청
2. 버블티 잔 애니메이션
3. 넘침 경고 + 패널티 계산
4. **센서가 없는 환경(데스크톱) 대체 입력**: 마우스 흔들기 또는 "모바일에서 플레이" QR 안내
5. 결과 화면

> 기기마다 센서 값의 범위가 달라 순위의 공정성이 떨어질 수 있다. 상한값을 두고, 흔들기 게임 리더보드는 참고용으로 다루는 것도 검토한다.

---

## Phase 4 — 2차 게임 (3종)

### 4-1. 짜장면 비비기 🍜
**조작:** 폰 회전 또는 원형 흔들기 (DeviceOrientation / DeviceMotion)
**핵심:** 두 센서 중 더 큰 입력값 채택. 방향 다양성(시계/반시계 교차) 보너스. 데스크톱 대체 입력 필요

### 4-2. 팽이 돌리기 🌀
**조작:** 폰 회전 또는 흔들기로 RPM 증가 → 기울이기로 균형 유지
**핵심:** RPM이 임계값 아래로 떨어지면 흔들리기 시작, 쓰러지면 종료

### 4-3. 제기차기 🪶
**조작:** 타이밍 탭
**핵심:** 연속 콤보 × 속도 가속. 헛차면 즉시 종료 (`useGameSession({ durationMs: null })`)

---

## Phase 5 — 토스 미니앱(앱인토스) 연동

> 원래 계획의 `@tosspayments/minipay`는 npm에 없는 패키지다. 토스 미니앱은 **앱인토스** 플랫폼과 `@apps-in-toss/web-framework` SDK를 쓴다. 착수 전에 공식 문서로 배포 방식과 심사 기준을 확인한다.

**확인된 사실**
- 게임 카테고리 미니앱은 `getUserKeyForGame()`으로 사용자 식별 키(hash)를 받는다
- 이 hash는 **게임(미니앱)마다 다르다.** 여러 게임을 아우르는 `player_id`로 쓸 수 없다
- 샌드박스에서는 mock 값이 반환되므로 실제 토스 앱에서 QR로 테스트해야 한다

### 태스크

- [ ] 앱인토스 개발자센터 등록, 배포 방식 확인 (웹 URL 연결인지 번들 업로드인지)
- [ ] 미니앱 단위 결정: 게임별 미니앱 vs 게임 모음 미니앱 하나. 사용자 키 범위가 이 결정에 따라 달라진다
- [ ] 토스 사용자 키 → `player_id` 연결 (토스 환경일 때만 익명 UUID 대체)
- [ ] 진동: 토스 환경에서는 SDK의 햅틱 기능 사용 여부 확인 (iOS 웹은 `navigator.vibrate` 미지원)
- [ ] 미니앱 전용 UI 조정 (safe area, 토스 네이티브 뒤로가기)
- [ ] 점수 공유 → 토스 공유 기능 연동
- [ ] 미니앱 심사 제출

---

## Phase 6 — 3차 게임 (전통 놀이 3종)

> "오징어게임"은 타사 IP다. 게임명·마케팅 문구에 쓰지 않고 "전통 놀이"로 부른다.

### 6-1. 줄넘기 🪢
타이밍 탭 / 연속 성공 최대화 / 더블더치 모드

### 6-2. 비석치기 🪨
플릭 조준 / 거리·바람 변수 / 라운드당 점수

### 6-3. 구슬치기 🔵
플릭 충돌 물리 / 홀짝 맞히기 변형 모드

---

## Phase 7 — 나머지 게임

> 성과 지표 확인 후 우선순위 결정

- 딱지치기 🃏 (스와이프 세기)
- 풍선 불기 🎈 (홀드 타이밍)
- 국수 뽑기 🍝 (반복 스와이프)
- 성냥 켜기 🔥 (일정 속도 유지)

---

## 공통 체크리스트

### 각 게임 완성 기준

- [ ] 게임 플레이 (조작 → 판정 → 종료)
- [ ] 시간제(10~60초) 또는 무한 콤보 중 선택
- [ ] 판정·점수 규칙을 `rules.ts` 순수 함수로 분리하고 테스트
- [ ] Supabase `games` 행 추가 + `max_score` 설정
- [ ] 점수 저장, 리더보드 Top 10 표시
- [ ] 점수 카드 이미지 → Web Share API 공유 (미지원 시 다운로드)
- [ ] 센서 게임: iOS 권한 요청 + 데스크톱 대체 입력
- [ ] 사운드 게임: iOS 오디오 잠금 해제
- [ ] 모바일 반응형 (360px ~ 430px 기준)
- [ ] 다크모드 대응

### 성능 목표

| 지표 | 목표 | 현재 (떡치기) |
|---|---|---|
| LCP | < 1.5s | 미측정 |
| 프레임 드롭 | < 1% (60fps 유지) | 미측정 |
| 첫 게임 진입 JS 번들 | < 100KB gzip | 약 72KB (Supabase는 결과 화면에서 지연 로드) |

---

## 개발 우선순위

```
Phase 0 (엔진) ✅ 뼈대
  → Phase 1 (Supabase) ✅ 마이그레이션 작성, 적용 대기
  → Phase 2 (홈 + Worker) ✅ 뼈대, 도메인·디자인 대기
  → Phase 3 (떡치기 완성 → 달고나 → 버블티)
  → Phase 4 (짜장면 · 팽이 · 제기)
  → Phase 5 (토스 연동)
  → Phase 6 (전통 놀이 3종)
  → Phase 7 (나머지)
```

> Phase 번호를 실제 진행 순서에 맞게 바꿨다. 원래의 Phase 6(토스)이 Phase 5가 되고, 원래의 Phase 5(오징어게임 3종)가 Phase 6(전통 놀이 3종)이 됐다.

스펙이 가장 완성된 **떡치기**를 엔진의 첫 실전 테스트 케이스로 쓴다.
떡치기 완성 → 엔진 API 확정 → 나머지 게임은 `game-tteokchigi`를 복사하고 게임 로직만 교체하는 패턴으로 만든다.
