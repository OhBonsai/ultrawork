# UltraWork V1 功能迁移方案 v2

> 基于 `feature-migrate.md` 方案 + `feature-migrate-review.md` 评审意见合并修订。
>
> 本文档将 `ultrademo-v1-feature.md` 中标记【第一版本】的最小功能集，与当前 `app-feature-map.md`（OpenCode 现有功能）进行逐项对比，明确：
> - **可复用** — 功能已存在，仅需 UI 重排或微调
> - **需改造** — 功能部分存在，需要修改交互或扩展
> - **需新增** — 功能完全不存在，需从零实现

---

## 〇、代码改造策略

> **核心原则：不删代码文件，只换引用；通过路由双版本共存。**

### 技术栈确认

| 类别 | 实际技术 |
|------|---------|
| 框架 | **SolidJS**（`solid-js`、`solid-js/store`） |
| 路由 | `@solidjs/router` |
| UI 组件库 | `@kobalte/core`（Solid 版 Radix UI） |
| 样式 | Tailwind CSS 4 + CSS 变量 |
| 状态管理 | `createStore` + `createSignal` + Context Provider |
| 国际化 | `@solid-primitives/i18n`（`t()` 函数） |
| 桌面集成 | Tauri 2（通过 `PlatformProvider` 抽象） |
| SDK | `@opencode-ai/sdk`（后端通信） |
| e2e 测试 | Playwright |
| 拖拽 | `@thisbeyond/solid-dnd` |

### 改造原则

1. **路由级切换**：`app.tsx` 中同时注册 v1 和 v2 两套路由。v1 路由（`/v1/*`）指向原组件，v2 路由（`/`）指向新组件。默认进入 v2。
2. **较大修改 → 新建 `xxx_v2.tsx`**：对现有组件进行较大改造时，**不修改原文件**，而是新建一个 `xxx_v2.tsx`。原文件保持不动，v1 路由继续引用原文件。
3. **"删除" → 仅在 v2 路由中不引用**：不需要的组件，**保留原始 `.tsx` 文件不动**，v1 路由继续使用，v2 路由的父组件中不再 import。
4. **全新功能 → 直接新建文件**：新增的组件正常创建新文件，仅在 v2 路由中引用。
5. **微调复用 → 可直接改原文件**：标记为 `=` 的组件，改动量小，可以直接在原文件上修改，v1/v2 共享。
6. **e2e 双版本**：原有 e2e 测试改为跑 `/v1` 前缀路由，保证不回归。新增 e2e 测试跑 `/`（v2）路由验证新功能。
7. **UI 一致性**：新增页面和组件必须使用项目现有 UI 包（`@kobalte/core` + Tailwind CSS 4）和现有样式变量/主题 token，保持与 v1 视觉风格一致。禁止引入新的 UI 框架或组件库。
8. **国际化**：新增文案必须通过 `t()` 函数国际化（`@solid-primitives/i18n`），不得硬编码中文或英文字符串。
9. **export 命名约定**：`_v2.tsx` 文件中的导出名**不带 `v2` 后缀**（如 `export function SidebarShell()`），仅文件名区分版本。减少 Phase 3 清理时的改动面。
10. **Lazy Import**：v1 和 v2 路由组件均使用 `lazy(() => import(...))` 按需加载，避免双版本共存期间包体积膨胀。

### 路由设计

```
app.tsx 路由配置示意：

v1 路由（原版完整保留）：
/v1                        → layout.tsx     → home.tsx
/v1/:dir/session/:id?      → layout.tsx     → session.tsx

v2 路由（新版默认）：
/                          → layout_v2.tsx  → home_v2.tsx
/task/:dir/:id             → layout_v2.tsx  → session_v2.tsx
```

> **关键设计决策 — 保留 `:dir` 上下文**（评审 P0-2）：
>
> 当前 SDK 的所有 session 操作都是 per-directory 的（`session.list()`、`session.create()` 等依赖目录上下文，通过 `createChildStoreManager(directory)` 隔离状态）。v2 路由必须保留 `:dir` 参数，否则 SDK 无法工作。
>
> 路径选择 `/task/:dir/:id` 而非 query param，保持 URL 结构清晰且可被 e2e 直接导航。

### Provider 共享层级

```
AppBaseProviders (Theme, Language, Dialog)      ← v1/v2 共享
  └─ AppInterface (GlobalSDKProvider, GlobalSyncProvider) ← v1/v2 共享
       └─ RouterRoot (Settings, Models, Command, etc.)   ← v1/v2 共享
            ├─ /v1/* → layout.tsx → SessionProviders     ← v1 独占
            └─ /*    → layout_v2.tsx → SessionProviders   ← v2 独占（可复用同一 Provider）
```

> v1 和 v2 共享 SDK 连接、全局状态、设置、模型等所有基础 Provider。仅 Layout 层各自独立。

### 错误处理

v2 路由外层包裹 `ErrorBoundary`：开发阶段出错时显示"开发中"提示 + 跳转 `/v1` 的链接，避免阻塞测试。

---

## 一、功能映射总表

### 图例

| 标记 | 含义 |
|------|------|
| `=` | 可直接复用，无需改动或仅需微调样式 |
| `~` | 需改造，功能部分存在但交互/结构不同 |
| `+` | 需新增，当前代码库不存在 |

---

### 1. 左边栏 (Left Sidebar)

