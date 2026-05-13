export function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const then = new Date(dateStr)
  const now = new Date()
  const diffMins = Math.floor((now.getTime() - then.getTime()) / 60000)
  const diffHours = Math.floor((now.getTime() - then.getTime()) / 3600000)
  const diffDays = Math.floor((now.getTime() - then.getTime()) / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return diffMins + ' min ago'
  if (diffHours < 24) return diffHours + ' hr' + (diffHours !== 1 ? 's' : '') + ' ago'
  if (diffDays === 1) return 'yesterday'
  return diffDays + ' days ago'
}

export function getDateDisplay(locale: string = 'en-US'): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const date = `${dd}/${mm}/${d.getFullYear()}`
  let weekday = ''
  try {
    weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d)
  } catch { /* fall through */ }
  return weekday ? `${weekday} · ${date}` : date
}
