import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false, // 타입 선언은 tsc가 만든다(tsconfig.build.json)
  clean: true,
  // supabase-js는 동적 import로 남겨 게임 첫 진입 번들에서 분리한다.
  external: ['react', 'react-dom', '@supabase/supabase-js'],
});
