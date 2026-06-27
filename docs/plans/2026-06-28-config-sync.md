# 多端配置同步（chrome.storage.sync）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 tab-home 在多台 Chrome（同一 Google 账号）之间自动同步 favorites / theme / lang，零配置、零新权限，未登录时退化为纯本地。

**Architecture:** A2 —— `chrome.storage.local` 为唯一事实源（既有读写路径不变），新增 `useConfigSync` 把剥离 `iconUrl`/`customLogo` 后的 favorites 分片镜像到 `chrome.storage.sync`，按 `syncedAt` 末写获胜（LWW）合并，回声由「diff 跳过 + 严格 `>` LWW」天然抑制。

**Tech Stack:** TypeScript、Vue 3、Chrome MV3 `chrome.storage`、Vitest。

## Global Constraints

- 同步单 key 上限 8 KB → favorites 必须分片（`SYNC_CHUNK_BYTES = 7000`）。
- 同步只携带 `SyncableFavorite = Pick<Favorite,'id'|'url'|'title'|'addedAt'|'slot'>`；**绝不**同步 `iconUrl` 与 `customLogo`。
- 所有 `.sync` 读写必须 try/catch、fire-and-forget；未登录/关同步时不得影响 `.local`。
- 不新增任何权限、不改 `manifest.json`。
- 回声抑制不依赖时序敏感的标志位：靠出站 diff 跳过 + 入站严格 `>` LWW。
- `localLastSyncedAt` 必须持久化到 `.local`（key `cfg_local_synced_at`），否则重启后 LWW 失效。
- 命名沿用既有风格：util 小文件、`@/` 别名、conventional commits。

> 计划期相对 spec 的两处细化（已并入上文约束）：(1) `localLastSyncedAt` 持久化；(2) 回声抑制改用 diff/LWW 而非 `suppressOutbound` 标志位（更鲁棒）。

---

## File Structure

- **新增** `src/test/chromeStorageMock.ts` —— Vitest 用的 `chrome.storage` 双区 mock（local + sync + onChanged + 写日志）。
- **新增** `src/utils/syncChunk.ts` —— 纯函数：`chunkFavorites` / `reassembleFavorites`。
- **新增** `src/utils/syncMerge.ts` —— 纯函数：`toSyncableFavorite` / `mergeFavorites` / `shouldApplyRemote`。
- **新增** `src/composables/useConfigSync.ts` —— 同步控制器（出站/入站/迁移/监听器）。
- **新增** `vitest.config.ts` —— 独立测试配置（不加载 web-extension 插件）。
- **修改** `src/types/storage.ts` —— 新增 `SyncableFavorite`、`SyncMeta`。
- **修改** `src/utils/constants.ts` —— 新增 `SYNC_*` 常量。
- **修改** `src/App.vue` —— store load 后调用 `useConfigSync().init()`。
- **修改** `package.json` —— 加 vitest devDep + test 脚本。

---

## Task 1: Vitest 基建 + chrome.storage mock

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/chromeStorageMock.ts`
- Create: `src/test/sanity.test.ts`

**Interfaces:**
- Produces: `createChromeStorageMock()` → `{ local, sync, onChanged }`，其中每个 area 暴露 `__store`（当前数据）与 `__logs`（每次 set 的快照数组）；`set`/`remove` 会通过 `queueMicrotask` 派发 `onChanged`。

- [ ] **Step 1: 安装 vitest**

Run: `npm i -D vitest`
Expected: `package.json` 的 `devDependencies` 出现 `vitest`。

- [ ] **Step 2: 加 test 脚本**

修改 `package.json` 的 `scripts`，加入：

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: 写 vitest 配置**

Create `vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
```

- [ ] **Step 4: 写 chrome.storage mock**

Create `src/test/chromeStorageMock.ts`：

```ts
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
```

- [ ] **Step 5: 写 sanity 测试验证基建**

Create `src/test/sanity.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { createChromeStorageMock, installChromeStorageMock } from './chromeStorageMock'

describe('vitest sanity', () => {
  it('mock stores and reads values', async () => {
    const mock = createChromeStorageMock()
    installChromeStorageMock(mock)
    await mock.local.set({ favorites: [{ id: '1' }] })
    const { favorites } = await mock.local.get('favorites')
    expect(favorites).toEqual([{ id: '1' }])
    expect(mock.local.__logs).toHaveLength(1)
  })
})
```

- [ ] **Step 6: 运行测试**

Run: `npm test`
Expected: 1 passed。

- [ ] **Step 7: 提交**

```bash
git add package.json vitest.config.ts src/test/
git commit -m "test: add vitest + chrome.storage mock harness"
```

---

## Task 2: 同步类型 + 常量

**Files:**
- Modify: `src/types/storage.ts`
- Modify: `src/utils/constants.ts`

**Interfaces:**
- Produces: `SyncableFavorite`（= `Pick<Favorite,'id'|'url'|'title'|'addedAt'|'slot'>`）、`SyncMeta`（`{ schema: number; syncedAt: number; chunks: number }`）；常量 `SYNC_META_KEY='cfg_meta'`、`SYNC_FAV_PREFIX='cfg_fav_'`、`SYNC_LOCAL_TS_KEY='cfg_local_synced_at'`、`SYNC_CHUNK_BYTES=7000`、`SYNC_DEBOUNCE_MS=500`。

- [ ] **Step 1: 扩展 storage 类型**

在 `src/types/storage.ts`（已有 `import type { Favorite } from './favorite'`）追加：

```ts
export type SyncableFavorite = Pick<Favorite, 'id' | 'url' | 'title' | 'addedAt' | 'slot'>