| V1 功能 | 标记 | OpenCode 现有 | 改造说明 |
|---------|------|---------------|----------|
| 新建任务 | `=` | New Session 按钮 (`sidebar-items.tsx`) | 文案 i18n key 调整 |
| 最近 10 条任务列表 | `~` | Session 列表 (`sidebar-items.tsx`) | **单目录内的 session 列表**扁平展示（去掉 Project/Workspace 视觉层级），running 置顶。注：SDK `session.list()` 为 per-directory，V1 不做跨目录聚合 |
| 置顶 running 任务 | `~` | Session 列表（无排序逻辑） | 需添加按 status 排序：running → completed |
| 任务操作：收藏 | `+` | 无 | 新增 favorite 字段 + UI |
| 任务操作：重命名 | `=` | InlineEditor (`inline-editor.tsx`) | 已有内联重命名，可直接复用 |
| 任务操作：删除 | `=` | Session 删除（已有） | 可复用，增加确认弹窗 |
| 定时任务最近 5 条 | `+` | 无 | **全新功能**：定时任务模型、列表 UI、绿色状态指示 |
| 置顶 running 定时任务 | `+` | 无 | 同上，随定时任务一起实现 |
| 左边栏展开/折叠 | `~` | Sidebar Rail + Panel（hover 展开） | OpenCode 是 Rail(64px)+Panel 双层结构；V1 需要改为**单层可折叠 Sidebar**（展开~210px / 折叠~48px 仅图标） |
| 页面前进/后退 | `+` | 无 | 新增浏览历史导航按钮 |

### 2. 主会话区 (Composer)

| V1 功能 | 标记 | OpenCode 现有 | 改造说明 |
|---------|------|---------------|----------|
| 文本输入框 | `=` | PromptInput (`prompt-input.tsx`) | 复用，改占位文字 |
| 文件/图片上传 | `~` | 图片上传 + 文件附件 | 已有上传能力，但当前绑定于 Session 的 `usePrompt()`/`useFile()` context；Home 页无 session 时需创建"提交后建 session"的模式 |
| 模型切换 | `~` | Model 选择器 (`DialogSelectModel`) | 当前在 Settings 中使用，移至 Composer 需解耦 Provider 依赖，确保在无 session 上下文时可独立工作 |
| 预置模型列表 | `=` | Models Tab in Settings | 已有完整模型管理 |
| 快速配置 Provider 入口 | `=` | Providers Tab in Settings + DialogConnectProvider | 已有 OAuth/API Key 流程 |
| `+` 按钮: MCP 列表+开关 | `~` | Slash 命令 `/mcp` 触发 | V1 需要改为 **`+` 按钮弹出菜单 → MCP 子菜单（带开关列表）** |
| `+` 按钮: Skills 列表+开关 | `+` | 无（OpenCode 无 Skills 概念） | **全新功能**：Skills 启用/禁用列表 + 管理入口 |
| `+` 按钮: Plugins 列表+开关 | `+` | 无（OpenCode 无 Plugins 概念） | **全新功能**：Plugins 启用/禁用列表 + 管理入口 |
| 工作目录选择器 | `~` | 项目通过 Sidebar Rail 切换 | V1 需要**在 Composer 内嵌工作目录下拉选择器** |

### 3. 任务执行过程 (Chat Area)

| V1 功能 | 标记 | OpenCode 现有 | 改造说明 |
|---------|------|---------------|----------|
| 对话消息流 | `=` | Message Timeline (`message-timeline.tsx`) | 可复用 |
| 执行节点展示 (think) | `~` | Reasoning summaries（可配置展开） | V1 要求**默认展示、完成后收缩、手动展开/收缩**的折叠行为 |
| 执行节点展示 (search/execute) | `~` | Tool call 展示（Shell tool parts） | V1 需要统一为**节点卡片样式**（think/search/execute 等类型化展示） |
| 停止执行 | `=` | Composer 有 Cancel 按钮逻辑 | 可复用（前提：已进入 session 上下文） |

### 4. 右侧边栏 (Right Side Panel)

| V1 功能 | 标记 | OpenCode 现有 | 改造说明 |
|---------|------|---------------|----------|
| 右边栏展开/折叠 | `~` | Side Panel 存在但无独立折叠按钮 | 需添加**右上角折叠按钮** |
| 产出物 Preview | `~` | Review Panel (Git Diff) + File Tabs (代码查看) | V1 需要**替换为产物预览面板**（Markdown 渲染、HTML 预览、PDF/PPT 等） |
| 过程产物 + 最终产物 | `+` | 无 | 新增产物列表（按过程/最终分类），点击切换预览 |
| 快速访问（html/pdf/ppt/md/codes） | `+` | 无（File Tabs 仅代码查看） | 新增多格式预览器 |
| 支持打开工作目录 | `+` | "在编辑器中打开"（VS Code 等） | 新增"打开文件夹"操作 |

### 5. 左下角用户区

| V1 功能 | 标记 | OpenCode 现有 | 改造说明 |
|---------|------|---------------|----------|
| 头像 + 昵称 | `+` | 无用户概念 | **全新功能**：用户 Profile（头像 + 昵称），存储到本地配置 |
| 点击弹出设置菜单 | `~` | Settings 通过 Command Palette 或齿轮图标进入 | 需新增 **Settings Popover**（从头像区弹出的快捷菜单） |

### 6. Settings Popover 快捷菜单

