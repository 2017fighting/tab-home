import type { TabInfo, DomainGroup } from '@/types'
import { friendlyDomain } from '@/utils/domain'

interface CustomGroupRule {
  hostname?: string
  hostnameEndsWith?: string
  groupKey: string
  groupLabel: string
  pathPrefix?: string
  test?: (pathname: string, url: string) => boolean
}

interface LandingPagePattern {
  hostname?: string
  hostnameEndsWith?: string
  pathPrefix?: string
  pathExact?: string[]
  test?: (pathname: string, url: string) => boolean
}

const LOCAL_PATTERNS: LandingPagePattern[] =
  (typeof window !== 'undefined' && (window as any).LOCAL_LANDING_PAGE_PATTERNS) || []

const LOCAL_GROUPS: CustomGroupRule[] =
  (typeof window !== 'undefined' && (window as any).LOCAL_CUSTOM_GROUPS) || []

export function useDomainGrouping() {
  function isLandingPage(url: string): boolean {
    for (const pattern of LOCAL_PATTERNS) {
      try {
        const u = new URL(url)
        if (pattern.hostname && u.hostname !== pattern.hostname) continue
        if (pattern.hostnameEndsWith && !u.hostname.endsWith(pattern.hostnameEndsWith)) continue
        if (pattern.pathPrefix && !u.pathname.startsWith(pattern.pathPrefix)) continue
        if (pattern.pathExact && !pattern.pathExact.includes(u.pathname)) continue
        if (pattern.test && !pattern.test(u.pathname, url)) continue
        return true
      } catch { continue }
    }
    return false
  }

  function matchCustomGroup(url: string): { key: string; label: string } | null {
    for (const rule of LOCAL_GROUPS) {
      try {
        const u = new URL(url)
        if (rule.hostname && u.hostname !== rule.hostname) continue
        if (rule.hostnameEndsWith && !u.hostname.endsWith(rule.hostnameEndsWith)) continue
        if (rule.pathPrefix && !u.pathname.startsWith(rule.pathPrefix)) continue
        if (rule.test && !rule.test(u.pathname, url)) continue
        return { key: rule.groupKey, label: rule.groupLabel }
      } catch { continue }
    }
    return null
  }

  function groupTabs(allTabs: TabInfo[]): { pinned: DomainGroup[]; regular: DomainGroup[] } {
    const domainMap = new Map<string, { label?: string; tabs: TabInfo[] }>()

    for (const tab of allTabs) {
      if (!tab.url) continue
      try {
        const u = new URL(tab.url)
        if (isLandingPage(tab.url)) {
          const existing = domainMap.get('__landing-pages__') || { label: 'Home', tabs: [] }
          existing.tabs.push(tab)
          domainMap.set('__landing-pages__', existing)
          continue
        }
        const custom = matchCustomGroup(tab.url)
        if (custom) {
          const existing = domainMap.get(custom.key) || { label: custom.label, tabs: [] }
          existing.tabs.push(tab)
          domainMap.set(custom.key, existing)
          continue
        }
        const hostname = u.hostname
        const existing = domainMap.get(hostname) || { tabs: [] }
        existing.tabs.push(tab)
        domainMap.set(hostname, existing)
      } catch {
        const existing = domainMap.get('__unknown__') || { tabs: [] }
        existing.tabs.push(tab)
        domainMap.set('__unknown__', existing)
      }
    }

    const groups: DomainGroup[] = []
    for (const [domain, { label, tabs: domainTabs }] of domainMap) {
      const displayLabel = label || friendlyDomain(domain)
      domainTabs.sort((a, b) => b.lastAccessed - a.lastAccessed)
      groups.push({ domain, label: displayLabel, tabs: domainTabs })
    }

    groups.sort((a, b) => {
      if (a.tabs.length === 0 && b.tabs.length === 0) return 0
      if (a.tabs.length === 0) return 1
      if (b.tabs.length === 0) return -1
      return b.tabs[0].lastAccessed - a.tabs[0].lastAccessed
    })

    const pinned: DomainGroup[] = []
    const regular: DomainGroup[] = []

    for (const g of groups) {
      const p = g.tabs.filter(t => t.pinned)
      const r = g.tabs.filter(t => !t.pinned)
      if (p.length > 0) pinned.push({ ...g, tabs: p })
      if (r.length > 0) regular.push({ ...g, tabs: r })
    }

    return { pinned, regular }
  }

  return { groupTabs }
}
