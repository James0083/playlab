export interface Game {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  /** Pages 프로젝트 주소. 이름이 이미 쓰이면 pages.dev 주소에 접미사가 붙을 수 있어 직접 적는다. */
  origin: string;
  status: 'live' | 'coming-soon';
}

/** 게임 목록의 단일 소스. Worker 라우팅과 홈 화면이 모두 여기서 읽는다. */
export const GAMES: Game[] = [
  {
    slug: 'tteokchigi',
    name: '떡치기',
    emoji: '🔨',
    description: '떡메가 떡에 닿는 순간 탭',
    origin: 'https://game-tteokchigi.pages.dev',
    status: 'coming-soon',
  },
  {
    slug: 'dalgona',
    name: '달고나 뽑기',
    emoji: '🍯',
    description: '점선을 따라 정확하게 그리기',
    origin: 'https://game-dalgona.pages.dev',
    status: 'coming-soon',
  },
  {
    slug: 'bubble-tea',
    name: '버블티 흔들기',
    emoji: '🧋',
    description: '넘치지 않게 폰 흔들기',
    origin: 'https://game-bubble-tea.pages.dev',
    status: 'coming-soon',
  },
  {
    slug: 'jjajang',
    name: '짜장면 비비기',
    emoji: '🍜',
    description: '원을 그리며 방향 바꿔 비비기',
    origin: 'https://game-jjajang.pages.dev',
    status: 'coming-soon',
  },
  {
    slug: 'paengi',
    name: '팽이 돌리기',
    emoji: '🌀',
    description: '빨리 돌리고 기울여서 오래 버티기',
    origin: 'https://game-paengi.pages.dev',
    status: 'coming-soon',
  },
];