| V1 功能 | 标记 | OpenCode 现有 | 改造说明 |
|---------|------|---------------|----------|
| 设置入口 | `=` | Settings Dialog 已有 | 复用，从 Popover 跳转 |
| 语言切换 | `=` | Settings → General → Language | 已有，抽取为级联子菜单 |
| 模型（供应商）入口 | `=` | Settings → Providers / Models | 已有完整功能 |
| 消息通道（钉钉） | `+` | 无 | **全新功能**：钉钉 Webhook 配置弹窗 |
| 帮助文档链接 | `+` | 无 | 简单新增：外部链接跳转 |
| 关于我们（版本信息） | `+` | 无 (有 DialogReleaseNotes 但不同) | 新增 About 弹窗：版本号 + 更新按钮 + 链接 |

### 7. Settings 全页面设置

| V1 功能 | 标记 | OpenCode 现有 | 改造说明 |
|---------|------|---------------|----------|
| 通用 - 全称/昵称 | `+` | 无 | 新增个人资料字段 |
| 通用 - 工作场景 | `+` | 无 | 新增工作场景选择器 |
| 通用 - 主题风格 | `=` | Settings → General → Appearance | 已有 System/Light/Dark |
| 模型供应商配置 | `=` | Settings → Providers + Models | 已有完整功能 |
| 供应商自定义 | `~` | DialogCustomProvider 已有 | 已有，UI 需适配 V1 设计 |

---

## 二、汇总统计

| 类别 | 数量 | 占比 |
|------|------|------|
| `=` 可直接复用 | **12** | 30% |
| `~` 需改造 | **14** | 35% |
| `+` 需新增 | **14** | 35% |

> 相比 v1 方案，模型切换和文件上传从 `=` 调整为 `~`（Home 页无 session 上下文时需适配）。

---

## 三、改造方案

### 依赖关系与并行策略

> **核心原则：按实际依赖约束，无依赖即可并行。使用 `git worktree` 多分支同时开发。**

```
Phase 0  路由基座 + Slot 骨架              ← 唯一串行前置，阻塞所有后续
  │
  ├──→ Phase 1A  Sidebar v2              ┐
  ├──→ Phase 1B  Home v2                 │ UI 重构，互不依赖，4 条线完全并行
  ├──→ Phase 1C  Right Panel v2          │ 各自独立 worktree + 分支
  ├──→ Phase 1D  Settings + Profile      ┘
  │         （1A 优先合入，其余 rebase 后再合入）
  │
  ├──→ Phase 2   全新功能（按优先级逐步实施，内部可并行）
  │    ├─ 定时任务              ← 依赖 1A（嵌入 Sidebar）
  │    ├─ MCP/Skills/Plugins    ← 依赖 1B（挂载于 + 菜单）
  │    ├─ 消息通道 / About / 帮助 ← 依赖 1D（从 Popover 入口触发）
  │    ├─ 隐私 / 能力配置 Tab    ← 依赖 1D（Settings 页面壳）
  │    ├─ 任务收藏 / 浏览历史
  │    └─ 执行节点折叠行为
  │
  └──→ Phase 3   验收清理                ← 依赖所有 Phase 合并完成
```

### Git Worktree 使用策略

```bash
# Phase 0 完成合入 main 后，创建 4 条并行分支
git worktree add ../uw3-sidebar   feature/v2-sidebar      # Phase 1A
git worktree add ../uw3-home      feature/v2-home          # Phase 1B
git worktree add ../uw3-panel     feature/v2-right-panel   # Phase 1C
git worktree add ../uw3-settings  feature/v2-settings      # Phase 1D

# Phase 1 全部合入后，Phase 2 各功能按需创建分支（内部可并行）
git worktree add ../uw3-scheduled feature/v2-scheduled-tasks
git worktree add ../uw3-skills    feature/v2-skills-plugins
git worktree add ../uw3-channels  feature/v2-channels-about
```

### Phase 1 合并顺序

> 虽然 1A/1B/1C/1D 可并行开发，但它们都会触碰 `layout_v2.tsx` 和/或 `session_v2.tsx`。为减少合并冲突：

1. **1A 最先合入**（layout owner）— 填充 `layout_v2.tsx` 的 Sidebar + Top Bar + 内容区 slot
2. **1B、1C、1D** 在 1A 合入后各自 **rebase onto main**，再提交 PR
3. 1B / 1C / 1D 之间无顺序要求，可同时 review & merge

---

### Phase 0：路由基座 + Slot 骨架（唯一串行前置）

**目标**：建立 v1/v2 路由共存骨架，定义 layout_v2 的 slot 结构，适配 e2e fixtures。

#### 0.1 路由双版本共存

| 改动 | 文件 | 说明 |
|------|------|------|
| v1 路由保留 | `app.tsx` | `/v1` → `layout.tsx` → `home.tsx`；`/v1/:dir/session/:id?` → `session.tsx` |
| v2 路由新建 | `app.tsx` | `/` → `layout_v2.tsx` → `home_v2.tsx`；`/task/:dir/:id` → `session_v2.tsx` |
| v2 骨架文件 | `layout_v2.tsx` | 定义 slot 结构：`<SidebarSlot />`、`<TopBarSlot />`、`<ContentSlot />`、`<PanelSlot />`、`<UserSlot />`，各 slot 渲染默认占位 |
| v2 骨架文件 | `home_v2.tsx`, `session_v2.tsx` | 最小占位实现（空壳），后续 Phase 填充内容 |
| ErrorBoundary | `layout_v2.tsx` | v2 路由外层包裹 ErrorBoundary，出错时显示"开发中"+ 跳转 `/v1` 链接 |
| v1/v2 lazy import | `app.tsx` | 两套路由均使用 `lazy(() => import(...))` 按需加载 |
| e2e 路由前缀 | `e2e/*.test.ts` | 原有 e2e 改跑 `/v1` 前缀路由 |
| e2e fixtures 适配 | `e2e/fixtures.ts` | `sessionPath()` / `gotoSession()` / `dirSlug()` 等辅助函数适配 `/v1` 前缀 |

