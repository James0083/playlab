import type { CSSProperties, RefObject } from 'react';

// 떡치기 장면(절구·떡·떡메)을 SVG로 그린다. 좌표는 viewBox(300×400) 기준.
// 입체감은 그라데이션·하이라이트·그림자로 낸다. WebGL(Three.js 등)은 첫 진입 번들 목표(100KB)를 넘어 쓰지 않는다.

/** 매 프레임 직접 움직이는 요소 */
export interface SceneElements {
  mallet: SVGGElement | null;
  shadow: SVGEllipseElement | null;
}

/**
 * 떡메 머리 중심. 떡메는 이 점을 기준으로 기울어진다.
 * 머리(길이 118, 굵기 52)를 세워 두었으므로 아래 끝면(y = 213 + 59 = 272)이 떡 윗면에 닿는다.
 */
const HEAD_CENTER = { x: 150, y: 213 };
const HEAD_LENGTH = 118;
const HEAD_THICKNESS = 52;
/** 가장 높이 들었을 때 올라가는 거리 */
const MALLET_LIFT = 185;
/**
 * 가장 높이 들었을 때 기울기(시계 방향). 손잡이 쪽(오른쪽 위, 떡메를 든 사람)으로 젖혀지며 올라간다.
 * 반대 방향이면 머리가 사람 반대쪽으로 꺾여 부자연스럽다.
 */
const MALLET_TILT_DEGREES = 24;
/** 떡 위 그림자: 떡메가 가까울수록 작고 진하다 */
const SHADOW_RX = { near: 46, far: 70 };
const SHADOW_OPACITY = { near: 0.7, far: 0.1 };

/** 떡메 높이(0 = 떡에 닿음, 1 = 가장 높이 듦)에 해당하는 SVG transform */
function malletTransform(height: number): string {
  const lift = height * MALLET_LIFT;
  const tilt = height * MALLET_TILT_DEGREES;
  return `translate(0 ${-lift}) rotate(${tilt} ${HEAD_CENTER.x} ${HEAD_CENTER.y})`;
}

/** 떡메 높이(0~1)에 맞춰 떡메와 그림자를 움직인다 */
export function drawMallet(elements: SceneElements, height: number): void {
  const { mallet, shadow } = elements;
  if (mallet) mallet.setAttribute('transform', malletTransform(height));
  if (shadow) {
    shadow.setAttribute('rx', String(SHADOW_RX.near + (SHADOW_RX.far - SHADOW_RX.near) * height));
    const opacity = SHADOW_OPACITY.near + (SHADOW_OPACITY.far - SHADOW_OPACITY.near) * height;
    shadow.setAttribute('opacity', String(opacity));
  }
}

/** 떡을 쳤을 때 튀는 떡가루: 방향(dx, dy)과 크기 */
const PUFFS = [
  { dx: -70, dy: -18, r: 4 },
  { dx: -48, dy: -40, r: 3 },
  { dx: -20, dy: -52, r: 3.5 },
  { dx: 22, dy: -50, r: 3 },
  { dx: 50, dy: -38, r: 4 },
  { dx: 72, dy: -16, r: 3 },
  { dx: -86, dy: 2, r: 2.5 },
  { dx: 88, dy: 4, r: 2.5 },
];

interface SceneProps {
  elementsRef: RefObject<SceneElements>;
  /** 떡을 맞힐 때마다 바뀌는 값. 바뀌면 떡 눌림·떡가루 이펙트가 다시 재생된다. null이면 이펙트 없음 */
  hitId: number | null;
  /** 처음 그릴 때 떡메 높이. 플레이 중에는 drawMallet이 매 프레임 덮어쓴다 */
  restHeight?: number;
}

