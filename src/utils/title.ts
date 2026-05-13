import { friendlyDomain } from './domain'

export function stripTitleNoise(title: string): string {
  if (!title) return ''
  title = title.replace(/^\(\d+\+?\)\s*/, '')
  title = title.replace(/\s*\([\d,]+\+?\)\s*/g, ' ')
  title = title.replace(/\s*[\-‐-―]\s*[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '')
  title = title.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '')
  title = title.replace(/\s+on X:\s*/, ': ')
  title = title.replace(/\s*\/\s*X\s*$/, '')
  return title.trim()
}

export function cleanTitle(title: string, hostname: string): string {
  if (!title || !hostname) return title || ''

  const friendly = friendlyDomain(hostname)
  const domain = hostname.replace(/^www\./, '')
  const seps = [' - ', ' | ', ' — ', ' · ', ' – ']

  for (const sep of seps) {
    const idx = title.lastIndexOf(sep)
    if (idx === -1) continue
    const suffix = title.slice(idx + sep.length).trim()
    const suffixLow = suffix.toLowerCase()
    if (
      suffixLow === domain.toLowerCase() ||
      suffixLow === friendly.toLowerCase() ||
      suffixLow === domain.replace(/\.\w+$/, '').toLowerCase() ||
      domain.toLowerCase().includes(suffixLow) ||
      friendly.toLowerCase().includes(suffixLow)
    ) {
      const cleaned = title.slice(0, idx).trim()
      if (cleaned.length >= 5) return cleaned
    }
  }
  return title
}

export function smartTitle(title: string, url: string): string {
  if (!url) return title || ''
  let pathname = '', hostname = ''
  try { const u = new URL(url); pathname = u.pathname; hostname = u.hostname }
  catch { return title || '' }

  const titleIsUrl = !title || title === url || title.startsWith(hostname) || title.startsWith('http')

  if ((hostname === 'x.com' || hostname === 'twitter.com' || hostname === 'www.x.com') && pathname.includes('/status/')) {
    const username = pathname.split('/')[1]
    if (username) return titleIsUrl ? `Post by @${username}` : title
  }

  if (hostname === 'github.com' || hostname === 'www.github.com') {
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length >= 2) {
      const [owner, repo, ...rest] = parts
      if (rest[0] === 'issues' && rest[1]) return `${owner}/${repo} Issue #${rest[1]}`
      if (rest[0] === 'pull' && rest[1]) return `${owner}/${repo} PR #${rest[1]}`
      if (rest[0] === 'blob' || rest[0] === 'tree') return `${owner}/${repo} — ${rest.slice(2).join('/')}`
      if (titleIsUrl) return `${owner}/${repo}`
    }
  }

  if ((hostname === 'www.youtube.com' || hostname === 'youtube.com') && pathname === '/watch') {
    if (titleIsUrl) return 'YouTube Video'
  }

  if ((hostname === 'www.reddit.com' || hostname === 'reddit.com' || hostname === 'old.reddit.com') && pathname.includes('/comments/')) {
    const parts = pathname.split('/').filter(Boolean)
    const subIdx = parts.indexOf('r')
    if (subIdx !== -1 && parts[subIdx + 1]) {
      if (titleIsUrl) return `r/${parts[subIdx + 1]} post`
    }
  }

  return title || url
}