#### Phase 0 完成门禁

- [ ] v1 回归 e2e：原有 e2e 全部改跑 `/v1` 前缀路由，100% 通过
- [ ] `e2e/fixtures.ts` 中路由辅助函数已适配 `/v1` 前缀
- [ ] `e2e/v2/navigation.test.ts` — `/v1` 渲染原版布局，`/` 渲染 v2 骨架（含 slot 占位），两者互不干扰
- [ ] `layout_v2.tsx` ErrorBoundary 生效（模拟错误时显示降级 UI）
- [ ] `pnpm build` 无报错

---

### Phase 1A：Sidebar 重构（layout owner，最先合入）

**依赖**：Phase 0 ｜ **分支**：`feature/v2-sidebar` ｜ **可并行开发**：1B, 1C, 1D ｜ **最先合入**

| 改动 | 文件 | 说明 |
|------|------|------|
| 新建 Sidebar v2 | → `sidebar-shell_v2.tsx` | 单层可折叠 Sidebar（展开 ~210px / 折叠 ~48px），替换 `<SidebarSlot />` |
| Project/Workspace 不引用 | `sidebar-project.tsx`, `sidebar-workspace.tsx` | **保留原文件**，`layout_v2.tsx` 中不再 import |
| 新建 TaskList 组件 | → `sidebar-task-list.tsx`（新文件） | 当前目录内的 session 列表扁平展示，running 置顶（数据源：`useGlobalSync().child(dir).session`） |
| 新建 Top Bar | → `session-header_v2.tsx` | 替换 `<TopBarSlot />`；左：Sidebar 折叠按钮；中：任务标题；右：Right Panel 折叠按钮 |
| 填充 layout_v2 | `layout_v2.tsx` | 将 `<SidebarSlot />` 和 `<TopBarSlot />` 替换为实际组件，保留其他 slot |

#### Phase 1A 完成门禁

- [ ] `e2e/v2/layout.test.ts` — 访问 `/` 渲染 v2 布局（Sidebar v2 + Top Bar）
- [ ] `e2e/v2/sidebar.test.ts` — Sidebar 折叠/展开切换正常；最近任务列表可见；新建任务按钮可点击
- [ ] v1 回归 e2e 通过 + `pnpm build` 无报错

---

### Phase 1B：Home 视图改造

**依赖**：Phase 0 ｜ **分支**：`feature/v2-home` ｜ **可并行开发**：1A, 1C, 1D ｜ **1A 合入后 rebase 再合入**

| 改动 | 文件 | 说明 |
|------|------|------|
| 新建 Home v2 | → `home_v2.tsx` | 欢迎标题 + 能力卡片 + Composer（原 `home.tsx` **保留**给 v1 路由） |
| 工作目录选择器 | → `workspace-selector.tsx`（新文件） | Popover 下拉，显示已配置的目录列表，选择后写入全局 state |
| `+` 按钮菜单 | → `add-menu.tsx`（新文件） | 仅实现文件附件上传（复用原有 Composer 附件能力）；MCP/Skills/Plugins 开关留到 Phase 2 |

#### Home Composer 工作模式

> 当前 Composer（`prompt-input.tsx`）深度耦合于 Session 上下文（`usePrompt()`、`useSync()`、`useFile()` 等 Context）。Home 页无 session 时无法直接复用。

**设计决策**：Home Composer 采用"**提交后创建**"模式：
1. Home 页展示简化版输入框（不依赖 `SessionProviders`），用户输入 prompt + 选择工作目录 + 选择模型
2. 点击"开始"时，调用 SDK `session.create(directory)` 创建 session
3. 创建成功后跳转 `/task/:dir/:id`，进入完整 session 上下文
4. 首条消息自动发送（携带用户在 Home 输入的 prompt）

因此 `home_v2.tsx` 中的输入组件是一个**独立的轻量 Composer**（不复用 `prompt-input.tsx`），避免解耦 Session Provider 的高成本。

#### Phase 1B 完成门禁

- [ ] `e2e/v2/home.test.ts` — `/` 渲染欢迎标题 + 三张能力卡片
- [ ] `e2e/v2/home-composer.test.ts` — 输入框可聚焦输入；工作目录选择器可打开；模型选择器可打开切换
- [ ] `e2e/v2/home-add-menu.test.ts` — `+` 按钮点击弹出菜单；文件附件上传可选择文件
- [ ] `e2e/v2/home-prompts.test.ts` — 点击能力卡片展开推荐 Prompt 列表；点击 Prompt 填入输入框
- [ ] v1 回归 e2e 通过 + `pnpm build` 无报错

---

### Phase 1C：Right Side Panel 改造

**依赖**：Phase 0 ｜ **分支**：`feature/v2-right-panel` ｜ **可并行开发**：1A, 1B, 1D ｜ **1A 合入后 rebase 再合入**