export function Scene({ elementsRef, hitId, restHeight = 0 }: SceneProps) {
  return (
    <svg
      className="tt-scene"
      viewBox="0 0 300 400"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
    >
      <SceneDefinitions />

      {/* 바닥 그림자 */}
      <ellipse cx={150} cy={388} rx={118} ry={12} fill="url(#tt-floor-shadow)" />

      <Mortar />

      {/* 떡: 맞힐 때마다 key가 바뀌어 눌림 애니메이션이 다시 재생된다 */}
      <g key={hitId ?? 'idle'} className={hitId === null ? 'tt-mochi' : 'tt-mochi tt-mochi-hit'}>
        <path
          d="M82 300 C88 274 118 266 150 266 C182 266 212 274 218 300 C200 314 100 314 82 300 Z"
          fill="url(#tt-mochi)"
        />
        <ellipse cx={126} cy={279} rx={20} ry={5} fill="#fff" opacity={0.85} />
        <ellipse cx={170} cy={284} rx={8} ry={2.5} fill="#fff" opacity={0.6} />
      </g>

      <ellipse
        ref={(node) => {
          elementsRef.current.shadow = node;
        }}
        cx={150}
        cy={276}
        rx={SHADOW_RX.far}
        ry={7}
        fill="url(#tt-mallet-shadow)"
        opacity={SHADOW_OPACITY.far}
      />

      {hitId !== null && (
        <g key={`puff-${hitId}`} className="tt-puffs">
          {PUFFS.map(({ dx, dy, r }, i) => (
            <circle
              key={i}
              className="tt-puff"
              cx={150}
              cy={270}
              r={r}
              style={{ '--dx': `${dx}px`, '--dy': `${dy}px` } as CSSProperties}
            />
          ))}
        </g>
      )}

      <g
        ref={(node) => {
          elementsRef.current.mallet = node;
        }}
        transform={malletTransform(restHeight)}
      >
        <Mallet />
      </g>
    </svg>
  );
}

/** 그라데이션 정의. 빛은 왼쪽 위에서 온다 */
function SceneDefinitions() {
  return (
    <defs>
      <radialGradient id="tt-floor-shadow">
        <stop offset="0%" stopColor="#000" stopOpacity={0.35} />
        <stop offset="100%" stopColor="#000" stopOpacity={0} />
      </radialGradient>
      {/* 떡메 그림자: 가운데가 진하고 가장자리로 갈수록 흐려진다 */}
      <radialGradient id="tt-mallet-shadow">
        <stop offset="0%" stopColor="#2b1a0c" stopOpacity={1} />
        <stop offset="60%" stopColor="#2b1a0c" stopOpacity={0.5} />
        <stop offset="100%" stopColor="#2b1a0c" stopOpacity={0} />
      </radialGradient>
      {/* 절구 몸통: 원통이라 가운데가 밝고 양끝이 어둡다 */}
      <linearGradient id="tt-mortar-body" x1="0" x2="1">
        <stop offset="0%" stopColor="#4a2a10" />
        <stop offset="28%" stopColor="#a8683a" />
        <stop offset="42%" stopColor="#c98a52" />
        <stop offset="70%" stopColor="#8a5129" />
        <stop offset="100%" stopColor="#3e220c" />
      </linearGradient>
      <linearGradient id="tt-mortar-rim" x1="0" x2="1">
        <stop offset="0%" stopColor="#b97a45" />
        <stop offset="40%" stopColor="#e2ab73" />
        <stop offset="100%" stopColor="#9c6234" />
      </linearGradient>
      <radialGradient id="tt-mortar-bowl" cx="50%" cy="70%" r="65%">
        <stop offset="0%" stopColor="#6b3f1c" />
        <stop offset="100%" stopColor="#2e1907" />
      </radialGradient>
      <radialGradient id="tt-mochi" cx="38%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="55%" stopColor="#f6f1e4" />
        <stop offset="100%" stopColor="#d6cdbb" />
      </radialGradient>
      {/* 떡메 머리: 옆으로 누운 원통이라 위아래로 명암이 바뀐다 */}
      <linearGradient id="tt-head" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#7a4a22" />
        <stop offset="22%" stopColor="#e0aa72" />
        <stop offset="45%" stopColor="#c08048" />
        <stop offset="100%" stopColor="#4f2c10" />
      </linearGradient>
      <linearGradient id="tt-band" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#2a2a2a" />
        <stop offset="25%" stopColor="#9a9a9a" />
        <stop offset="60%" stopColor="#4a4a4a" />
        <stop offset="100%" stopColor="#1a1a1a" />
      </linearGradient>
      {/* 손잡이: 가로로 뻗은 원기둥이라 위아래로 명암이 바뀐다 */}
      <linearGradient id="tt-handle" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#8a5a2e" />
        <stop offset="45%" stopColor="#e4b47e" />
        <stop offset="100%" stopColor="#7a4c24" />
      </linearGradient>
    </defs>
  );
}

