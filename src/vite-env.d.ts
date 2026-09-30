/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TMDB_API_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_AUTHORIZED_PLAYBACK_CATALOG_URL?: string;
  readonly VITE_NEWS_PLAYLIST_AR?: string;
  readonly VITE_NEWS_PLAYLIST_EN?: string;
  readonly VITE_NEWS_PLAYLIST_ES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