| 改动 | 文件 | 说明 |
|------|------|------|
| 新建 Side Panel v2 | → `session-side-panel_v2.tsx` | 可折叠多 Section 面板，替换 `<PanelSlot />`（原 `session-side-panel.tsx` **保留**给 v1 路由） |
| 新增 Section: 产物列表 | → `artifact-list.tsx`（新文件） | 产物文件列表，点击打开预览 |
| 产物预览区 | → `artifact-preview.tsx`（新文件） | 点击产物后 Chat Area 分屏，左侧对话 + 右侧预览 |
| 多格式预览器 | 含在 `artifact-preview.tsx` | Markdown 渲染 / HTML iframe / 代码高亮 / PDF 等 |
| 更新 session_v2 | `session_v2.tsx` | 引用 `session-side-panel_v2`，去掉 File Tabs / File Tree / Terminal |

#### Artifact 数据模型设计

> 当前 SDK 中无 Artifact 概念。需要定义前端数据模型。

**数据源**：从 `Part`（消息内容部分）中的 tool call 结果提取。当 tool call 产出文件（写文件、生成代码等）时，提取文件路径作为 artifact。

**前端 Store**：

```typescript
// context/artifact.ts
type Artifact = {
  id: string
  sessionId: string
  messageId: string
  filePath: string           // 工作目录下的相对路径
  type: "markdown" | "html" | "code" | "pdf" | "image" | "other"
  stage: "process" | "final" // 过程产物 vs 最终产物
  createdAt: number
}

type ArtifactStore = {
  artifacts: Artifact[]
  selected: string | null    // 当前预览的 artifact id
}
```

**提取逻辑**：
- 遍历 session 的 `Part[]`，筛选 `type === "tool-call"` 且结果包含文件路径的
- 通过 `FileDiff` 数据补充：有 diff 的文件视为过程产物，最终 commit 中的文件视为最终产物
- 不需要 SDK 层面适配，纯前端聚合

#### Phase 1C 完成门禁

- [ ] `e2e/v2/side-panel.test.ts` — 右侧面板可见；折叠/展开按钮切换正常；产物列表 Section 可折叠
- [ ] `e2e/v2/artifact-preview.test.ts` — 点击产物项触发分屏预览；Markdown 文件渲染正确；关闭预览恢复全宽
- [ ] `e2e/v2/task-execution.test.ts` — 从 Home 输入 Prompt → 跳转 `/task/:dir/:id`；消息流展示；停止按钮可点击
- [ ] v1 回归 e2e 通过 + `pnpm build` 无报错

---

### Phase 1D：用户 Profile + Settings 壳

**依赖**：Phase 0 ｜ **分支**：`feature/v2-settings` ｜ **可并行开发**：1A, 1B, 1C ｜ **1A 合入后 rebase 再合入**

> Phase 1D 范围缩减：只做 UI 壳 + 通用 Tab（复用已有设置项）。隐私 Tab 和能力配置 Tab 的**业务逻辑**移至 Phase 2。

#### 1D.1 用户 Profile

| 改动 | 说明 |
|------|------|
| 新增 User Model | 本地存储（`Persist` + localStorage）：全称、昵称、头像、工作场景 |
| 左下角用户区 | → `sidebar-user-profile.tsx`，替换 `<UserSlot />`，显示头像 + 昵称 + 齿轮图标 |
| Settings Popover | → `settings-popover.tsx`，点击弹出快捷菜单（设置 / 语言切换 / 工作目录 / 模型 / 消息通道 / 帮助 / 关于）；消息通道 / 帮助 / 关于入口先显示但点击提示"即将上线" |

#### 1D.2 Settings 页面重组

| 改动 | 说明 |
|------|------|
| Tab 重组 | 原 Tabs: General / Keyboard Shortcuts / Providers / Models → 新 Tabs: **通用** / **隐私** / **能力配置** |
| 通用 Tab | 复用 Language / Appearance / Theme / Font + 新增 全称 / 昵称 / 工作场景 / 通知开关 |
| 隐私 Tab | **占位 UI**：Tab 可切换，内容显示"即将上线"占位（业务逻辑在 Phase 2 实现） |
| 能力配置 Tab | **占位 UI**：同上 |
| Providers/Models | 从 Tab 移至 Settings Popover 的弹窗入口，复用现有 `dialog-settings.tsx` 中的 Providers/Models 逻辑 |

#### 1D-W 工作目录设置（Workspace）✅

> 从 Popover 菜单的「工作目录」入口进入，管理本地工作目录列表。

| 改动 | 文件 | 说明 |
|------|------|------|
| Popover 入口对接 | `settings-popover.tsx` | ✅ 点击「工作目录」打开 `DialogWorkspace`（替换 Coming Soon） |
| 工作目录管理弹窗 | `dialog-workspace.tsx` | ✅ Directories / Environment 两个 Tab；目录列表展示（名称+路径）；添加（文件夹选择器）/ 编辑 / 移除操作；数据源复用 `layout.projects` |
| i18n | `i18n/*.ts` | ✅ 新增 `settingsV2.workspace.*` 文案 key（en/zh） |

#### 1D-P 模型（供应商）设置（Providers & Models）✅

> 从 Popover 菜单的「模型（供应商）」入口进入，复用现有 Providers / Models 功能。

