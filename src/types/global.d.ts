declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare var LOCAL_LANDING_PAGE_PATTERNS: any[] | undefined
declare var LOCAL_CUSTOM_GROUPS: any[] | undefined
