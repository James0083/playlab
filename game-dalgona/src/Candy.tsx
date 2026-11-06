// 달고나 판(정적 그림). 좌표는 보드 단위(viewBox 0~100), 판은 중심 (50,50) 반지름 46.
// 입체감은 그라데이션·하이라이트·질감 점으로 낸다. 빛은 왼쪽 위에서 온다.

const CENTER = 50;
const RADIUS = 46;

/** 설탕이 부풀며 생긴 기포 자국. 매번 같은 무늬가 나오도록 고정된 씨앗으로 만든다 */
const SPECKLES = (() => {
  let seed = 7;
  const random = () => {
    seed = (seed * 16_807) % 2_147_483_647;
    return seed / 2_147_483_647;
  };
  return Array.from({ length: 70 }, () => {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * (RADIUS - 4);
    return {
      x: CENTER + Math.cos(angle) * distance,
      y: CENTER + Math.sin(angle) * distance,
      r: 0.3 + random() * 0.8,
      isDark: random() < 0.55,
    };
  });
})();

/** 판에 쓰는 그라데이션. Board의 다른 요소(윤곽선, 바늘)도 이 id를 쓴다 */
export function CandyDefinitions() {
  return (
    <defs>
      {/* 가운데가 볼록하게 밝고 가장자리로 갈수록 어두워진다 */}
      <radialGradient id="dg-candy-dome" cx="42%" cy="38%" r="65%">
        <stop offset="0%" stopColor="var(--dg-candy-light)" />
        <stop offset="60%" stopColor="var(--dg-candy)" />
        <stop offset="92%" stopColor="var(--dg-candy-edge)" />
        <stop offset="100%" stopColor="var(--dg-candy-rim)" />
      </radialGradient>
      {/* 판 가장자리의 경사면: 위쪽은 빛을 받고 아래쪽은 그늘진다 */}
      <linearGradient id="dg-candy-bevel" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity={0.55} />
        <stop offset="50%" stopColor="#fff" stopOpacity={0} />
        <stop offset="100%" stopColor="#000" stopOpacity={0.35} />
      </linearGradient>
      <radialGradient id="dg-candy-shine" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#fff" stopOpacity={0.6} />
        <stop offset="100%" stopColor="#fff" stopOpacity={0} />
      </radialGradient>
      {/* 바늘: 금속 원기둥 */}
      <linearGradient id="dg-needle-metal" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor="#5b6168" />
        <stop offset="45%" stopColor="#e9edf1" />
        <stop offset="100%" stopColor="#6d747c" />
      </linearGradient>
    </defs>
  );
}

/** 달고나 판: 볼록한 원판 + 가장자리 경사 + 기포 질감 + 반짝임 */
export function Candy() {
  return (
    <g>
      <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="url(#dg-candy-dome)" />
      <g>
        {SPECKLES.map(({ x, y, r, isDark }, i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={r}
            fill={isDark ? 'var(--dg-candy-edge)' : 'var(--dg-candy-light)'}
            opacity={isDark ? 0.45 : 0.6}
          />
        ))}
      </g>
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS - 1}
        fill="none"
        stroke="url(#dg-candy-bevel)"
        strokeWidth={2}
      />
      <ellipse
        cx={34}
        cy={26}
        rx={14}
        ry={6}
        fill="url(#dg-candy-shine)"
        transform="rotate(-30 34 26)"
      />
    </g>
  );
}