| 改动 | 文件 | 说明 |
|------|------|------|
| Popover 入口对接 | `settings-popover.tsx` | ✅ 点击「模型（供应商）」打开 `DialogProviderModels`（替换 Coming Soon） |
| 模型供应商弹窗 | `dialog-provider-models.tsx` | ✅ 独立 Dialog，内含 Providers / Models 两个 Tab，复用 `SettingsProviders` + `SettingsModels` 组件 |
| i18n | `i18n/*.ts` | ✅ 复用现有 `settings.providers.*` / `settings.models.*` key，无需新增 |

#### Phase 1D 完成门禁

- [x] `e2e/v2/settings/popover.spec.ts` — Popover 菜单项（4 用例）
- [x] `e2e/v2/settings/language.spec.ts` — 语言切换（含 overflow/持久化/dialog 联动，10 用例）
- [x] `e2e/v2/settings/general.spec.ts` — Tab 切换 + 外观设置（8 用例）
- [x] `e2e/v2/settings/providers.spec.ts` — 模型供应商弹窗可打开；Providers/Models Tab 切换正常（6 用例）
- [x] `e2e/v2/settings/workspace.spec.ts` — 工作目录管理弹窗可打开；Directories/Environment Tab 切换正常（7 用例）
- [ ] v1 回归 e2e 通过 + `pnpm build` 无报错

---

### Phase 2：全新功能

**依赖**：Phase 1 全部合入 main 后开始。各功能内部可并行，按优先级逐步实施。

> **强制约束：每个子功能完成后，必须有对应 e2e 通过才算 Done。**

#### 2.1 定时任务（P1，依赖 1A）

| 改动 | 说明 |
|------|------|
| 定时任务数据模型 | cron 表达式 / 调度引擎 |
| Sidebar 定时任务区 | → `sidebar-scheduled-tasks.tsx`，嵌入 `sidebar-shell_v2.tsx`，running 置顶 + 绿色指示 |
| 确认卡片 UI | Schedule / Cancel 交互 |

- [ ] `e2e/v2/scheduled-tasks.test.ts` — Sidebar 定时任务区可见；running 定时任务置顶显示绿色指示；任务确认卡片可交互

#### 2.2 MCP / Skills / Plugins 开关（P1，依赖 1B）

| 改动 | 说明 |
|------|------|
| `+` 菜单: MCP 开关 | `add-menu.tsx` 扩展，MCP 服务级联子菜单 + 启用/禁用开关 |
| `+` 菜单: Skills 开关 | Skills 列表/开关 UI + 加载机制（复用 MCP 模式） |
| `+` 菜单: Plugins 开关 | 同 Skills，独立命名空间 |

- [ ] `e2e/v2/add-menu-extensions.test.ts` — `+` 菜单 → MCP/Skills/Plugins 级联子菜单可展开；开关切换状态正确
- [ ] `e2e/v2/skills.test.ts` — 技能子菜单列表可见；开关切换状态持久化；管理入口可跳转
- [ ] `e2e/v2/plugins.test.ts` — 同 Skills 模式

#### 2.3 消息通道（P1，依赖 1D）

| 改动 | 说明 |
|------|------|
| 消息通道（钉钉） | → `dialog-channels.tsx`，Webhook 配置弹窗 + 通知发送服务 |

- [ ] `e2e/v2/channels.test.ts` — Settings Popover → 消息通道弹窗可打开；钉钉配置表单可填写保存；启用/禁用开关正常

#### 2.4 隐私 / 能力配置 Tab 业务逻辑（P1，依赖 1D）

| 改动 | 说明 |
|------|------|
| 隐私 Tab | 替换占位 → 实现：数据保护声明 / 数据导入导出 / 会话共享开关 / 记忆偏好开关 / 清除数据 |
| 能力配置 Tab | 替换占位 → 实现：记忆管理（生成/导入/导出） / 工具访问模式（自动/按需/始终可用） / 清除缓存 |

- [ ] `e2e/v2/settings-privacy.test.ts` — 隐私 Tab：数据导入/导出按钮可点击；会话共享/记忆偏好开关切换
- [ ] `e2e/v2/settings-capabilities.test.ts` — 能力配置 Tab：工具访问模式三选一切换；记忆管理按钮可点击

#### 2.5 About / 帮助（P2，依赖 1D）

| 改动 | 说明 |
|------|------|
| About 弹窗 | → `dialog-about.tsx`，版本信息 + 更新检查 + 链接 |
| 帮助文档链接 | 一个外部链接 |

- [ ] `e2e/v2/about.test.ts` — Settings Popover → 关于我们弹窗显示版本号和链接

#### 2.6 任务收藏（P2）

| 改动 | 说明 |
|------|------|
| 任务收藏 | Session 增加 favorite 字段 + 星标 UI |

- [ ] `e2e/v2/favorites.test.ts` — 任务右键菜单 → 收藏；收藏后星标可见；再次点击取消收藏

#### 2.7 其他增强（P2）

| 改动 | 说明 |
|------|------|
| 浏览历史前进/后退 | 维护 history stack，Top Bar 按钮 |
| 执行节点折叠行为 | 消息渲染中增加折叠/展开状态管理 |

#### Phase 2 整体门禁

- [ ] v1 回归 e2e 始终 100% 通过
- [ ] `pnpm build` 无报错

---

### Phase 3：验收清理

**依赖**：Phase 1 + Phase 2 全部合入 main

