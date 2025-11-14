interface ImportMetaEnv {
  readonly NG_APP_SUPABASE_URL?: string;
  readonly NG_APP_SUPABASE_ANON_KEY?: string;
  readonly NG_APP_SUPABASE_BUCKET?: string;
  readonly NG_APP_SUPABASE_ADMIN_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
