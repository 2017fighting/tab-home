type StorageChange = { oldValue?: unknown; newValue?: unknown }
type Listener = (changes: Record<string, StorageChange>, area: string) => void

interface AreaApi {
  get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>
  set: (obj: Record<string, unknown>) => Promise<void>
  remove: (keys: string | string[]) => Promise<void>
  __store: Record<string, unknown>
  __logs: Array<Record<string, unknown>>
}

function makeArea(areaName: string, listeners: Listener[]): AreaApi {
  const store: Record<string, unknown> = {}
  const logs: Array<Record<string, unknown>> = []
  const fire = (changes: Record<string, StorageChange>) => {
    queueMicrotask(() => listeners.forEach((l) => l(changes, areaName)))
  }
  return {
    __store: store,
    __logs: logs,
    async get(keys) {
      if (keys === null || keys === undefined) return { ...store }
      if (typeof keys === 'string') return keys in store ? { [keys]: store[keys] } : {}
      const out: Record<string, unknown> = {}
      for (const k of keys) if (k in store) out[k] = store[k]
      return out
    },
    async set(obj) {
      const changes: Record<string, StorageChange> = {}
      for (const [k, v] of Object.entries(obj)) {
        changes[k] = { oldValue: k in store ? store[k] : undefined, newValue: v }
        store[k] = v
      }
      logs.push(obj)
      fire(changes)
    },
    async remove(keys) {
      const arr = Array.isArray(keys) ? keys : [keys]
      const changes: Record<string, StorageChange> = {}
      for (const k of arr) if (k in store) { changes[k] = { oldValue: store[k], newValue: undefined }; delete store[k] }
      fire(changes)
    },
  }
}

export interface ChromeStorageMock {
  local: AreaApi
  sync: AreaApi
  onChanged: { addListener: (l: Listener) => void; removeListener: (l: Listener) => void; __listeners: Listener[] }
}

export function createChromeStorageMock(): ChromeStorageMock {
  const listeners: Listener[] = []
  return {
    local: makeArea('local', listeners),
    sync: makeArea('sync', listeners),
    onChanged: {
      addListener: (l) => listeners.push(l),
      removeListener: (l) => {
        const i = listeners.indexOf(l)
        if (i >= 0) listeners.splice(i, 1)
      },
      __listeners: listeners,
    },
  }
}

/** 把 mock 挂到 globalThis.chrome.storage，供被测代码读取。 */
export function installChromeStorageMock(mock: ChromeStorageMock): void {
  ;(globalThis as { chrome?: unknown }).chrome = { storage: mock as unknown as never }
}
