import { BROWSER_INTERNAL_SCHEMES } from './constants'

export function isRealTab(url: string | undefined): boolean {
  if (!url) return false
  for (const scheme of BROWSER_INTERNAL_SCHEMES) {
    if (url.startsWith(scheme)) return false
  }
  return true
}

export function normalizeUrl(url: string): string {
  if (!url) return ''
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
    return 'https://' + url
  }
  return url
}

export function getFaviconUrl(pageUrl: string, size: number = 64): string {
  if (!pageUrl) return ''
  try {
    const u = new URL(chrome.runtime.getURL('/_favicon/'))
    u.searchParams.set('pageUrl', pageUrl)
    u.searchParams.set('size', String(size))
    return u.toString()
  } catch {
    return ''
  }
}
