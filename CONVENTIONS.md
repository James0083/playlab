# 코드 컨벤션

이 레포의 코드는 **처음 보는 개발자가 파일 하나만 열어도 무엇을 왜 하는지 알 수 있게** 쓴다.
규칙이 애매하면 "6개월 뒤 이 코드를 처음 보는 사람이 덜 헤매는 쪽"을 고른다.

- 도구로 검사할 수 있는 규칙은 ESLint·Prettier·TypeScript가 강제한다. 아래에서 🔧 표시가 붙은 항목이다
- 나머지는 리뷰에서 지킨다
- 이 문서에 없는 경우는 주변 코드를 따른다

## 0. 커밋 전에

```sh
pnpm check      # 포맷 검사 → lint → 타입 검사 → 테스트
pnpm format     # 포맷 자동 수정
pnpm lint:fix   # 자동 수정 가능한 lint 오류 수정
```

`pnpm check`가 통과하지 않으면 커밋하지 않는다.

---

## 1. 폴더와 파일

| 대상 | 파일 이름 | 예 |
|---|---|---|
| React 컴포넌트 | PascalCase.tsx, 파일 하나에 공개 컴포넌트 하나 | `ScoreResult.tsx`, `TteokchigiGame.tsx` |
| 훅 | `useXxx.ts` | `useGameSession.ts` |
| 그 외 모듈 | camelCase.ts | `score.ts`, `gameSessionReducer.ts` |
| 테스트 | 대상 파일 옆에 `*.test.ts` | `rules.test.ts` |
| 타입만 있는 파일 | `*.types.ts` | `database.types.ts` |

게임 폴더(`game-<slug>/src`)는 아래 구조를 지킨다. 새 게임은 `game-tteokchigi`를 복사해서 시작한다.

```
main.tsx          진입점. 설정과 렌더링만
<Slug>Game.tsx    화면과 입력 처리
rules.ts          판정·점수·난이도 규칙 (순수 함수)
rules.test.ts
game.css          이 게임 전용 스타일
```

- **게임 규칙은 `rules.ts`에, 화면은 컴포넌트에** 둔다. 규칙은 React 없이 테스트할 수 있어야 한다
- 파일이 300줄을 넘으면 나눌 때가 됐다는 신호다 (🔧 경고)

## 2. 이름 짓기

- 식별자는 영어, 주석·UI 문구·테스트 이름은 한국어로 쓴다
- **단위가 있는 값은 이름에 단위를 붙인다.** `durationMs`, `elapsedMs`, `PESTLE_TRAVEL_PX`
- boolean은 `is`/`has`/`can`으로 시작한다. `isSupabaseConfigured`, `hasPermission`
- 이벤트 이름 규칙
  - 컴포넌트 props로 받는 콜백은 `onXxx`로 짓는다. `onRestart`
  - 컴포넌트 안에서 만드는 핸들러는 `handleXxx`로 짓는다. `handleTap`, `handleSubmit`
- 모듈 최상위 상수는 `UPPER_SNAKE_CASE`로 짓는다. `DURATION_MS`, `BASE_BPM`
- 타입·인터페이스·컴포넌트는 PascalCase로 짓는다 (🔧)
- 줄임말은 쓰지 않는다. `btn`, `cnt`, `idx`, `res` 대신 `button`, `count`, `index`, `response`. 예외는 `id`, `url`, `ctx`(canvas)

## 3. 읽기 쉬운 코드

- **매직 넘버 금지.** 의미 있는 숫자는 이름 있는 상수로 뺀다. 이유가 있는 값이면 주석으로 근거를 남긴다

  ```ts
  // ✗
  vibrate(result === 'PERFECT' ? 40 : result === 'GOOD' ? 20 : [10, 30, 10]);

  // ✓
  /** 판정별 진동 패턴(ms). MISS는 짧게 두 번 끊어 실패 느낌을 준다. */
  const VIBRATION: Record<Judgement, number | number[]> = { PERFECT: 40, GOOD: 20, MISS: [10, 30, 10] };
  vibrate(VIBRATION[result]);
  ```

- 함수가 이런 상태면 쪼갤 때가 된 것이다
  - 매개변수가 3개를 넘는다 (🔧): 객체 하나로 받는다. `submitScore({ slug, nickname, score })`
  - 중첩이 3단계를 넘는다 (🔧)
  - 분기가 많다 (🔧 complexity 10)
