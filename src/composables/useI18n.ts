import { ref } from 'vue'
import type { LangCode, I18nStrings } from '@/types'

const STRINGS: I18nStrings = {
  en: {
    favorites: 'Favorites',
    add: 'Add', save: 'Save', cancel: 'Cancel', confirmOk: 'Confirm',
    uploadLogo: 'Upload logo (or paste image)', reset: 'Reset', auto: 'Auto',
    urlLabel: 'URL', titleLabel: 'Title',
    titlePlaceholder: 'Title (optional)',
    favoritesEmpty: 'Nothing pinned yet. Click + to add a URL, or star a tab on the right.',
    addAFavorite: 'Add a favorite',
    edit: 'Edit', remove: 'Remove', moreActions: 'More',
    rightNow: 'Right now', openTabs: 'Open tabs', pinned: 'Pinned',
    nTabsCount: (n: number) => `${n} tab${n !== 1 ? 's' : ''}`,
    homepages: 'Homepages',
    nDomains: (n: number) => `${n} domain${n !== 1 ? 's' : ''}`,
    nTabsOpen: (n: number) => `${n} tab${n !== 1 ? 's' : ''} open`,
    dupeBadge: (n: number) => `duplicate x ${n}`,
    closeAllN: (n: number) => `Close all ${n} tab${n !== 1 ? 's' : ''}`,
    closeDupes: 'Close duplicates',
    plusN: (n: number) => `+${n} more`,
    statTabs: 'Open tabs',
    addToFav: 'Add to favorites', removeFromFav: 'Remove from favorites',
    pinTip: 'Pin tab', unpinTip: 'Unpin tab',
    closeThisTab: 'Close this tab',
    nWolfyTabsOpen: 'tab-home tabs open', keepOne: 'Keep one',
    addedToFavorites: 'Added to favorites', removedFromFavorites: 'Removed from favorites',
    confirmRemoveFav: 'Remove this from favorites?',
    alreadyAdded: 'Already in favorites',
    saveFailed: 'Save failed (storage may be full)',
    favoriteUpdated: 'Favorite updated', tabClosed: 'Tab closed',
    allTabsClosed: 'All tabs closed. Fresh start.',
    closedExtras: 'Closed duplicate tab-home tabs',
    closedDupes: 'Closed duplicate tabs',
    closedNFromX: (n: number, name: string) => `Closed ${n} tab${n !== 1 ? 's' : ''} from ${name}`,
    tabs: 'tabs',
    langToggle: '中',
  },
  zh: {
    favorites: '收藏',
    add: '添加', save: '保存', cancel: '取消', confirmOk: '确定',
    uploadLogo: '上传图标（或粘贴图片）', reset: '重置', auto: '自动',
    urlLabel: '网址', titleLabel: '标题',
    titlePlaceholder: '标题（可选）',
    favoritesEmpty: '还没有收藏。点击 + 添加链接，或在右侧给标签页标星。',
    addAFavorite: '添加收藏',
    edit: '编辑', remove: '删除', moreActions: '更多',
    rightNow: '正在打开', openTabs: '当前标签', pinned: '已固定',
    nTabsCount: (n: number) => `${n} 个标签`,
    homepages: '主页',
    nDomains: (n: number) => `${n} 个域名`,
    nTabsOpen: (n: number) => `已打开 ${n} 个`,
    dupeBadge: (n: number) => `重复 x ${n}`,
    closeAllN: (n: number) => `关闭全部 ${n} 个`,
    closeDupes: '关闭重复',
    plusN: (n: number) => `还有 ${n} 个`,
    statTabs: '已打开',
    addToFav: '加入收藏', removeFromFav: '移除收藏',
    pinTip: '固定此标签', unpinTip: '取消固定',
    closeThisTab: '关闭此标签',
    nWolfyTabsOpen: '个 tab-home 标签页', keepOne: '只保留一个',
    addedToFavorites: '已加入收藏', removedFromFavorites: '已从收藏移除',
    confirmRemoveFav: '确定要取消收藏此网址吗？',
    alreadyAdded: '已经收藏过了',
    saveFailed: '保存失败（存储可能已满）',
    favoriteUpdated: '收藏已更新', tabClosed: '标签已关闭',
    allTabsClosed: '所有标签已关闭。重新开始。',
    closedExtras: '已关闭重复的 tab-home',
    closedDupes: '已关闭重复的标签页',
    closedNFromX: (n: number, name: string) => `已从 ${name} 关闭 ${n} 个标签`,
    tabs: '个',
    langToggle: 'EN',
  },
}

const lang = ref<LangCode>('en')

export function useI18n() {
  function t(key: string, ...args: any[]): string {
    const v = (STRINGS[lang.value] && STRINGS[lang.value][key]) ?? STRINGS.en[key] ?? key
    return typeof v === 'function' ? (v as (...a: any[]) => string)(...args) : v
  }

  async function loadLang(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('lang')
      if (result.lang === 'zh' || result.lang === 'en') {
        lang.value = result.lang
      }
    } catch { /* use default */ }
  }

  async function saveLang(l: LangCode): Promise<void> {
    if (l !== 'zh' && l !== 'en') return
    lang.value = l
    try { await chrome.storage.local.set({ lang: l }) } catch { /* ignore */ }
  }

  async function toggleLang(): Promise<void> {
    const next = lang.value === 'zh' ? 'en' : 'zh'
    await saveLang(next)
  }

  return { lang, t, loadLang, saveLang, toggleLang }
}
