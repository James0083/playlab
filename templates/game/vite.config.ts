import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Worker가 /games/template를 제거해 프록시하므로, 산출물의 자산 경로에는 접두사가 있어야 한다.
  base: '/games/template/',
  plugins: [react()],
});