- 중첩 삼항 연산자는 쓰지 않는다 (🔧). 조회 테이블이나 `if`를 쓴다
- 조건이 맞지 않으면 먼저 `return`해서 중첩을 줄인다(early return)
- 비교는 `===`만 쓴다 (🔧). `== null`만 예외로 허용한다
- 상태 전이가 3가지 이상이면 `useReducer` + 순수 reducer로 한곳에 모은다. 예: `gameSessionReducer.ts`

## 4. TypeScript

- `strict` + `noUncheckedIndexedAccess`를 켠다. 끄지 않는다
- `any` 금지 (🔧). 모르는 값은 `unknown`으로 받고 좁혀서 쓴다
- 외부 데이터(Supabase 응답 등)는 타입을 선언한다. 예: `database.types.ts`
- `!`(non-null 단언)는 바로 앞 로직이 값을 보장할 때만 쓴다. 테스트에서는 `?? 기본값`을 쓴다
- 타입만 가져올 때는 `import { type X }`로 쓴다 (🔧)
- **상대 경로 import에는 확장자를 붙인다.** `from './rules.ts'`, `from './PlayField.tsx'`. 그래야 `node --test`가 빌드 없이 소스를 바로 실행할 수 있다. 패키지 import(`react`, `@minigames/engine`)에는 붙이지 않는다
- **named export만 쓴다** (🔧). default export는 도구 설정 파일과 Worker 진입점만 허용한다
- 공개 함수와 타입의 의미가 이름만으로 부족하면 JSDoc `/** */`을 단다. 단위, null의 의미, 호출 조건 같은 것이다

## 5. React

- 함수 컴포넌트와 훅만 쓴다
- Hooks 규칙과 React 19 권장 패턴을 따른다 (🔧 `react-hooks`)
  - 렌더링 중에 ref를 읽거나 쓰지 않는다
  - effect 본문에서 곧바로 setState하지 않는다. 비동기 결과 콜백이나 이벤트 핸들러에서 한다
  - effect 안에서 최신 콜백이 필요하면 `useEffectEvent`를 쓴다. 예: `useDeviceMotion.ts`
- **매 프레임 바뀌는 값은 state에 넣지 않는다.** requestAnimationFrame 안에서 ref로 DOM을 직접 갱신한다. 예: 절굿공이 위치
- 비동기 함수를 이벤트 핸들러로 넘길 때는 감싼다 (🔧)

  ```tsx
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void register(); // 결과를 기다리지 않는다는 뜻을 void로 드러낸다
  };
  ```

- 접근성
  - 누를 수 있는 것은 `<button>`으로 만든다
  - 아이콘만 있는 버튼에는 `aria-label`을 붙인다
  - 상태 메시지에는 `role="status"`, 오류에는 `role="alert"`를 붙인다
  - 터치 영역은 48px 이상으로 만든다

## 6. 엔진 (`@minigames/engine`)

- 게임은 `@minigames/engine` 루트에서만 가져온다. 내부 경로(`@minigames/engine/src/...`)를 쓰지 않는다
- 공개 API는 `src/index.ts`에서만 export한다. 여기 없는 것은 내부 구현이다
- 엔진은 특정 게임을 몰라야 한다. 게임 하나만 쓰는 기능은 게임 폴더에 둔다
- 무거운 의존성은 동적 `import()`로 지연 로드한다. 첫 진입 JS 목표는 100KB gzip 이하다. 예: Supabase
- 공개 API를 바꾸면 쓰는 게임을 같은 커밋에서 함께 고친다

## 7. 스타일 (CSS)

- 클래스 이름에 접두사를 붙인다. 엔진은 `mg-`, 게임은 게임별 2글자를 쓴다(`tt-` = 떡치기)
- 색은 엔진의 CSS 변수(`--mg-bg`, `--mg-accent` 등)만 쓴다. 다크모드는 변수로 처리한다
- 인라인 스타일은 매 프레임 바뀌는 값(`transform`)에만 쓴다
- 모바일 360~430px 폭을 기준으로 만든다

## 8. 주석

- **무엇을 하는지가 아니라 왜 그렇게 하는지**를 쓴다. 코드만 봐서는 알 수 없는 제약, 근거, 함정을 남긴다

  ```ts
  // ✗ 박자 인덱스를 Set에 추가한다
  // ✓ 한 박자에 한 번만 인정해 연타로 점수를 쌓지 못하게 한다.
  ```

