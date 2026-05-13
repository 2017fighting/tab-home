import { friendlyDomain } from '../utils/domain'

function updateBadge() {
  chrome.tabs.query({}).then(tabs => {
    const real = tabs.filter(t => {
      const url = t.url || ''
      return !url.startsWith('chrome://')
        && !url.startsWith('chrome-extension://')
        && !url.startsWith('about:')
        && !url.startsWith('edge://')
        && !url.startsWith('brave://')
        && !url.startsWith('chrome-native://')
    })
    const count = real.length
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' })
    if (count >= 21) {
      chrome.action.setBadgeBackgroundColor({ color: '#b35a5a' })
    } else if (count >= 11) {
      chrome.action.setBadgeBackgroundColor({ color: '#b8892e' })
    } else {
      chrome.action.setBadgeBackgroundColor({ color: '#3d7a4a' })
    }
  })
}

function brandFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname
    return friendlyDomain(hostname) || hostname
  } catch { return url }
}

chrome.runtime.onInstalled.addListener(() => {
  updateBadge()
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'addPageToFavorites',
      title: 'Add page to tab-home favorites',
      contexts: ['page'],
    })
    chrome.contextMenus.create({
      id: 'addLinkToFavorites',
      title: 'Add link to tab-home favorites',
      contexts: ['link'],
    })
  })
})

chrome.runtime.onStartup.addListener(updateBadge)

chrome.tabs.onCreated.addListener(() => updateBadge())

// When a tab loads the tab-home page, check for duplicates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url || changeInfo.url !== 'chrome://newtab/') return

  // Find any other tab-home tab that isn't this one
  chrome.tabs.query({}).then(all => {
    const existing = all.find(t =>
      t.id !== tabId && t.url === 'chrome://newtab/'
    )
    if (existing?.id) {
      chrome.tabs.update(existing.id, { active: true })
      if (existing.windowId !== tab.windowId) {
        chrome.windows.update(existing.windowId, { focused: true })
      }
      chrome.tabs.remove(tabId)
    }
  })
})
chrome.tabs.onRemoved.addListener(() => updateBadge())
chrome.tabs.onUpdated.addListener((_id, changeInfo) => {
  if (changeInfo.url || changeInfo.title || 'pinned' in changeInfo) updateBadge()
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  let url = ''
  if (info.menuItemId === 'addPageToFavorites') {
    url = tab?.url || info.pageUrl || ''
  } else if (info.menuItemId === 'addLinkToFavorites') {
    url = info.linkUrl || ''
  }
  if (!url) return

  chrome.storage.local.get('favorites').then(result => {
    const favorites = result.favorites || []
    if (favorites.some((f: any) => f.url === url)) return

    let maxSlot = -1
    for (const f of favorites) {
      if (typeof f.slot === 'number' && f.slot > maxSlot) maxSlot = f.slot
    }

    favorites.push({
      id: Date.now().toString(),
      url,
      title: brandFromUrl(url),
      addedAt: new Date().toISOString(),
      slot: maxSlot + 1,
    })

    chrome.storage.local.set({ favorites })
  })
})

updateBadge()