| 改动 | 说明 |
|------|------|
| 删除 `/v1` 路由分支 | `app.tsx` 中移除 v1 路由及 lazy import |
| 删除原版文件（或归档） | 不再需要的 v1 组件 |
| v2 文件重命名 | `git mv xxx_v2.tsx → xxx.tsx`，由于 export 名不含 `v2`（原则 9），仅需更新 import 路径 |
| 自动化脚本 | 提供 `scripts/remove-v2-suffix.sh` 批量执行 `git mv` + `sed` 替换 import |
| e2e 清理 | 删除 `/v1` 前缀测试，v2 测试改为默认路由 |
| 包体积验证 | 对比 Phase 3 前后的构建产物大小，确认冗余已消除 |

#### Phase 3 完成门禁

- [ ] 所有 v2 e2e 通过（路由前缀去掉后仍正常）
- [ ] `pnpm build` 无报错
- [ ] 无残留 `_v2` 后缀文件或 `/v1` 路由引用
- [ ] 构建产物大小回落至合理水平

---

## 四、不再需要的 OpenCode 功能

以下功能在 V1 中**不需要**，可移除或隐藏：

| OpenCode 功能 | 原文件 | 处理方式 |
|---------------|--------|----------|
| Sidebar Rail（64px 图标栏） | `sidebar-shell.tsx` | **保留原文件**，新建 `sidebar-shell_v2.tsx` 替代 |
| Project / Workspace 层级 | `sidebar-project.tsx`, `sidebar-workspace.tsx` | **保留原文件**，在父组件中解除引用 |
| 项目拖拽排序 | `sidebar-project.tsx` | **保留原文件**，随 Project 层级一起解除引用 |
| Git Diff / Review Panel | `session-side-panel.tsx` | **保留原文件**，新建 `session-side-panel_v2.tsx` 替代 |
| File Tabs（代码标签页） | `file-tabs.tsx` | **保留原文件**，在父组件中解除引用 |
| File Tree | `file-tree.tsx` | **保留原文件**，在父组件中解除引用 |
| Terminal Panel | `terminal-panel.tsx` | **保留原文件**，在父组件中解除引用 |
| Slash 命令 (`/`) | `prompt-input.tsx` | 保留代码不动，V1 不强调 |
| @ Mention | `prompt-input.tsx` | 保留代码不动，V1 不强调 |
| Agent 选择器 | `prompt-input.tsx` | 保留代码不动，V1 不强调 |
| Fork Session | `session-header.tsx` | **保留原文件**，新建 `session-header_v2.tsx` 替代 |
| 行级评论 | `file-tabs.tsx` | **保留原文件**，随 File Tabs 一起解除引用 |
| Command Palette | `command-palette` | 保留不动 |
| Keyboard Shortcuts Tab | `dialog-settings.tsx` | **保留原文件**，新建 `dialog-settings_v2.tsx` 替代 |
| 服务器状态指示器 | `home.tsx` | **保留原文件**，新建 `home_v2.tsx` 替代 |
| 服务器选择按钮 | `home.tsx` | **保留原文件**，随 home 一起替换 |

---

## 五、关键文件改动清单

