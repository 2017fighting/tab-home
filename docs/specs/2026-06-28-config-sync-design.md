# 多端配置同步设计（chrome.storage.sync）

- 日期：2026-06-28
- 状态：已批准（设计阶段），待实现
- 范围：tab-home 扩展在新标签页里把用户配置（favorites / theme / lang）跨设备同步

## 1. 背景与目标

tab-home 是一个 Chrome MV3 新标签页扩展（Vue 3 + Pinia + Tailwind 4）。当前所有配置存在 `chrome.storage.local`，键为 `favorites`、`theme`、`lang`。`.local` 是**按设备、按浏览器配置隔离**的，不跨设备同步。

目标：让用户在多台电脑（同一 Google 账号、均使用 Chrome）之间自动同步配置，零配置、零凭据、无后端。

### 方案选型结论

| 方案 | 结论 |
|---|---|
| `chrome.storage.sync` | **采纳**。命中场景（个人、Chrome-only、数据小）。零配置、无后端。 |
| WebDAV（坚果云/Nextcloud） | 不采纳。其优势（破体积上限、跨浏览器）对本场景用不上，成本（凭据存储、冲突 UI）实打实。 |
| 混合（sync 放偏好、WebDAV 放收藏） | 不采纳。两套系统复杂度，YAGNI。 |

存储层会抽象成可替换的接口，将来若需跨浏览器/带大量图标，可加 WebDAV 后端而无需重写上层（见第 10 节）。

## 2. 核心约束

- `chrome.storage.sync` 单 key 上限 **8 KB**（`QUOTA_BYTES_PER_ITEM`），总量 **100 KB**（`QUOTA_BYTES`），每分钟写入 **120 次**（`MAX_WRITE_OPERATIONS_PER_MINUTE`）。
- 当前 `MAX_ICON_BYTES = 200 * 1024`（200 KB）。`customLogo`（用户上传）与 `iconUrl`（设备本地 favicon 缓存）单条即可远超 8 KB。
- `favorites` 当前作为**一个** storage key 存整个数组 → 整个数组必须 < 8 KB，一条带图标的收藏就撑爆。
- 权限：`storage` 权限已具备，**`.sync` 无需任何新权限、无需改 manifest**。

## 3. 什么同步、什么不同步

| 字段 | 是否同步 | 说明 |
|---|---|---|
| `Favorite.id, url, title, addedAt, slot` | ✅ 同步 | 结构化数据，体积小 |
| `Favorite.iconUrl` | ❌ 不同步 | 设备本地 favicon 缓存，留在 `.local` |
| `Favorite.customLogo` | ❌ 不同步 | 用户上传图标；不跨设备，各设备走 favicon 回退 |
| `theme`、`lang` | ✅ 同步 | 体积极小，直接同步 |

定义同步用的类型：

```ts
type SyncableFavorite = Pick<Favorite, 'id' | 'url' | 'title' | 'addedAt' | 'slot'>
```

> 决策记录：customLogo 不做压缩同步、也不做双分辨率，直接排除。理由是用户极少使用自定义图标，排除可避免压缩/迁移/合并的复杂度。功能本身保留，只是不跨设备。

## 4. 架构：A2（本地为真源，同步为镜像）

```
chrome.storage.local   ← 唯一事实源（store / 组件 / SW 读写路径不变）
  favorites[]          （含 iconUrl 设备缓存 + customLogo）
  theme, lang

chrome.storage.sync    ← 镜像 + 跨设备传输（best-effort）
  cfg_meta             { schema:1, syncedAt:<ms>, chunks:<n> }
  cfg_fav_0..n         SyncableFavorite[]   // 无 iconUrl、无 customLogo
  theme                'light' | 'dark'
  lang                 'en' | 'zh'
```

所有同步逻辑集中在**一个新模块** `useConfigSync`。既有 store / `FavoriteItem.vue` / `useFavicon` / 后台 SW / `useTheme` / `useI18n` 的读写路径**几乎零改动**——它们继续读写 `.local`。

### 为什么不是 A1（直接把 favorites 搬进 `.sync` 当真源）

A1 模型更纯，但要把 `iconUrl` 从 `Favorite` 对象里抽出来、改组件读取方式，牵连面大。A2 把分片/剥离/LWW 合并/防回声等同步专有逻辑全部隔离在一个 composable 里，对已上线的小工具风险更低。

