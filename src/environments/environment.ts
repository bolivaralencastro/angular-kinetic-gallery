const DEFAULT_SUPABASE_URL = 'https://ouqykxafhtctlaymzoxw.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91cXlreGFmaHRjdGxheW16b3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNjE0MjYsImV4cCI6MjA3ODYzNzQyNn0.r1r9Q7rS4JRS-UcnC30KJJl1xXIUi_T_vs9kMWGfy0M';
const DEFAULT_SUPABASE_BUCKET = 'gallery-images';
const DEFAULT_SUPABASE_ADMIN_EMAIL = 'bolivar@alencastro.com.br';

function readEnv(key: keyof ImportMetaEnv, fallback: string): string {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  const rawValue = env?.[key];
  const trimmed = (rawValue ?? '').trim();
  return trimmed || fallback;
}

export const environment = {
  /**
   * URL base do projeto Supabase, por exemplo:
   * https://xyzcompany.supabase.co
   */
  supabaseUrl: readEnv('NG_APP_SUPABASE_URL', DEFAULT_SUPABASE_URL),
  /**
   * Chave pública (anon) do Supabase.
   */
  supabaseAnonKey: readEnv('NG_APP_SUPABASE_ANON_KEY', DEFAULT_SUPABASE_ANON_KEY),
  /**
   * Nome do bucket utilizado para armazenar as imagens das galerias.
   */
  supabaseBucket: readEnv('NG_APP_SUPABASE_BUCKET', DEFAULT_SUPABASE_BUCKET),
  /**
   * Email autorizado a utilizar as ações administrativas do app.
   */
  supabaseAdminEmail: readEnv('NG_APP_SUPABASE_ADMIN_EMAIL', DEFAULT_SUPABASE_ADMIN_EMAIL),
} as const;