/** 나무 절구: 원통 몸통 + 테두리 띠 + 윗면 + 안쪽 */
function Mortar() {
  return (
    <g>
      <path d="M48 300 L58 384 A92 22 0 0 0 242 384 L252 300 Z" fill="url(#tt-mortar-body)" />
      {/* 나뭇결 */}
      <g stroke="#3b200b" strokeOpacity={0.25} strokeWidth={1.2} fill="none">
        <path d="M92 312 C96 340 92 362 98 396" />
        <path d="M128 316 C126 344 132 368 128 402" />
        <path d="M178 316 C182 346 176 370 180 402" />
        <path d="M212 312 C208 338 214 362 206 396" />
      </g>
      {/* 테두리 띠 */}
      <path d="M52 330 A98 26 0 0 0 248 330" stroke="#2e1907" strokeWidth={6} fill="none" />
      <path d="M56 362 A94 24 0 0 0 244 362" stroke="#2e1907" strokeWidth={6} fill="none" />
      {/* 윗면과 안쪽 */}
      <ellipse cx={150} cy={300} rx={102} ry={28} fill="url(#tt-mortar-rim)" stroke="#6b3d18" />
      <ellipse cx={150} cy={302} rx={82} ry={20} fill="url(#tt-mortar-bowl)" />
    </g>
  );
}

/**
 * 떡메: 원통 머리를 세워 아래 끝면으로 떡을 수직으로 친다.
 * 손잡이는 머리 옆 가운데에서 오른쪽(떡메를 든 사람 쪽)으로 머리와 수직으로 뻗는다.
 * 떡에 닿은 자세로 그린다.
 */
function Mallet() {
  const { x: cx, y: cy } = HEAD_CENTER;
  const left = cx - HEAD_LENGTH / 2;
  const top = cy - HEAD_THICKNESS / 2;
  return (
    <g>
      {/* 손잡이: 밝은 면 위에 어두운 줄을 겹쳐 원기둥처럼 보이게 한다. 오른쪽 끝은 화면 밖으로 이어진다 */}
      <rect x={cx + 10} y={cy - 8} width={220} height={16} rx={8} fill="url(#tt-handle)" />
      <rect x={cx + 10} y={cy + 2} width={220} height={4} fill="#5e3a18" opacity={0.45} />
      {/* 머리: 누운 원통 모양을 그린 뒤 -90° 돌려 세운다(왼쪽 위에서 오는 빛 방향 유지) */}
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        <rect
          x={left}
          y={top}
          width={HEAD_LENGTH}
          height={HEAD_THICKNESS}
          rx={8}
          fill="url(#tt-head)"
        />
        {/* 쇠테 두 줄 */}
        <rect x={left + 8} y={top} width={8} height={HEAD_THICKNESS} fill="url(#tt-band)" />
        <rect
          x={left + HEAD_LENGTH - 16}
          y={top}
          width={8}
          height={HEAD_THICKNESS}
          fill="url(#tt-band)"
        />
        {/* 하이라이트 */}
        <rect
          x={left + 16}
          y={top + 6}
          width={HEAD_LENGTH - 36}
          height={5}
          rx={2.5}
          fill="#fff"
          opacity={0.25}
        />
      </g>
    </g>
  );
}
