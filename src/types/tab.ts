export interface TabInfo {
  id: number
  url: string
  title: string
  windowId: number
  active: boolean
  pinned: boolean
  lastAccessed: number
  isTabHome: boolean
}

export interface DomainGroup {
  domain: string
  label?: string
  tabs: TabInfo[]
}
