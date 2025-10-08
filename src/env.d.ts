interface ImportMetaEnv {
  readonly ENABLE_UMAMI?: string
  readonly UMAMI_SRC?: string
  readonly UMAMI_SITE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
