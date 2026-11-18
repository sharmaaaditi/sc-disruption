/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_ROLE?: 'VIEWER' | 'ANALYST' | 'ADMIN';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