- 임시 값에는 근거와 후속 조치를 남긴다. `/** 플랜에 시작 BPM이 없어 임시로 정한 값. 플레이테스트 후 조정한다. */`
- `TODO:`에는 무엇을 언제 해야 하는지 적는다. 이름이나 날짜만 적지 않는다
- 주석 처리한 코드는 커밋하지 않는다. 기록은 git에 남아 있다

## 9. 에러 처리와 사용자 문구

- 실패해도 게임은 계속돼야 한다
  - localStorage 접근은 try/catch로 감싼다
  - Supabase가 없으면 오프라인 모드로 동작한다
- 로그는 `console.error`/`console.warn`만 쓴다 (🔧). 앞에 출처를 붙인다. `[engine]`, `[tteokchigi]`
- 사용자에게 보이는 문구는 해요체로 쓰고, 무엇을 하면 되는지 함께 알려준다. `등록하지 못했어요. 잠시 후 다시 시도해 주세요.`
- 사용자가 공유 창을 닫는 것 같은 의도된 취소(`AbortError`)는 오류로 보여주지 않는다

## 10. 테스트

- `node:test`를 쓴다. 테스트 파일은 대상 파일 옆에 둔다
- 테스트 이름은 **동작을 설명하는 한국어 문장**으로 쓴다. `'플레이 중에만 점수가 오른다'`
- 판정 경계값(±100ms 같은 것)은 경계 바로 안쪽과 바깥쪽을 모두 테스트한다
- 반드시 테스트할 대상
  - 게임 규칙(`rules.ts`)
  - 상태 reducer
  - Worker 라우팅

## 11. SQL / Supabase

- 마이그레이션은 `minigames-engine/supabase/migrations/NNNN_설명.sql`로 만든다. **이미 적용한 파일은 고치지 않고** 새 파일을 추가한다
- 이름은 `snake_case`로 짓는다. 함수 인자는 `p_` 접두사를 붙인다
- 클라이언트는 테이블에 직접 쓰지 않는다. RLS로 막고 `security definer` 함수로만 다룬다. 함수에는 `set search_path = ''`를 넣는다
- 함수 시그니처를 바꾸면 `database.types.ts`도 함께 바꾼다

## 12. 의존성

**안정적이고 사용량이 일정 이상인 버전 중 최신**을 쓴다.

- 정식 릴리스만 쓴다
- 게시 후 14일 이상 지난 버전만 쓴다 (🔧 `minimumReleaseAge`)
- 해당 버전 주간 다운로드가 100만 이상이어야 한다
- 새 메이저 버전은 출시 후 60일이 지나야 쓴다
- 기준을 통과해도 도구 호환이 깨지면 쓰지 않는다

버전 표기도 지킨다.
- `package.json`에는 정확한 버전을 적는다. `^`와 `~`는 쓰지 않는다
- 개발 도구는 루트에 설치한다. 패키지별 도구는 해당 패키지에 설치한다
- 새 의존성을 추가하기 전에 번들 크기와 대안을 확인한다. 브라우저 API로 되면 라이브러리를 쓰지 않는다

## 13. Git

- 작업 시작 전에 `git fetch origin && git pull --rebase`를 실행한다
- 브랜치 이름은 `<type>/<짧은-설명>`으로 짓는다. `feat/dalgona-drag`, `fix/worker-redirect`
- 커밋 메시지는 `<type>(<scope>): <요약>` 형식으로 쓰고, 요약은 한국어로 쓴다
  - type: `feat` 기능, `fix` 버그, `refactor` 동작 변화 없는 구조 변경, `test`, `docs`, `chore` 설정·의존성
  - scope: `engine`, `home`, `worker`, `db`, 게임 slug(`tteokchigi`)
  - 예: `feat(dalgona): 드래그 경로 근접도 계산`
- 커밋 하나에는 변경 하나만 담는다. 포맷 변경과 로직 변경은 커밋을 나눈다

---

## 리뷰 체크리스트

- [ ] `pnpm check` 통과
- [ ] 처음 보는 사람이 이름만으로 역할을 알 수 있다
- [ ] 숫자에 이름이나 근거가 있다
- [ ] 규칙 변경에 테스트가 있다
- [ ] 엔진 공개 API를 바꿨다면 모든 게임을 고쳤다
- [ ] 첫 진입 JS가 100KB gzip 이하다 (`pnpm build` 출력의 `index-*.js` gzip 값)
- [ ] 다크모드와 360px 폭에서 확인했다
