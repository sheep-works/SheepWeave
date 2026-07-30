/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TEST_VER: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
    import type { DefineComponent } from 'vue'
    const component: DefineComponent<{}, {}, any>
    export default component
}
