export const SLOT_UPPER_BOUND = 10000
export const TRAILING_EMPTY_BUFFER = 4
export const MAX_ICON_BYTES = 200 * 1024
export const MAX_ICON_DIMENSION = 256
export const ICON_CACHE_BATCH_DELAY = 1000
export const TAB_RENDER_DEBOUNCE = 150
export const TOAST_DURATION = 2500

export const BROWSER_INTERNAL_SCHEMES = [
  'chrome://',
  'chrome-extension://',
  'about:',
  'edge://',
  'brave://',
  'chrome-native://',
]

// Config sync (chrome.storage.sync)
export const SYNC_META_KEY = 'cfg_meta'
export const SYNC_FAV_PREFIX = 'cfg_fav_'
export const SYNC_LOCAL_TS_KEY = 'cfg_local_synced_at'
export const SYNC_CHUNK_BYTES = 7000
export const SYNC_DEBOUNCE_MS = 500
