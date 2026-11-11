// 홈 카드에 보여줄 게임 그림(작은 SVG). 게임 안의 장면을 단순하게 옮겼다.
// 홈은 React 없이 정적 HTML이라 게임의 그림 컴포넌트를 쓸 수 없어 여기서 따로 그린다.
// 새 게임을 추가할 때 그림을 넣지 않으면 games.ts의 이모지가 대신 나온다.

const VIEWBOX = 'viewBox="0 0 64 64" aria-hidden="true"';

/** 게임 slug → SVG 마크업(64×64) */
export const GAME_ART: Readonly<Record<string, string>> = {
  tteokchigi: `<svg ${VIEWBOX}>
  <rect x="14" y="40" width="36" height="18" rx="4" fill="#9a6a3c"/>
  <rect x="14" y="44" width="36" height="2" fill="#6e4521" opacity=".6"/>
  <ellipse cx="32" cy="41" rx="14" ry="5" fill="#f6f1e6"/>
  <g transform="rotate(-28 40 18)"><rect x="40" y="16" width="20" height="4" rx="2" fill="#b07a42"/><rect x="28" y="10" width="16" height="16" rx="3" fill="#8a5a2e"/></g>
</svg>`,
  dalgona: `<svg ${VIEWBOX}>
  <circle cx="33" cy="34" r="26" fill="#000" opacity=".15"/>
  <circle cx="32" cy="32" r="26" fill="#e0a84a"/>
  <circle cx="26" cy="24" r="9" fill="#f6cf7e" opacity=".7"/>
  <circle cx="32" cy="32" r="14" fill="none" stroke="#6b3f0e" stroke-width="2.4" stroke-dasharray="3 3"/>
</svg>`,
  'bubble-tea': `<svg ${VIEWBOX}>
  <path d="M18 14h28l-4 44H22z" fill="#fbf4e6" stroke="#9aa6b2" stroke-width="2"/>
  <path d="M20 30h24l-2.6 26H22.6z" fill="#c08d5c"/>
  <rect x="16" y="11" width="32" height="5" rx="2.5" fill="#d7dee5" stroke="#9aa6b2"/>
  <rect x="34" y="4" width="4" height="34" rx="2" fill="#e2574c" transform="rotate(8 36 20)"/>
  <g fill="#2a170c"><circle cx="26" cy="52" r="2.6"/><circle cx="32" cy="53" r="2.6"/><circle cx="38" cy="52" r="2.6"/><circle cx="29" cy="47" r="2.6"/><circle cx="35" cy="47" r="2.6"/></g>
</svg>`,
  jjajang: `<svg ${VIEWBOX}>
  <circle cx="32" cy="33" r="27" fill="#eceff3"/>
  <circle cx="32" cy="33" r="24" fill="none" stroke="#3d6fb6" stroke-width="2"/>
  <circle cx="32" cy="33" r="20" fill="#f1d58e"/>
  <circle cx="32" cy="33" r="11" fill="#3a2211"/>
  <rect x="30" y="18" width="3" height="9" rx="1.5" fill="#7cb342" transform="rotate(-15 31 22)"/>
  <rect x="36" y="31" width="22" height="3" rx="1.5" fill="#b07a45" transform="rotate(-20 36 32)"/>
</svg>`,
  paengi: `<svg ${VIEWBOX}>
  <circle cx="34" cy="36" r="24" fill="#000" opacity=".15"/>
  <circle cx="32" cy="32" r="24" fill="#b9c0c7"/>
  <circle cx="32" cy="32" r="20" fill="#f6f1e6"/>
  <circle cx="32" cy="32" r="16" fill="#d8322a"/>
  <circle cx="32" cy="32" r="12" fill="#2a52a8"/>
  <circle cx="32" cy="32" r="8" fill="#f0c32a"/>
  <circle cx="32" cy="32" r="4.5" fill="#7cc742"/>
</svg>`,
};

/** 카드에 넣을 그림. 그림이 없는 게임은 이모지 */
export function artOf({ slug, emoji }: { slug: string; emoji: string }): string {
  const svg = GAME_ART[slug];
  return svg
    ? `<span class="art">${svg}</span>`
    : `<span class="art emoji" aria-hidden="true">${emoji}</span>`;
}
