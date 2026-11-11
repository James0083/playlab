/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 비어 있으면 오프라인 모드(로컬 최고기록만 사용) */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