| 文件 | 改动类型 | Phase | 说明 |
|------|----------|-------|------|
| **原文件保留，新建 _v2 替代** | | | |
| `src/pages/layout/sidebar-shell.tsx` | **保留** | — | 原文件不动 |
| → `src/pages/layout/sidebar-shell_v2.tsx` | **新建 v2** | 1A | 单层可折叠 Sidebar，替代原 Rail+Panel |
| `src/pages/home.tsx` | **保留** | — | 原文件不动 |
| → `src/pages/home_v2.tsx` | **新建 v2** | 1B | 欢迎页 + 能力卡片 + 轻量 Composer |
| `src/pages/session/session-header.tsx` | **保留** | — | 原文件不动 |
| → `src/pages/session/session-header_v2.tsx` | **新建 v2** | 1A | Top Bar（折叠+导航+标题） |
| `src/pages/session/session-side-panel.tsx` | **保留** | — | 原文件不动 |
| → `src/pages/session/session-side-panel_v2.tsx` | **新建 v2** | 1C | 产物预览面板（替代 Review/Diff） |
| `src/components/dialog-settings.tsx` | **保留** | — | 原文件不动 |
| → `src/components/dialog-settings_v2.tsx` | **新建 v2** | 1D | Tab 重组：通用 / 隐私(占位) / 能力配置(占位) |
| `src/components/prompt-input.tsx` | **保留** | — | 原文件不动，Home 使用独立轻量 Composer |
| **原文件保留，仅在引用处解除** | | | |
| `src/pages/layout/sidebar-project.tsx` | **保留，解除引用** | 1A | 在 `layout_v2.tsx` 中不再 import |
| `src/pages/layout/sidebar-workspace.tsx` | **保留，解除引用** | 1A | 在 `layout_v2.tsx` 中不再 import |
| `src/pages/session/file-tabs.tsx` | **保留，解除引用** | 1C | 在 `session-side-panel_v2.tsx` 中不再 import |
| `src/pages/session/terminal-panel.tsx` | **保留，解除引用** | 1C | 在 `session_v2.tsx` 中不再 import |
| `src/components/file-tree.tsx` | **保留，解除引用** | 1C | 在 `session-side-panel_v2.tsx` 中不再 import |
| **路由/父组件切换引用** | | | |
| `src/pages/layout.tsx` | **保留** | — | 原文件不动 |
| → `src/pages/layout_v2.tsx` | **新建 v2** | 0+1A | Phase 0 定义 slot 骨架，Phase 1A 填充 Sidebar + TopBar |
| `src/pages/session.tsx` | **保留** | — | 原文件不动 |
| → `src/pages/session_v2.tsx` | **新建 v2** | 0+1C | Phase 0 占位，Phase 1C 填充 |
| `src/app.tsx` | **改造** | 0 | 注册双版本路由 + lazy import + ErrorBoundary |
| **e2e 测试** | | | |
| `e2e/fixtures.ts` | **改造** | 0 | 路由辅助函数适配 `/v1` 前缀 |
| `e2e/*.test.ts`（现有） | **微调** | 0 | baseURL 或路由前缀改为 `/v1` |
| `e2e/v2/*.test.ts`（新增） | **新增** | 各 Phase | v2 版本的 e2e 测试，跑 `/` 路由 |
| **微调复用（直接改原文件）** | | | |
| `src/pages/layout/sidebar-items.tsx` | **微调** | 2.6 | 增加 favorite 字段 + 星标 UI |
| **全新文件** | | | |
| `src/pages/layout/sidebar-task-list.tsx` | 新增 | 1A | 当前目录 session 列表（扁平） |
| `src/pages/layout/sidebar-scheduled-tasks.tsx` | 新增 | 2.1 | 定时任务列表组件 |
| `src/pages/layout/sidebar-user-profile.tsx` | 新增 | 1D | 底部用户头像 + Popover |
| `src/context/artifact.ts` | 新增 | 1C | Artifact store（`createStore<ArtifactStore>`） |
| `src/components/settings-popover.tsx` | 新增 | 1D | 快捷设置菜单（含右侧语言二级面板） |
| `src/components/dialog-coming-soon.tsx` | 新增 | 1D | 未实现功能占位弹窗 |
| `src/components/dialog-workspace.tsx` | 新增 | 1D-W | 工作目录管理弹窗 |
| `src/components/dialog-provider-models.tsx` | 新增 | 1D-P | 模型供应商管理弹窗（复用 SettingsProviders + SettingsModels） |
| `src/components/artifact-preview.tsx` | 新增 | 1C | 多格式产物预览器 |
| `src/components/artifact-list.tsx` | 新增 | 1C | 产物列表面板 |
| `src/components/add-menu.tsx` | 新增 | 1B | `+` 按钮菜单（Phase 1B 仅附件；Phase 2.2 扩展 MCP/Skills/Plugins） |
| `src/components/workspace-selector.tsx` | 新增 | 1B | 工作目录下拉选择器 |
| `src/components/dialog-channels.tsx` | 新增 | 2.3 | 消息通道配置弹窗 |
| `src/components/dialog-about.tsx` | 新增 | 2.5 | 关于我们弹窗 |
| `src/components/settings-general.tsx` | 新增 | 1D | 通用设置（个人资料+通知） |
| `src/components/settings-privacy.tsx` | 新增 | 1D(壳)+2.4(逻辑) | 隐私设置 |
| `src/components/settings-capabilities.tsx` | 新增 | 1D(壳)+2.4(逻辑) | 能力配置设置 |
| `scripts/remove-v2-suffix.sh` | 新增 | 3 | Phase 3 批量重命名自动化脚本 |

---

## 六、评审问题处理追踪

| Review # | 级别 | 问题 | 处理方式 |
|----------|------|------|---------|
| P0-1 | 阻塞 | 框架错配（React → Solid） | 新增"技术栈确认"表，修正原则 7 中的 UI 库描述 |
| P0-2 | 阻塞 | 路由丢失 `:dir` 上下文 | v2 路由改为 `/task/:dir/:id`，保留目录参数 |
| P0-3 | 阻塞 | 扁平任务列表 vs per-directory SDK | 明确 V1 为"单目录内 session 列表"，不做跨目录聚合 |
| P1-4 | 高风险 | 4 分支合并冲突 | Phase 0 定义 slot 结构；1A 最先合入，其余 rebase |
| P1-5 | 高风险 | Phase 1D 范围过大 | 隐私/能力配置 Tab 业务逻辑移至 Phase 2.4，1D 仅做占位 UI |
| P1-6 | 高风险 | Artifact 缺数据模型 | Phase 1C 新增 Artifact 数据模型设计小节 |
| P1-7 | 高风险 | e2e fixtures 需适配 | Phase 0 门禁增加 fixtures.ts 适配检查项 |
| P2-8 | 中风险 | Provider 共享边界 | 新增 Provider 层级示意图 |
| P2-9 | 中风险 | Composer 解耦复杂 | Phase 1B 新增"Home Composer 工作模式"设计说明 |
| P2-10 | 中风险 | _v2 重命名成本 | 原则 9：export 名不含 v2；Phase 3 提供自动化脚本 |
| P3-11 | 建议 | 功能标记偏乐观 | 模型切换、文件上传从 `=` 调整为 `~` |
| P3-12 | 建议 | Phase 编号跳跃 | 重新编号为 0 → 1A-1D → 2 → 3 |
| P3-13 | 建议 | 包体积 | 原则 10：lazy import；Phase 3 增加体积验证 |
| P3-14 | 建议 | 错误处理 | Phase 0 增加 ErrorBoundary |
| P3-15 | 建议 | 国际化 | 原则 8：新增文案必须 `t()` 国际化 |
