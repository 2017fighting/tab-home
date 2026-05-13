# tab-home

**让你的新标签页有意义。**

tab-home 是一个 Chrome 浏览器扩展，把默认的「新标签页」替换成一个干净的个人仪表板：左侧是长期收藏的网址，右侧是当前打开的所有标签（按域名分组）。

完全本地运行——无服务器、无账号、不联网上传任何数据。Fork 自 [tab-out](https://github.com/zarazhangrui/tab-out) by [Zara](https://x.com/zarazhangrui)。

---

## 主要功能

### 收藏区（左半屏）
- 无限收藏网格，拖拽排序
- 鼠标悬停 → 右上角出现 ⋯ 菜单，可编辑或删除
- 自动抓取网站 logo（优先 `apple-touch-icon.png`，兜底 Chrome 缓存的 favicon）
- **自定义 logo**：编辑收藏时可上传图片或直接 `Cmd+V` 粘贴剪贴板里的图片，自动压缩到 256×256
- **智能命名**：留空标题自动从 URL 提取品牌名（`www.binance.com` → `Binance`）

### 当前标签区（右半屏）
- 按域名自动分组成卡片
- **固定标签**单独置顶显示，与未固定的明确分开
- 每个标签卡片有四个操作：
  - ⭐ 加入收藏 / 取消收藏
  - 📌 固定 / 取消固定
  - ✕ 关闭这个标签
  - 重复标签会显示 `重复 x N` 徽章，悬停变成「关闭重复」按钮
- **按最近活跃排序**：你刚切过去的网站组所在卡片排在最顶上
- 实时同步：在浏览器其他位置开/关/切换标签，这里跟着自动刷新

### 右键菜单
- 在任意网页右键 → 「Add page to tab-home favorites」直接收藏当前页
- 右键链接 → 「Add link to tab-home favorites」收藏该链接

### 其他
- 🌙 / ☀️ **深色 / 浅色模式切换**（右上角，自动记忆）
- 🌐 **中英文切换**（右上角，所有 UI 文案跟着切）
- 直接点收藏 → 当前 tab 跳转；`Cmd+点击` → 后台新 tab；`Cmd+Shift+点击` → 前台新 tab；`Shift+点击` → 新窗口（与原生 `<a>` 链接行为完全一致）
- 右键收藏 → 弹出 Edit/Remove 菜单

---

## 安装方式

### 方法 1：让 Coding Agent 帮你装

把这个仓库地址发给 Claude Code / Codex / Cursor 等 agent：

```
https://github.com/2017fighting/tab-home
```

### 方法 2：手动安装

**1. Clone 仓库**

```bash
git clone https://github.com/2017fighting/tab-home.git
cd tab-home
```

**2. 安装依赖并构建**

```bash
npm install
npm run build
```

**3. 加载到 Chrome**

1. 打开 Chrome，访问 `chrome://extensions`
2. 右上角打开 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择 `extension/` 文件夹

---

## 技术栈

| 用途 | 实现 |
|------|------|
| 框架 | Vue 3 (Composition API) |
| 语言 | TypeScript |
| 构建 | Vite + vite-plugin-web-extension |
| 状态管理 | Pinia |
| CSS | Tailwind CSS v4 |
| 数据存储 | chrome.storage.local |
| 图标 | Chrome `_favicon/` API + base64 缓存 |
| 音效 | Web Audio API（合成）|
| 动效 | CSS transitions + JS 撒花粒子 |
| 字体 | DM Sans |
| 多语言 | 自研 i18n 字符串表 |

## 自定义

`config.local.js`（gitignored，放在 `extension/` 下）可以放个性化配置。比如自定义某些域名的「主页」分组规则——参考 `LOCAL_LANDING_PAGE_PATTERNS` 和 `LOCAL_CUSTOM_GROUPS`。

---

## License

MIT

---

Forked from [tab-out](https://github.com/zarazhangrui/tab-out) by [Zara](https://x.com/zarazhangrui)
