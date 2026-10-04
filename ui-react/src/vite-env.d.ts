/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_BASE_API?: string
  readonly VITE_APP_CONTEXT_PATH?: string
  readonly VITE_DEFAULT_TENANT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