export interface SyncMeta {
  schema: number
  syncedAt: number
  chunks: number
}
```

- [ ] **Step 2: 加常量**

在 `src/utils/constants.ts` 末尾追加：

```ts
// Config sync (chrome.storage.sync)
export const SYNC_META_KEY = 'cfg_meta'
export const SYNC_FAV_PREFIX = 'cfg_fav_'
export const SYNC_LOCAL_TS_KEY = 'cfg_local_synced_at'
export const SYNC_CHUNK_BYTES = 7000
export const SYNC_DEBOUNCE_MS = 500
```

- [ ] **Step 3: 类型检查**

Run: `npx vue-tsc --noEmit`
Expected: 无错误。

- [ ] **Step 4: 提交**

```bash
git add src/types/storage.ts src/utils/constants.ts
git commit -m "feat(sync): add syncable types and constants"
```

---

## Task 3: 分片纯函数 `syncChunk.ts`

**Files:**
- Create: `src/utils/syncChunk.ts`
- Test: `src/utils/syncChunk.test.ts`

**Interfaces:**
- Consumes: `SyncableFavorite` from `@/types`.
- Produces: `chunkFavorites(favorites: SyncableFavorite[], maxBytes: number): SyncableFavorite[][]`；`reassembleFavorites(chunks: SyncableFavorite[][]): SyncableFavorite[]`。

- [ ] **Step 1: 写失败测试**

Create `src/utils/syncChunk.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { chunkFavorites, reassembleFavorites } from './syncChunk'
import type { SyncableFavorite } from '@/types'

function fav(id: string): SyncableFavorite {
  return { id, url: `https://${id}.example.com`, title: id, addedAt: '2026-06-28T00:00:00.000Z', slot: 0 }
}

