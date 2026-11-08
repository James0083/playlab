import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * 사이트 경로 앞부분. 기본 `/`(Cloudflare: Worker가 /games/tteokchigi 를 이 게임의 Pages로 프록시한다).
 * GitHub Pages 임시 배포는 scripts/build-pages.mjs가 저장소 이름 경로(예: `/playlab/`)를 넘긴다.
 * 산출물의 자산 경로에 이 접두사가 들어가야 어느 쪽에서도 파일을 찾는다.
 */
const basePath = process.env.PLAYLAB_BASE_PATH ?? '/';

export default defineConfig({
  base: `${basePath}games/tteokchigi/`,
  plugins: [react()],
});
