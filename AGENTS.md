# AGENTS.md — tab-home

tab-home 是 Chrome 新标签页替代扩展，用 Vue 3 + TypeScript + Vite + Tailwind CSS 构建。

## 项目结构

```
src/
├── manifest.json                  # Chrome MV3 清单（构建入口）
├── style.css                      # Tailwind 指令 + 全局样式
├── App.vue                        # 根组件 + Chrome API 事件监听
├── entrypoints/newtab/
│   ├── index.html                 # HTML 壳
│   └── main.ts                    # Vue 应用启动
├── background/main.ts             # Service Worker（badge + 右键菜单）
├── types/                         # TypeScript 类型定义
├── utils/                         # 纯函数（domain, title, url, time）
├── composables/                   # 可组合逻辑（tabs, i18n, theme, favicon, DnD 等）
├── stores/                        # Pinia 状态管理
│   ├── useFavoritesStore.ts       # 收藏 CRUD + 拖拽排序 + chrome.storage 同步
│   ├── useTabsStore.ts            # 标签页状态 + 域名分组
│   ├── useThemeStore.ts           # 深浅色主题
│   └── useI18nStore.ts            # 中英文切换
├── components/
│   ├── layout/                    # AppHeader, AppFooter, AppToast
│   ├── favorites/                 # FavoritesColumn, FavoriteItem, FavoriteFormModal, FavoriteEmptySlot
│   ├── tabs/                      # TabsColumn, DomainCardSection, DomainCard, TabChip, DupeBadge
│   ├── ui/                        # SectionHeader, EmptyState, ConfirmDialog
│   └── icons/                     # SVG 图标组件
└── assets/icons/                  # PNG 图标源文件

extension/                         # 构建输出（可直接加载到 Chrome）
```

## 开发命令

```bash
npm install        # 安装依赖
npm run dev        # Vite 开发服务器
npm run build      # 类型检查 + 构建
npm run watch      # 构建并监听文件变化
npm run clean      # 删除 extension/ 输出目录
```

## 安装到 Chrome

1. 构建：`npm run build`
2. 打开 `chrome://extensions`，开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择 `extension/` 目录

## 架构要点

- **Manifest V3**，所有数据存 `chrome.storage.local`，无服务器
- **Pinia setup stores**：`useFavoritesStore` 管理收藏的完整生命周期，增删改操作后自动 `persist()` 到 storage；`onChanged` 监听 background 的修改并同步回 store
- **Composables 是单例模式**（模块级变量），toast/confirm/sound/confetti 等全局状态跨组件共享
- **HTML5 原生拖拽**：`useDragAndDrop` composable 处理 favorites 网格的拖拽排序
- **Favicon 缓存**：useFavicon 提供 fallback chain → Chrome `_favicon/` API → 下载后 base64 缓存到 storage（200KB max per icon）
- **config.local.js**：可选配置文件，定义 `LOCAL_LANDING_PAGE_PATTERNS` 和 `LOCAL_CUSTOM_GROUPS`，构建时不打包（作为外部脚本加载）
- CSS 类名保持与原始版本一致（`.mission-card`, `.page-chip`, `.chip-action` 等）

## 权限

`tabs / activeTab / storage / contextMenus / favicon` + `<all_urls>` host 权限（用于 favicon 二进制缓存）

## 上游

fork 自 [zarazhangrui/tab-out](https://github.com/zarazhangrui/tab-out)