describe('chunkFavorites', () => {
  it('returns one chunk when everything fits', () => {
    const chunks = chunkFavorites([fav('a'), fav('b')], 7000)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toHaveLength(2)
  })

  it('splits into multiple chunks under the byte budget', () => {
    const many = Array.from({ length: 50 }, (_, i) => fav(`id-${i}`))
    const chunks = chunkFavorites(many, 7000)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(JSON.stringify(c).length).toBeLessThanOrEqual(7000)
    }
  })

  it('never splits a single favorite across chunks', () => {
    const chunks = chunkFavorites([fav('a'), fav('b'), fav('c')], 120)
    const recombined = reassembleFavorites(chunks)
    expect(recombined.map((f) => f.id).sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('reassembleFavorites', () => {
  it('round-trips chunked favorites', () => {
    const original = Array.from({ length: 30 }, (_, i) => fav(`id-${i}`))
    const recombined = reassembleFavorites(chunkFavorites(original, 7000))
    expect(recombined).toEqual(original)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/utils/syncChunk.test.ts`
Expected: FAIL（`Cannot find module './syncChunk'`）。

- [ ] **Step 3: 写实现**

Create `src/utils/syncChunk.ts`：

```ts
import type { SyncableFavorite } from '@/types'

/**
 * 把 favorites 切成多个子数组，使每个子数组 JSON 序列化后 <= maxBytes。
 * 单条 favorite 不会被切断；若单条本身超 maxBytes，它独占一片（由调用方的 try/catch 兜底）。
 */
export function chunkFavorites(favorites: SyncableFavorite[], maxBytes: number): SyncableFavorite[][] {
  const chunks: SyncableFavorite[][] = []
  let current: SyncableFavorite[] = []
  let currentSize = 2 // "[]"

  const flush = (): void => {
    if (current.length > 0) {
      chunks.push(current)
      current = []
      currentSize = 2
    }
  }

  for (const fav of favorites) {
    const itemSize = JSON.stringify(fav).length + 1 // +1 for comma separator
    if (currentSize + itemSize > maxBytes && current.length > 0) flush()
    current.push(fav)
    currentSize += itemSize
  }
  flush()
  return chunks
}

export function reassembleFavorites(chunks: SyncableFavorite[][]): SyncableFavorite[] {
  return chunks.flat()
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/utils/syncChunk.test.ts`
Expected: 4 passed。

- [ ] **Step 5: 提交**

```bash
git add src/utils/syncChunk.ts src/utils/syncChunk.test.ts
git commit -m "feat(sync): add favorites chunking pure functions"
```

---

## Task 4: 合并纯函数 `syncMerge.ts`

**Files:**
- Create: `src/utils/syncMerge.ts`
- Test: `src/utils/syncMerge.test.ts`

**Interfaces:**
- Consumes: `Favorite`、`SyncableFavorite` from `@/types`.
- Produces: `toSyncableFavorite(f: Favorite): SyncableFavorite`；`shouldApplyRemote(remoteSyncedAt: number, localLastSyncedAt: number): boolean`；`mergeFavorites(remote: SyncableFavorite[], local: Favorite[]): Favorite[]`。

- [ ] **Step 1: 写失败测试**

Create `src/utils/syncMerge.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { toSyncableFavorite, shouldApplyRemote, mergeFavorites } from './syncMerge'
import type { Favorite, SyncableFavorite } from '@/types'

describe('toSyncableFavorite', () => {
  it('strips iconUrl and customLogo', () => {
    const fav: Favorite = {
      id: '1', url: 'https://x.com', title: 'X', addedAt: '2026-06-28T00:00:00.000Z', slot: 0,
      iconUrl: 'data:...', customLogo: 'data:logo...',
    }
    const syncable = toSyncableFavorite(fav)
    expect(syncable).toEqual({ id: '1', url: 'https://x.com', title: 'X', addedAt: '2026-06-28T00:00:00.000Z', slot: 0 })
    expect('iconUrl' in syncable).toBe(false)
    expect('customLogo' in syncable).toBe(false)
  })
})

describe('shouldApplyRemote', () => {
  it('applies only when remote is strictly newer', () => {
    expect(shouldApplyRemote(200, 100)).toBe(true)
    expect(shouldApplyRemote(100, 100)).toBe(false)
    expect(shouldApplyRemote(50, 100)).toBe(false)
  })
})

describe('mergeFavorites', () => {
  const local: Favorite[] = [
    { id: '1', url: 'https://old.com', title: 'Old', addedAt: '2026-01-01T00:00:00.000Z', slot: 0, iconUrl: 'data:1', customLogo: 'data:l1' },
    { id: '2', url: 'https://b.com', title: 'B', addedAt: '2026-01-02T00:00:00.000Z', slot: 1, iconUrl: 'data:2' },
  ]
  const remote: SyncableFavorite[] = [
    { id: '1', url: 'https://new.com', title: 'New', addedAt: '2026-06-28T00:00:00.000Z', slot: 0 },
    { id: '3', url: 'https://c.com', title: 'C', addedAt: '2026-06-28T00:00:00.000Z', slot: 2 },
  ]

  it('remote structured fields win, local iconUrl/customLogo preserved by id', () => {
    const merged = mergeFavorites(remote, local)
    const m1 = merged.find((f) => f.id === '1')!
    expect(m1.url).toBe('https://new.com')
    expect(m1.iconUrl).toBe('data:1')
    expect(m1.customLogo).toBe('data:l1')
  })

  it('remote-new favorites arrive bare (no icon/logo)', () => {
    const merged = mergeFavorites(remote, local)
    const m3 = merged.find((f) => f.id === '3')!
    expect(m3.url).toBe('https://c.com')
    expect('iconUrl' in m3).toBe(false)
    expect('customLogo' in m3).toBe(false)
  })

  it('locally-deleted-on-remote ids are dropped', () => {
    const merged = mergeFavorites(remote, local)
    expect(merged.find((f) => f.id === '2')).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/utils/syncMerge.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 写实现**

Create `src/utils/syncMerge.ts`：

```ts
import type { Favorite, SyncableFavorite } from '@/types'

export function toSyncableFavorite(f: Favorite): SyncableFavorite {
  return { id: f.id, url: f.url, title: f.title, addedAt: f.addedAt, slot: f.slot }
}

export function shouldApplyRemote(remoteSyncedAt: number, localLastSyncedAt: number): boolean {
  return remoteSyncedAt > localLastSyncedAt
}

/**
 * 用 remote 结构化字段重建 favorites，按 id 回接本地 iconUrl/customLogo。
 * 远端新增 → 裸数据；远端缺失的本地 id → 丢弃（LWW 删除传播）。
 */
export function mergeFavorites(remote: SyncableFavorite[], local: Favorite[]): Favorite[] {
  const localById = new Map(local.map((f) => [f.id, f]))
  return remote.map((r) => {
    const existing = localById.get(r.id)
    return existing ? { ...existing, ...r } : ({ ...r } as Favorite)
  })
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/utils/syncMerge.test.ts`
Expected: 5 passed。

- [ ] **Step 5: 提交**

```bash
git add src/utils/syncMerge.ts src/utils/syncMerge.test.ts
git commit -m "feat(sync): add strip/merge/LWW pure functions"
```

---

## Task 5: 出站镜像（`pushOutbound`）

**Files:**
- Create: `src/composables/useConfigSync.ts`
- Test: `src/composables/useConfigSync.test.ts`

**Interfaces:**
- Consumes: `chunkFavorites` from `@/utils/syncChunk`、`toSyncableFavorite` from `@/utils/syncMerge`、`SYNC_*` from `@/utils/constants`、`Favorite`/`SyncableFavorite`/`SyncMeta` from `@/types`。
- Produces: 模块内 `pushOutbound()`、`schedulePush()`、`__resetSyncState()`；导出 `useConfigSync()` 占位（返回 `{ init: async () => {} }`，init 在 Task 7 实现）。

- [ ] **Step 1: 写失败测试**

Create `src/composables/useConfigSync.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createChromeStorageMock, installChromeStorageMock } from '@/test/chromeStorageMock'
import { SYNC_META_KEY, SYNC_FAV_PREFIX, SYNC_CHUNK_BYTES } from '@/utils/constants'
import { pushOutbound, __resetSyncState } from './useConfigSync'
import type { Favorite } from '@/types'

function localFav(id: string): Favorite {
  return { id, url: `https://${id}.com`, title: id, addedAt: '2026-06-28T00:00:00.000Z', slot: 0, iconUrl: `data:${id}` }
}

describe('pushOutbound', () => {
  let mock: ReturnType<typeof createChromeStorageMock>
  beforeEach(async () => {
    mock = createChromeStorageMock()
    installChromeStorageMock(mock)
    __resetSyncState()
    await mock.local.set({ favorites: [localFav('a'), localFav('b')] })
  })

  it('writes chunked stripped favorites + meta to sync', async () => {
    await pushOutbound()
    const all = await mock.sync.get(null)
    const meta = all[SYNC_META_KEY] as { schema: number; syncedAt: number; chunks: number }
    expect(meta.schema).toBe(1)
    expect(meta.chunks).toBeGreaterThanOrEqual(1)
    const chunkKeys = Object.keys(all).filter((k) => k.startsWith(SYNC_FAV_PREFIX)).sort()
    const recombined = chunkKeys.flatMap((k) => all[k] as unknown[])
    expect(recombined).toHaveLength(2)
    expect(recombined[0]).not.toHaveProperty('iconUrl')
    expect(recombined[0]).not.toHaveProperty('customLogo')
  })

  it('keeps every chunk under the byte budget', async () => {
    const many = Array.from({ length: 40 }, (_, i) => localFav(`id-${i}`))
    await mock.local.set({ favorites: many })
    await pushOutbound()
    const all = await mock.sync.get(null)
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith(SYNC_FAV_PREFIX)) expect(JSON.stringify(v).length).toBeLessThanOrEqual(SYNC_CHUNK_BYTES)
    }
  })

  it('skips writing when the stripped snapshot is unchanged', async () => {
    await pushOutbound()
    const writesAfterFirst = mock.sync.__logs.length
    await pushOutbound()
    expect(mock.sync.__logs.length).toBe(writesAfterFirst)
  })

  it('writes again when content changes', async () => {
    await pushOutbound()
    const writesAfterFirst = mock.sync.__logs.length
    await mock.local.set({ favorites: [localFav('a'), localFav('b'), localFav('c')] })
    await pushOutbound()
    expect(mock.sync.__logs.length).toBeGreaterThan(writesAfterFirst)
  })

  it('prunes stale higher-index chunks when count shrinks', async () => {
    const many = Array.from({ length: 40 }, (_, i) => localFav(`id-${i}`))
    await mock.local.set({ favorites: many })
    await pushOutbound()
    const bigChunkCount = Object.keys(await mock.sync.get(null)).filter((k) => k.startsWith(SYNC_FAV_PREFIX)).length
    await mock.local.set({ favorites: [localFav('only')] })
    await pushOutbound()
    const all = await mock.sync.get(null)
    const remaining = Object.keys(all).filter((k) => k.startsWith(SYNC_FAV_PREFIX))
    const meta = all[SYNC_META_KEY] as { chunks: number }
    expect(remaining.length).toBe(meta.chunks)
    expect(meta.chunks).toBeLessThan(bigChunkCount)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/composables/useConfigSync.test.ts`
Expected: FAIL（模块/导出不存在）。

- [ ] **Step 3: 写实现**

Create `src/composables/useConfigSync.ts`：

```ts
import { chunkFavorites, reassembleFavorites } from '@/utils/syncChunk'
import { toSyncableFavorite } from '@/utils/syncMerge'
import {
  SYNC_CHUNK_BYTES,
  SYNC_DEBOUNCE_MS,
  SYNC_FAV_PREFIX,
  SYNC_META_KEY,
} from '@/utils/constants'
import type { Favorite, SyncableFavorite, SyncMeta } from '@/types'

const CHUNK_KEY_RE = /^cfg_fav_\d+$/
const chunkIndex = (k: string): number => parseInt(k.slice(SYNC_FAV_PREFIX.length), 10)

let localLastSyncedAt = 0
let lastPushedSnapshot = ''
let pushTimer: ReturnType<typeof setTimeout> | null = null

/** 仅测试用：重置模块状态。 */
export function __resetSyncState(): void {
  localLastSyncedAt = 0
  lastPushedSnapshot = ''
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
}

async function readLocalFavorites(): Promise<Favorite[]> {
  const { favorites } = await chrome.storage.local.get('favorites')
  return Array.isArray(favorites) ? favorites : Object.values(favorites || {})
}

async function readExistingChunkKeys(): Promise<string[]> {
  const all = await chrome.storage.sync.get(null)
  return Object.keys(all).filter((k) => CHUNK_KEY_RE.test(k))
}

function snapshotOf(syncable: SyncableFavorite[]): string {
  return JSON.stringify(syncable)
}

/** 把本地 favorites 剥离后分片写入 .sync（diff 跳过 + 失败静默）。 */
export async function pushOutbound(): Promise<void> {
  const local = await readLocalFavorites()
  const syncable = local.map(toSyncableFavorite)
  const snapshot = snapshotOf(syncable)
  if (snapshot === lastPushedSnapshot) return

  const chunks = chunkFavorites(syncable, SYNC_CHUNK_BYTES)
  const now = Date.now()
  const meta: SyncMeta = { schema: 1, syncedAt: now, chunks: chunks.length }
  const payload: Record<string, unknown> = { [SYNC_META_KEY]: meta }
  chunks.forEach((c, i) => {
    payload[`${SYNC_FAV_PREFIX}${i}`] = c
  })
  const stale = (await readExistingChunkKeys()).filter((k) => chunkIndex(k) >= chunks.length)

  try {
    await chrome.storage.sync.set(payload)
    if (stale.length > 0) await chrome.storage.sync.remove(stale)
    lastPushedSnapshot = snapshot
    localLastSyncedAt = now
  } catch (e) {
    console.warn('[sync] outbound push failed (sync unavailable or quota exceeded)', e)
  }
}

/** 防抖触发出站。 */
export function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void pushOutbound()
  }, SYNC_DEBOUNCE_MS)
}

// reassembleFavorites 在 Task 6 的 readSyncDoc 中使用；先引用，Task 6 删除该占位。
void reassembleFavorites

export function useConfigSync(): { init: () => Promise<void> } {
  return { init: async () => { /* Task 7 实现 */ } }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/composables/useConfigSync.test.ts`
Expected: 5 passed。

- [ ] **Step 5: 类型检查**

Run: `npx vue-tsc --noEmit`
Expected: 无错误。

- [ ] **Step 6: 提交**

```bash
git add src/composables/useConfigSync.ts src/composables/useConfigSync.test.ts
git commit -m "feat(sync): add outbound mirror with chunking and diff-skip"
```

---

## Task 6: 入站合并（`applyInbound`）

**Files:**
- Modify: `src/composables/useConfigSync.ts`
- Test: `src/composables/useConfigSync.test.ts`（追加 describe）

**Interfaces:**
- Consumes: `reassembleFavorites` from `@/utils/syncChunk`、`mergeFavorites` / `shouldApplyRemote` from `@/utils/syncMerge`。
- Produces: `applyRemote(remote, syncedAt)`、`applyInbound()`。

- [ ] **Step 1: 追加失败测试**

把 `useConfigSync.test.ts` 顶部 import 改为：

```ts
import { pushOutbound, applyInbound, __resetSyncState } from './useConfigSync'
import { SYNC_META_KEY, SYNC_FAV_PREFIX, SYNC_CHUNK_BYTES } from '@/utils/constants'
import { chunkFavorites } from '@/utils/syncChunk'
import type { Favorite, SyncableFavorite, SyncMeta } from '@/types'
```

在文件末尾追加：

```ts
function remoteFav(id: string, url = `https://${id}.com`): SyncableFavorite {
  return { id, url, title: id, addedAt: '2026-06-28T00:00:00.000Z', slot: 0 }
}

async function seedSync(
  remote: SyncableFavorite[],
  syncedAt: number,
  mock: ReturnType<typeof createChromeStorageMock>,
): Promise<void> {
  const chunks = chunkFavorites(remote, 7000)
  const payload: Record<string, unknown> = {
    [SYNC_META_KEY]: { schema: 1, syncedAt, chunks: chunks.length } as SyncMeta,
  }
  chunks.forEach((c, i) => {
    payload[`cfg_fav_${i}`] = c
  })
  await mock.sync.set(payload)
}

describe('applyInbound', () => {
  let mock: ReturnType<typeof createChromeStorageMock>
  beforeEach(() => {
    mock = createChromeStorageMock()
    installChromeStorageMock(mock)
    __resetSyncState()
  })

  it('applies newer remote, preserving local iconUrl/customLogo by id', async () => {
    await mock.local.set({
      favorites: [
        { id: '1', url: 'https://old.com', title: 'Old', addedAt: '2026-01-01T00:00:00.000Z', slot: 0, iconUrl: 'data:1', customLogo: 'data:l1' },
      ],
    })
    await seedSync([remoteFav('1', 'https://new.com')], 500, mock)
    await applyInbound()
    const { favorites } = await mock.local.get('favorites') as { favorites: Favorite[] }
    expect(favorites[0].url).toBe('https://new.com')
    expect(favorites[0].iconUrl).toBe('data:1')
    expect(favorites[0].customLogo).toBe('data:l1')
  })

  it('skips when remote is not strictly newer', async () => {
    await mock.local.set({ favorites: [localFav('1')] })
    await seedSync([remoteFav('1', 'https://remote.com')], 100, mock)
    await pushOutbound() // localLastSyncedAt 变为 now(>100)
    const before = (await mock.local.get('favorites') as { favorites: Favorite[] }).favorites
    await applyInbound()
    const after = (await mock.local.get('favorites') as { favorites: Favorite[] }).favorites
    expect(after).toEqual(before)
  })

  it('skips incomplete remote (fewer chunks than meta.chunks)', async () => {
    await mock.local.set({ favorites: [localFav('1')] })
    await mock.sync.set({ [SYNC_META_KEY]: { schema: 1, syncedAt: 999, chunks: 2 } })
    await applyInbound()
    const { favorites } = await mock.local.get('favorites') as { favorites: Favorite[] }
    expect(favorites).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/composables/useConfigSync.test.ts`
Expected: FAIL（`applyInbound` 未导出）。

- [ ] **Step 3: 写实现**

修改 `src/composables/useConfigSync.ts`：

(a) 删除文件中的占位行 `void reassembleFavorites`。

(b) 顶部 import 合并为：

```ts
import { chunkFavorites, reassembleFavorites } from '@/utils/syncChunk'
import { toSyncableFavorite, mergeFavorites, shouldApplyRemote } from '@/utils/syncMerge'
```

(c) 在 `schedulePush` 之后、`useConfigSync` 之前加入：

```ts
interface SyncDoc {
  meta: SyncMeta | null
  favorites: SyncableFavorite[]
  complete: boolean
}

async function readSyncDoc(): Promise<SyncDoc> {
  const all = await chrome.storage.sync.get(null)
  const meta = (all[SYNC_META_KEY] as SyncMeta | undefined) ?? null
  const chunkKeys = Object.keys(all)
    .filter((k) => CHUNK_KEY_RE.test(k))
    .sort((a, b) => chunkIndex(a) - chunkIndex(b))
  const chunks = chunkKeys.map((k) => all[k] as SyncableFavorite[])
  const complete = meta ? chunks.length >= meta.chunks : false
  return { meta, favorites: reassembleFavorites(chunks), complete }
}

/** 用 remote 结构化字段重建本地 favorites（回接本地图标），更新 LWW 状态。 */
async function applyRemote(remote: SyncableFavorite[], syncedAt: number): Promise<void> {
  const { favorites } = await chrome.storage.local.get('favorites')
  const localArr: Favorite[] = Array.isArray(favorites) ? favorites : Object.values(favorites || {})
  const merged = mergeFavorites(remote, localArr)
  try {
    await chrome.storage.local.set({ favorites: merged })
    lastPushedSnapshot = snapshotOf(remote)
    localLastSyncedAt = syncedAt
  } catch (e) {
    console.warn('[sync] inbound apply failed', e)
  }
}

/** 入站：读 .sync，完整且严格更新时合并到 .local。 */
export async function applyInbound(): Promise<void> {
  const { meta, favorites: remote, complete } = await readSyncDoc()
  if (!meta || !complete) return
  if (!shouldApplyRemote(meta.syncedAt, localLastSyncedAt)) return
  await applyRemote(remote, meta.syncedAt)
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/composables/useConfigSync.test.ts`
Expected: 全部 passed。

- [ ] **Step 5: 类型检查**

Run: `npx vue-tsc --noEmit`
Expected: 无错误。

- [ ] **Step 6: 提交**

```bash
git add src/composables/useConfigSync.ts src/composables/useConfigSync.test.ts
git commit -m "feat(sync): add inbound LWW merge with icon preservation"
```

---

## Task 7: 迁移 + init + 监听器接线

**Files:**
- Modify: `src/composables/useConfigSync.ts`
- Test: `src/composables/useConfigSync.test.ts`（追加 describe）

**Interfaces:**
- Produces: `init()`（读取/持久化 `localLastSyncedAt`、迁移播种/拉取、注册 `onLocalChanged`/`onSyncChanged`）；`useConfigSync()` 返回真正的 `{ init }`。

- [ ] **Step 1: 追加失败测试**

把 `useConfigSync.test.ts` 顶部 import 改为：

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createChromeStorageMock, installChromeStorageMock } from '@/test/chromeStorageMock'
import { SYNC_META_KEY, SYNC_FAV_PREFIX, SYNC_CHUNK_BYTES, SYNC_LOCAL_TS_KEY, SYNC_DEBOUNCE_MS } from '@/utils/constants'
import { chunkFavorites } from '@/utils/syncChunk'
import { pushOutbound, applyInbound, init, __resetSyncState } from './useConfigSync'
import type { Favorite, SyncableFavorite, SyncMeta } from '@/types'
```

末尾追加：

```ts
describe('init', () => {
  let mock: ReturnType<typeof createChromeStorageMock>
  beforeEach(() => {
    vi.useFakeTimers()
    mock = createChromeStorageMock()
    installChromeStorageMock(mock)
    __resetSyncState()
  })
  afterEach(() => vi.useRealTimers())

  it('seeds sync from local when sync is empty', async () => {
    await mock.local.set({ favorites: [localFav('a'), localFav('b')] })
    await init()
    const all = await mock.sync.get(null)
    expect(all[SYNC_META_KEY]).toBeDefined()
    const ts = (await mock.local.get(SYNC_LOCAL_TS_KEY) as Record<string, number>)[SYNC_LOCAL_TS_KEY]
    expect(typeof ts).toBe('number')
  })

  it('pulls remote into empty local (fresh device)', async () => {
    await seedSync([remoteFav('a'), remoteFav('b')], 300, mock)
    await init()
    const { favorites } = await mock.local.get('favorites') as { favorites: Favorite[] }
    expect(favorites.map((f) => f.id).sort()).toEqual(['a', 'b'])
    expect(mock.sync.__logs.length).toBeLessThanOrEqual(1)
  })

  it('no-op when both empty', async () => {
    await init()
    expect((await mock.sync.get(null))[SYNC_META_KEY]).toBeUndefined()
  })

  it('pushes local-only changes when local differs from same-age remote', async () => {
    await seedSync([remoteFav('a')], 300, mock)
    await mock.local.set({ favorites: [localFav('a'), localFav('b')] })
    await mock.local.set({ [SYNC_LOCAL_TS_KEY]: 300 })
    await init()
    const all = await mock.sync.get(null)
    const recombined = Object.keys(all)
      .filter((k) => k.startsWith(SYNC_FAV_PREFIX))
      .flatMap((k) => all[k] as { id: string }[])
    expect(recombined.map((f) => f.id).sort()).toEqual(['a', 'b'])
  })

  it('wires onLocalChanged → schedulePush → outbound', async () => {
    await mock.local.set({ favorites: [localFav('a')] })
    await init()
    const writesBefore = mock.sync.__logs.length
    await mock.local.set({ favorites: [localFav('a'), localFav('b')] })
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS)
    const all = await mock.sync.get(null)
    const recombined = Object.keys(all)
      .filter((k) => k.startsWith(SYNC_FAV_PREFIX))
      .flatMap((k) => all[k] as { id: string }[])
    expect(recombined).toHaveLength(2)
    expect(mock.sync.__logs.length).toBeGreaterThan(writesBefore)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/composables/useConfigSync.test.ts`
Expected: FAIL（`init` 未真正实现）。

- [ ] **Step 3: 写实现**

修改 `src/composables/useConfigSync.ts`：

(a) 顶部常量 import 增加 `SYNC_LOCAL_TS_KEY`：

```ts
import {
  SYNC_CHUNK_BYTES,
  SYNC_DEBOUNCE_MS,
  SYNC_FAV_PREFIX,
  SYNC_LOCAL_TS_KEY,
  SYNC_META_KEY,
} from '@/utils/constants'
```

(b) 模块状态增加 `initialized`，并在 `__resetSyncState` 里 `initialized = false`：

```ts
let initialized = false
```

(c) `pushOutbound` 成功分支末尾改为（加持久化）：

```ts
    lastPushedSnapshot = snapshot
    localLastSyncedAt = now
    void persistLocalTs()
```

(d) `applyRemote` 成功分支末尾改为：

```ts
    lastPushedSnapshot = snapshotOf(remote)
    localLastSyncedAt = syncedAt
    void persistLocalTs()
```

(e) 在 `applyInbound` 之后加入持久化、监听器、init，并替换占位 `useConfigSync`：

```ts
async function persistLocalTs(): Promise<void> {
  try {
    await chrome.storage.local.set({ [SYNC_LOCAL_TS_KEY]: localLastSyncedAt })
  } catch {
    /* ignore */
  }
}

async function loadLocalTs(): Promise<number> {
  const { [SYNC_LOCAL_TS_KEY]: ts } = await chrome.storage.local.get(SYNC_LOCAL_TS_KEY)
  return typeof ts === 'number' ? ts : 0
}

function onLocalChanged(changes: Record<string, { newValue?: unknown }>, area: string): void {
  if (area !== 'local') return
  if ('favorites' in changes) schedulePush()
  // theme/lang 在 Task 8 接入
}

function onSyncChanged(_changes: Record<string, { newValue?: unknown }>, area: string): void {
  if (area !== 'sync') return
  void applyInbound()
  // theme/lang 在 Task 8 接入
}

export async function init(): Promise<void> {
  if (initialized) return
  initialized = true

  chrome.storage.onChanged.addListener(onLocalChanged)
  chrome.storage.onChanged.addListener(onSyncChanged)

  localLastSyncedAt = await loadLocalTs()
  const { meta, favorites: remote, complete } = await readSyncDoc()

  if (meta && complete) {
    lastPushedSnapshot = snapshotOf(remote)
    if (shouldApplyRemote(meta.syncedAt, localLastSyncedAt)) {
      await applyRemote(remote, meta.syncedAt)
    }
  } else {
    lastPushedSnapshot = ''
  }

  await pushOutbound() // 补推本地差异（离线/SW 写入）；diff 跳过保证幂等
  await persistLocalTs()
}

export function useConfigSync(): { init: () => Promise<void> } {
  return { init }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/composables/useConfigSync.test.ts`
Expected: 全部 passed。

- [ ] **Step 5: 类型检查**

Run: `npx vue-tsc --noEmit`
Expected: 无错误。

- [ ] **Step 6: 提交**

```bash
git add src/composables/useConfigSync.ts src/composables/useConfigSync.test.ts
git commit -m "feat(sync): add migration, init, and storage listeners"
```

---

## Task 8: theme / lang 同步

**Files:**
- Modify: `src/composables/useConfigSync.ts`
- Test: `src/composables/useConfigSync.test.ts`（追加 describe）

**Interfaces:**
- Produces: 模块内 `pushThemeLang()`、`applyInboundThemeLang()`，并在 `onLocalChanged`/`onSyncChanged`/`init` 中接入。

- [ ] **Step 1: 追加失败测试**

末尾追加：

```ts
describe('theme/lang sync', () => {
  let mock: ReturnType<typeof createChromeStorageMock>
  beforeEach(() => {
    vi.useFakeTimers()
    mock = createChromeStorageMock()
    installChromeStorageMock(mock)
    __resetSyncState()
  })
  afterEach(() => vi.useRealTimers())

  it('outbound mirrors local theme/lang to sync', async () => {
    await mock.local.set({ theme: 'dark', lang: 'zh' })
    await init()
    const sync = await mock.sync.get(['theme', 'lang']) as { theme?: string; lang?: string }
    expect(sync.theme).toBe('dark')
    expect(sync.lang).toBe('zh')
  })

  it('inbound applies remote theme/lang to local', async () => {
    await mock.local.set({ theme: 'light', lang: 'en' })
    await init()
    await mock.sync.set({ theme: 'dark', lang: 'zh' })
    const local = await mock.local.get(['theme', 'lang']) as { theme?: string; lang?: string }
    expect(local.theme).toBe('dark')
    expect(local.lang).toBe('zh')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/composables/useConfigSync.test.ts`
Expected: FAIL（theme/lang 未同步）。

- [ ] **Step 3: 写实现**

修改 `src/composables/useConfigSync.ts`：

(a) 模块状态增加，并在 `__resetSyncState` 中重置：

```ts
let lastPushedTheme: string | undefined
let lastPushedLang: string | undefined
```

(b) 在 `applyInbound` 之后加入：

```ts
async function pushThemeLang(): Promise<void> {
  const { theme, lang } = await chrome.storage.local.get(['theme', 'lang'])
  const payload: Record<string, unknown> = {}
  if (theme !== undefined && theme !== lastPushedTheme) payload.theme = theme
  if (lang !== undefined && lang !== lastPushedLang) payload.lang = lang
  if (Object.keys(payload).length === 0) return
  try {
    await chrome.storage.sync.set(payload)
    if (payload.theme !== undefined) lastPushedTheme = payload.theme as string
    if (payload.lang !== undefined) lastPushedLang = payload.lang as string
  } catch (e) {
    console.warn('[sync] theme/lang push failed', e)
  }
}

async function applyInboundThemeLang(): Promise<void> {
  const remote = await chrome.storage.sync.get(['theme', 'lang'])
  const local = await chrome.storage.local.get(['theme', 'lang'])
  const patch: Record<string, unknown> = {}
  if (remote.theme !== undefined && remote.theme !== local.theme) patch.theme = remote.theme
  if (remote.lang !== undefined && remote.lang !== local.lang) patch.lang = remote.lang
  if (Object.keys(patch).length === 0) return
  try {
    await chrome.storage.local.set(patch)
    if (patch.theme !== undefined) lastPushedTheme = patch.theme as string
    if (patch.lang !== undefined) lastPushedLang = patch.lang as string
  } catch (e) {
    console.warn('[sync] inbound theme/lang apply failed', e)
  }
}
```

(c) `onLocalChanged` 改为：

```ts
function onLocalChanged(changes: Record<string, { newValue?: unknown }>, area: string): void {
  if (area !== 'local') return
  if ('favorites' in changes) schedulePush()
  if ('theme' in changes || 'lang' in changes) void pushThemeLang()
}
```

(d) `onSyncChanged` 改为：

```ts
function onSyncChanged(_changes: Record<string, { newValue?: unknown }>, area: string): void {
  if (area !== 'sync') return
  void applyInbound()
  void applyInboundThemeLang()
}
```

(e) `init` 在 `await pushOutbound()` 之后加：

```ts
  await pushThemeLang()
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/composables/useConfigSync.test.ts`
Expected: 全部 passed。

- [ ] **Step 5: 类型检查**

Run: `npx vue-tsc --noEmit`
Expected: 无错误。

- [ ] **Step 6: 提交**

```bash
git add src/composables/useConfigSync.ts src/composables/useConfigSync.test.ts
git commit -m "feat(sync): mirror theme and lang across devices"
```

---

## Task 9: 接入 App.vue + 全量校验 + 手动验收

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `useConfigSync().init()` from `@/composables/useConfigSync`。

- [ ] **Step 1: 接入 init**

修改 `src/App.vue` `<script setup>`，import 区加：

```ts
import { useConfigSync } from '@/composables/useConfigSync'
```

在 `onMounted` 内、`await Promise.all([favStore.load(), tabsStore.load()])` 之后、`document.documentElement.lang = ...` 之前，加入：

```ts
  // 启动跨设备配置同步（本地为真源；未登录时静默退化为纯本地）
  const { init: initSync } = useConfigSync()
  void initSync()
```

- [ ] **Step 2: 全量测试**

Run: `npm test`
Expected: 全部 passed。

- [ ] **Step 3: 生产构建**

Run: `npm run build`
Expected: `vue-tsc --noEmit` + `vite build` 均成功，输出到 `extension/`。

- [ ] **Step 4: 手动验收（两配置文件）**

在两个 Chrome 用户配置（profile A、B，同一 Google 账号、均开启同步）各加载 `extension/`：

1. A 新标签页：添加 2 条收藏、切主题 dark、切语言中文。
2. 约 1s 后打开 B 新标签页：应见同样的 2 条收藏（图标由 B 自行 favicon 获取，customLogo 不出现属预期）、dark 主题、中文。
3. B 删除其中 1 条 → A 新标签页随之删除（重开触发 init/入站）。
4. 关闭 A 的 Chrome 同步 → A 本地增删改仍正常、无报错；重开后恢复同步。

> 验收要点：未登录/关同步时表现 = 改造前（纯本地），无报错、无虚假「已同步」提示。

- [ ] **Step 5: 提交**

```bash
git add src/App.vue
git commit -m "feat(sync): wire config sync into new tab page"
```

---

## Self-Review

**Spec 覆盖：**
- §3 同步/不同步字段 → Task 4（剥离 iconUrl+customLogo）+ Task 5（出站只写结构化）。✅
- §4 A2 架构 → Task 5/6/7。✅
- §5.1 出站分片 + diff 跳过 → Task 3 + Task 5（diff-skip、stale 清理）。✅
- §5.2 入站 LWW + 回接图标 + 不完整跳过 → Task 6。✅
- §5.3 `syncedAt` LWW → Task 4/6/7（持久化见顶部说明）。✅
- §5.4 回声抑制 → diff-skip + 严格 `>` LWW（顶部说明）。✅
- §5.5 迁移 → Task 7。✅
- §6 未登录保证 → 所有 `.sync` try/catch（Task 5/6/8）+ 不改 manifest（Task 9）。✅
- §7 文件改动 → Task 2/5/9。✅
- §8 边界 → Task 6 + Task 5（配额 warn）。✅
- §9 测试 → Task 1 + 各任务 TDD。✅
- theme/lang → Task 8。✅

**占位扫描：** 无 TBD/TODO；Task 5 的 `void reassembleFavorites` 占位在 Task 6 步骤 3(a) 明确删除。✅

**类型一致性：** `SyncableFavorite`、`SyncMeta`、`pushOutbound`/`applyInbound`/`init`/`__resetSyncState`、常量名在各任务间一致；纯函数签名与调用点匹配。✅