### 关键简化：入站永远只写 `.local`

`App.vue` 已有 `.local` onChanged 监听器会把 `favorites/theme/lang` 应用到响应式状态。入站合并后**只写 `.local`**，既有监听器自动刷新 UI，无需新增 UI 接线。

## 5. 数据流

### 5.1 出站（`.local` → `.sync`）

触发：`.local` onChanged，`key ∈ {favorites, theme, lang}`。统一接住 store、`useFavicon`、后台 SW 的所有本地写入。

```
读最新 .local.favorites
  → map 成 SyncableFavorite[]（剥离 iconUrl、customLogo）
  → 分片：把数组切成多个子数组，使每个子数组 JSON 序列化后 ≤ SYNC_CHUNK_BYTES(≈7KB)
          每片本身是一个合法的 SyncableFavorite[]（不切断单条对象），存为 cfg_fav_0..n
  → diff：整批快照（所有分片拼接的序列化字符串）与上次成功写入的快照相等 → 跳过   ← favicon 写回在此被吸收
  → 有变化：防抖 SYNC_DEBOUNCE_MS(500ms) 后
        写 cfg_fav_* + cfg_meta{schema:1, syncedAt:Date.now(), chunks:n} 到 .sync（try/catch）
        localLastSyncedAt = syncedAt
```

`theme`/`lang` 直接写 `.sync.theme` / `.sync.lang`（极小、无需分片、无需时间戳，天然末写获胜）。

**diff 跳过是配额保护的核心**：`useFavicon` 级别地写回 `iconUrl`，但剥离后快照不变 → 不触发任何 `.sync` 写入。只有真正的结构变化（增删改 / 换序）才同步。

### 5.2 入站（`.sync` → `.local`）

触发：`storage.onChanged`，`area === 'sync'`，`key ∈ {cfg_meta, cfg_fav_*, theme, lang}`。

```
聚合所有 cfg_fav_* 重组为 remote favorites
  → 若实到分片数 < cfg_meta.chunks → 判为不完整，本轮跳过，等下一次 .sync 变更
  → LWW：仅当 remote.cfg_meta.syncedAt > localLastSyncedAt 才继续
  → 合并：用 remote 结构化字段重建 favorites，按 id 把本地 iconUrl + customLogo 接回去
  → 置 suppressOutbound = true
  → 写 .local（触发既有 App.vue 监听器刷新 UI）
  → localLastSyncedAt = remote.syncedAt
  → 清 suppressOutbound
```

`theme`/`lang` 入站：若值与本地当前值相同则短路；否则同样在 `suppressOutbound` 包裹下写 `.local`，由既有监听器应用。

### 5.3 时间戳语义（LWW）

- `cfg_meta.syncedAt`：最后一次成功写入 `.sync` 文档的逻辑时间，代表「当前 `.sync` 内容的版本」。
- `localLastSyncedAt`（模块内状态，非持久化）：本地状态当前对应的 `syncedAt`。`init` 时从 `cfg_meta.syncedAt` 读取；每次出站写后置为 `Date.now()`；每次入站合并后置为 `remote.syncedAt`。
- 单用户多设备，**最近用的那台「赢」**，这是有意的、确定的语义。

### 5.4 回声抑制

入站写 `.local` 会同时触发出站监听器。`suppressOutbound` 包裹入站的**所有** `.local` 写（favorites + theme + lang），使其不再回写 `.sync`。store 用户操作的写不受影响（`favStore.suppressSync` 继续管 App.vue 自身触发；出站正常处理该同步的变更）。两个 `.local` 监听器并存（App.vue 既有 + `useConfigSync` 新增），互不干扰。

### 5.5 迁移（`useConfigSync.init`，在 store load 之后）

```
读 .sync cfg_meta
 ├─ .sync 为空 且 .local.favorites 非空
 │     → 播种：剥离切片写 .sync，syncedAt = Date.now()（本机把配置发布上云）
 ├─ .sync 有数据
 │     → 跑一次入站 LWW 合并（remote 更新才应用）
 └─ localLastSyncedAt = 合并/播种后的 syncedAt
然后：无论上面哪条，都再跑一次出站 diff-push（把离线期间的本地变更，如后台 SW 新增，补推上去；幂等）
```

