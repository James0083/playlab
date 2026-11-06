import type { SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

let config: SupabaseConfig | null = null;
let client: Promise<SupabaseClient> | null = null;

/** 값이 비어 있으면 오프라인 모드로 동작한다(로컬 최고기록만 사용). */
export function configureSupabase(next: Partial<SupabaseConfig>): void {
  config =
    next.url && next.publishableKey ? { url: next.url, publishableKey: next.publishableKey } : null;
  client = null;
}

export function isSupabaseConfigured(): boolean {
  return config !== null;
}

/** 첫 진입 번들에 포함되지 않도록 필요할 때 동적으로 불러온다. */
export function getSupabase(): Promise<SupabaseClient> {
  if (!config) return Promise.reject(new Error('Supabase가 설정되지 않았습니다.'));
  const { url, publishableKey } = config;
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url, publishableKey, { auth: { persistSession: false } }),
  );
  return client;
}