两台机首次同时播种的竞态 → LWW 最终收敛，单用户可接受。

## 6. 没登录 Google 账号的保证

- **不新增任何权限**（不用 `identity` 探测登录态——不可靠且过重；登录态 ≠ 同步已开启）。
- 所有 `.sync` 读写**全部 try/catch、fire-and-forget**。没登录 / 关了同步时：写要么本地暂存、要么静默失败；入站监听器永不触发；**`.local` 照常工作，app 表现和今天完全一致**。
- 永不向用户虚报「已同步 ✓」。MVP 不做同步状态 UI。
- 用户**之后**登录 / 开启同步时，Chrome 自动开始传播 `.sync`，出/入站逻辑自动接上，无需特殊代码路径。

## 7. 文件改动

**新增**
- `src/composables/useConfigSync.ts` — 同步控制器：`init()`、出/入站监听器、diff、防抖、`suppressOutbound`、LWW、迁移。
- `src/utils/syncChunk.ts` — 纯函数 `chunkFavorites(favorites, maxBytes): string[][]`（按序列化体积切子数组，不切断单条对象）/ `reassembleFavorites(chunks): SyncableFavorite[]`。单独抽出便于单测。
- `src/types/storage.ts` — 新增 `SyncMeta`、`SyncableFavorite` 类型。

**修改（极少）**
- `src/App.vue` — store load 之后加 `useConfigSync().init()`。既有 `.local` 监听器保留。
- `src/utils/constants.ts` — 新增 `SYNC_CHUNK_BYTES = 7000`、`SYNC_DEBOUNCE_MS = 500`、key 前缀 `cfg_meta` / `cfg_fav_`。

**完全不改**
`useFavoritesStore`、`useFavicon`、`useTheme`、`useI18n`、`FavoriteItem.vue`、`FavoriteFormModal.vue`、`background/main.ts`、`manifest.json`。后台 SW 写 `.local` 会被出站监听器自动接住同步。

## 8. 边界与错误处理

1. 没登录 / 关同步 → `.sync` 写静默失败或本地暂存，入站不触发，`.local` 不受影响。
2. 配额超限 / 写抛错 → try/catch，`console.warn` 一次，本地照常。
3. 分片不完整（实到 < `cfg_meta.chunks`）→ 本轮跳过合并，等下一次 `.sync` 变更重试。
4. 后台 SW 在无新标签页时新增收藏 → 下次新标签页 `init` 的出站 diff-push 补推，幂等。
5. 远端 `url` 变了 → 按 id 保留本地 `iconUrl`/`customLogo`（图标可能短暂对应旧 url，favicon 链自我修正）。
6. 远端新增 id → 裸数据到达，favicon API 现取图标、无 customLogo（设计如此）。远端删除 id → 本地随之删除（LWW 重建）。
7. 时钟偏差 / 两端同时编辑 → LWW 末写获胜，可能短暂抖动，单用户可接受。

## 9. 测试策略

仓库目前**无测试基建**（仅 `vue-tsc` + `vite`）。

- 新增 **Vitest**。
- 纯函数单测（AAA 模式）：
  - `chunkFavorites` / `reassembleFavorites` 往返一致，且每片序列化后 < 8 KB、不切断单条对象。
  - `stripFavorite` 去掉 `iconUrl` 与 `customLogo`，保留结构化字段。
  - `mergeFavorites(remote, local)`：按 id 回接本地 `iconUrl`+`customLogo`；处理远端新增 / 删除。
  - LWW 时间戳比较（`shouldApplyRemote`）。
- 控制器集成测：mock `chrome.storage`（local + sync 双区 + `onChanged` 注入），验证出站 diff 跳过、入站 LWW、`suppressOutbound` 防回声、迁移播种。
- 手动验收：两个 Chrome 配置各装一份，增删改收藏、切主题/语言，观察是否传播。

## 10. 不在本次范围（未来）

- WebDAV / GitHub Gist 等后端同步（跨浏览器、破体积上限）。存储层抽象成可替换接口后可增量加入。
- 同步状态指示 UI、手动「立即同步 / 解决冲突」按钮。
- customLogo 跨设备同步（当前明确排除）。
- Firefox 等 non-Chromium 浏览器支持。
