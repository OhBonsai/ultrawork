# UltraWork V1 功能迁移方案

> 本文档将 `ultrademo-v1-feature.md` 中标记【第一版本】的最小功能集，与当前 `app-feature-map.md`（OpenCode 现有功能）进行逐项对比，明确：
> - **可复用** — 功能已存在，仅需 UI 重排或微调
> - **需改造** — 功能部分存在，需要修改交互或扩展
> - **需新增** — 功能完全不存在，需从零实现

---

## 〇、代码改造策略


> **核心原则：不删代码文件，只换引用；通过路由双版本共存。**

1. **路由级切换**：`app.tsx` 中同时注册 v1 和 v2 两套路由。v1 路由（`/v1/*`）指向原组件，v2 路由（`/` 或 `/v2/*`）指向新组件。默认进入 v2。
2. **较大修改 → 新建 `xxx_v2.tsx`**：对现有组件进行较大改造时，**不修改原文件**，而是新建一个 `xxx_v2.tsx`（如 `sidebar-shell_v2.tsx`、`session-side-panel_v2.tsx`）。原文件保持不动，v1 路由继续引用原文件。
3. **"删除" → 仅在 v2 路由中不引用**：不需要的组件（如 `sidebar-project.tsx`、`file-tabs.tsx`、`terminal-panel.tsx`），**保留原始 `.tsx` 文件不动**，v1 路由继续使用它们，v2 路由的父组件中不再 import。
4. **全新功能 → 直接新建文件**：新增的组件（如 `artifact-preview.tsx`、`dialog-channels.tsx`）正常创建新文件，仅在 v2 路由中引用。
5. **微调复用 → 可直接改原文件**：标记为 `=`（可直接复用）的组件，改动量小（如改文案、加字段），可以直接在原文件上修改，v1/v2 共享。
6. **e2e 双版本**：原有 e2e 测试改为跑 `/v1` 前缀路由，保证不回归。新增 e2e 测试跑 `/`（v2）路由验证新功能。
7. **UI 一致性**：新增页面和组件必须优先使用项目现有 UI 包（Radix UI、Tailwind CSS 4 等）和现有样式变量/主题 token，保持与 v1 视觉风格一致。禁止引入新的 UI 框架或组件库；如需自定义样式，沿用现有 CSS 变量和 Tailwind 类名规范。

```
app.tsx 路由配置示意：

/v1                        → layout.tsx     → home.tsx        (原版完整保留)
/v1/:dir/session/:id?      → layout.tsx     → session.tsx     (原版完整保留)

/                          → layout_v2.tsx  → home_v2.tsx     (新版默认)
/task/:id                  → layout_v2.tsx  → session_v2.tsx  (新版任务详情)
```

好处：
- **随时对比**：开发过程中访问 `/v1` 即可看到原版，对照验收
- **e2e 零回归风险**：原有 e2e 改跑 `/v1` 路由即可全部通过，不需要改测试逻辑
- **渐进式迁移**：可以先迁移 Home，再迁移 Session，每个 Phase 独立验证
- **一键清理**：验收完成后，删除 `/v1` 路由分支 + 旧文件，将 v2 文件重命名去掉 `_v2` 后缀

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
| 新建任务 | `=` | New Session 按钮 (`sidebar-items.tsx`) | 文案从 "New session" 改为 "新建任务" |
| 最近 10 条任务列表 | `~` | Session 列表 (`sidebar-items.tsx`) | OpenCode 按 Project→Workspace→Session 三级组织；V1 需要**扁平化为单层任务列表**，去掉 Project/Workspace 层级 |
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
| 文件/图片上传 | `=` | 图片上传 + 文件附件 | 已有粘贴/按钮上传，可复用 |
| 模型切换 | `=` | Model 选择器 (`DialogSelectModel`) | 已有，可复用 |
| 预置模型列表 | `=` | Models Tab in Settings | 已有完整模型管理 |
| 快速配置 Provider 入口 | `=` | Providers Tab in Settings + DialogConnectProvider | 已有 OAuth/API Key 流程 |
| `+` 按钮: MCP 列表+开关 | `~` | Slash 命令 `/mcp` 触发 | OpenCode 的 MCP 通过 `/mcp` 命令和 Status Popover 管理；V1 需要改为 **`+` 按钮弹出菜单 → MCP 子菜单（带开关列表）** |
| `+` 按钮: Skills 列表+开关 | `+` | 无（OpenCode 无 Skills 概念） | **全新功能**：Skills 启用/禁用列表 + 管理入口 |
| `+` 按钮: Plugins 列表+开关 | `+` | 无（OpenCode 无 Plugins 概念） | **全新功能**：Plugins 启用/禁用列表 + 管理入口 |
| 工作目录选择器 | `~` | 项目通过 Sidebar Rail 切换 | OpenCode 项目切换在 Sidebar；V1 需要**在 Composer 内嵌工作目录下拉选择器** |

### 3. 任务执行过程 (Chat Area)

| V1 功能 | 标记 | OpenCode 现有 | 改造说明 |
|---------|------|---------------|----------|
| 对话消息流 | `=` | Message Timeline (`message-timeline.tsx`) | 可复用 |
| 执行节点展示 (think) | `~` | Reasoning summaries（可配置展开） | OpenCode 有 reasoning 展示，但 V1 要求**默认展示、完成后收缩、手动展开/收缩**的折叠行为 |
| 执行节点展示 (search/execute) | `~` | Tool call 展示（Shell tool parts） | OpenCode 有工具调用展示，V1 需要统一为**节点卡片样式**（think/search/execute 等类型化展示） |
| 停止执行 | `=` | Composer 有 Cancel 按钮逻辑 | 可复用 |

### 4. 右侧边栏 (Right Side Panel)

| V1 功能 | 标记 | OpenCode 现有 | 改造说明 |
|---------|------|---------------|----------|
| 右边栏展开/折叠 | `~` | Side Panel 存在但无独立折叠按钮 | 需添加**右上角折叠按钮** |
| 产出物 Preview | `~` | Review Panel (Git Diff) + File Tabs (代码查看) | OpenCode 右侧是**代码审查/Diff 视图**；V1 需要**替换为产物预览面板**（Markdown 渲染、HTML 预览、PDF/PPT 等） |
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
| `=` 可直接复用 | **14** | 35% |
| `~` 需改造 | **12** | 30% |
| `+` 需新增 | **14** | 35% |

---

## 三、改造方案

### 依赖关系与并行策略

> **核心原则：按实际依赖约束，无依赖即可并行。使用 `git worktree` 多分支同时开发。**

```
Phase 0  路由基座                        ← 唯一串行前置，阻塞所有后续
  │
  ├──→ Phase 1A  Sidebar v2              ┐
  ├──→ Phase 1B  Home v2                 │ UI 重构，互不依赖，4 条线完全并行
  ├──→ Phase 1C  Right Panel v2          │ 各自独立 worktree + 分支
  ├──→ Phase 1D  Settings + Profile      ┘
  │
  │    ┌──────────────────────────────────────────────────┐
  │    │  Phase 1 全部合入后进入 Phase 4                    │
  │    │  Phase 1 只做 UI 布局重构，不含全新业务功能           │
  │    └──────────────────────────────────────────────────┘
  │
  ├──→ Phase 4   全新功能（按优先级逐步实施，内部可并行）
  │    ├─ 定时任务              ← 依赖 1A（嵌入 Sidebar）
  │    ├─ MCP/Skills/Plugins    ← 依赖 1B（挂载于 + 菜单）
  │    ├─ 消息通道 / About / 帮助 ← 依赖 1D（从 Popover 入口触发）
  │    ├─ 任务收藏 / 浏览历史
  │    └─ 执行节点折叠行为
  │
  └──→ Phase 5   验收清理                ← 依赖所有 Phase 合并完成
```

### Git Worktree 使用策略

```bash
# Phase 0 完成合入 main 后，创建 4 条并行分支
git worktree add ../uw3-sidebar   feature/v2-sidebar      # Phase 1A
git worktree add ../uw3-home      feature/v2-home          # Phase 1B
git worktree add ../uw3-panel     feature/v2-right-panel   # Phase 1C
git worktree add ../uw3-settings  feature/v2-settings      # Phase 1D

# Phase 1 全部合入后，Phase 4 各功能按需创建分支（内部可并行）
git worktree add ../uw3-scheduled feature/v2-scheduled-tasks
git worktree add ../uw3-skills    feature/v2-skills-plugins
git worktree add ../uw3-channels  feature/v2-channels-about
```

---

### Phase 0：路由基座（唯一串行前置）

**目标**：建立 v1/v2 路由共存骨架。Phase 0 只做最小路由注册 + 占位组件，不含任何业务实现。

#### 0.1 路由双版本共存

| 改动 | 文件 | 说明 |
|------|------|------|
| v1 路由保留 | `app.tsx` | `/v1` → `layout.tsx` → `home.tsx`；`/v1/:dir/session/:id?` → `session.tsx` |
| v2 路由新建 | `app.tsx` | `/` → `layout_v2.tsx` → `home_v2.tsx`；`/task/:id` → `session_v2.tsx` |
| v2 骨架文件 | `layout_v2.tsx`, `home_v2.tsx`, `session_v2.tsx` | 最小占位实现（空壳），后续 Phase 填充内容 |
| e2e 路由前缀 | `e2e/*.test.ts` | 原有 e2e 改跑 `/v1` 前缀路由 |

#### Phase 0 完成门禁

- [ ] v1 回归 e2e：原有 e2e 全部改跑 `/v1` 前缀路由，100% 通过
- [ ] `e2e/v2/navigation.test.ts` — `/v1` 渲染原版布局，`/` 渲染 v2 骨架，两者互不干扰
- [ ] `pnpm build` 无报错

---

### Phase 1A：Sidebar 重构

**依赖**：Phase 0 ｜ **分支**：`feature/v2-sidebar` ｜ **可并行**：1B, 1C, 1D

| 改动 | 文件 | 说明 |
|------|------|------|
| 新建 Sidebar v2 | → `sidebar-shell_v2.tsx` | 单层可折叠 Sidebar（展开 ~210px / 折叠 ~48px），原 `sidebar-shell.tsx` 保留给 v1 路由 |
| Project/Workspace 不引用 | `sidebar-project.tsx`, `sidebar-workspace.tsx` | **保留原文件**，`layout_v2.tsx` 中不再 import |
| 新建 TaskList 组件 | → `sidebar-task-list.tsx`（新文件） | 扁平任务列表：最近任务区，running 置顶 |
| 新建 Top Bar | → `session-header_v2.tsx` | 左：Sidebar 折叠按钮 + 前进/后退；中：任务标题；右：Right Panel 折叠按钮 |
| 更新 layout_v2 | `layout_v2.tsx` | 组装 Sidebar v2 + Top Bar（替换占位） |

#### Phase 1A 完成门禁

- [ ] `e2e/v2/layout.test.ts` — 访问 `/` 渲染 v2 布局（Sidebar v2 + Top Bar）
- [ ] `e2e/v2/sidebar.test.ts` — Sidebar 折叠/展开切换正常；最近任务列表可见；新建任务按钮可点击
- [ ] v1 回归 e2e 通过 + `pnpm build` 无报错

---

### Phase 1B：Home 视图改造

**依赖**：Phase 0 ｜ **分支**：`feature/v2-home` ｜ **可并行**：1A, 1C, 1D

| 改动               | 文件                              | 说明                                                 |
| ---------------- | ------------------------------- | -------------------------------------------------- |
| 新建 Home v2       | → `home_v2.tsx`                 | 欢迎标题 + 能力卡片 + Composer（原 `home.tsx` **保留**给 v1 路由） |
| Composer 移至 Home | 从 Session 页提取                   | 在 Home v2 底部嵌入输入框 + 工作目录选择 + 模型选择 + "马上开始"         |
| 工作目录选择器          | → `workspace-selector.tsx`（新文件） | Popover 下拉，显示最近使用的目录列表                             |
| `+` 按钮菜单         | → `add-menu.tsx`（新文件）           | 仅实现文件附件上传（复用原有 Composer 附件能力）；MCP/Skills/Plugins 开关留到 Phase 2B |

#### Phase 1B 完成门禁

- [ ] `e2e/v2/home.test.ts` — `/` 渲染欢迎标题 + 三张能力卡片
- [ ] `e2e/v2/home-composer.test.ts` — 输入框可聚焦输入；工作目录选择器可打开；模型选择器可打开切换
- [ ] `e2e/v2/home-add-menu.test.ts` — `+` 按钮点击弹出菜单；文件附件上传可选择文件
- [ ] `e2e/v2/home-prompts.test.ts` — 点击能力卡片展开推荐 Prompt 列表；点击 Prompt 填入输入框
- [ ] v1 回归 e2e 通过 + `pnpm build` 无报错

---

### Phase 1C：Right Side Panel 改造

**依赖**：Phase 0 ｜ **分支**：`feature/v2-right-panel` ｜ **可并行**：1A, 1B, 1D

| 改动 | 文件 | 说明 |
|------|------|------|
| 新建 Side Panel v2 | → `session-side-panel_v2.tsx` | 可折叠多 Section 面板（原 `session-side-panel.tsx` **保留**给 v1 路由） |
| 新增 Section: 产物列表 | → `artifact-list.tsx`（新文件） | 产物文件列表，点击打开预览 |
| 产物预览区 | → `artifact-preview.tsx`（新文件） | 点击产物后 Chat Area 分屏，左侧对话 + 右侧预览 |
| 多格式预览器 | 含在 `artifact-preview.tsx` | Markdown 渲染 / HTML iframe / 代码高亮 / PDF 等 |
| 更新 session_v2 | `session_v2.tsx` | 引用 `session-side-panel_v2`，去掉 File Tabs / File Tree / Terminal |

#### Phase 1C 完成门禁

- [ ] `e2e/v2/side-panel.test.ts` — 右侧面板可见；折叠/展开按钮切换正常；产物列表 Section 可折叠
- [ ] `e2e/v2/artifact-preview.test.ts` — 点击产物项触发分屏预览；Markdown 文件渲染正确；关闭预览恢复全宽
- [ ] `e2e/v2/task-execution.test.ts` — 从 Home 输入 Prompt → 跳转 `/task/:id`；消息流展示；停止按钮可点击
- [ ] v1 回归 e2e 通过 + `pnpm build` 无报错

---

### Phase 1D：用户 Profile + Settings 改造

**依赖**：Phase 0 ｜ **分支**：`feature/v2-settings` ｜ **可并行**：1A, 1B, 1C

#### 1D.1 用户 Profile

| 改动 | 说明 |
|------|------|
| 新增 User Model | 本地存储：全称、昵称、头像、工作场景 |
| 左下角用户区 | Sidebar 底部显示头像 + 昵称 + 齿轮图标 |
| Settings Popover | 点击弹出快捷菜单（设置 / 语言切换 / 工作目录 / 模型 / 消息通道 / 帮助 / 关于） |

#### 1D.2 Settings 页面重组

| 改动 | 说明 |
|------|------|
| Tab 重组 | 原 Tabs: General / Keyboard Shortcuts / Providers / Models → 新 Tabs: **通用** / **隐私** / **能力配置** |
| 通用 Tab | 复用 Language / Appearance / Theme / Font + 新增 全称 / 昵称 / 工作场景 / 回复偏好 / 通知开关 |
| 隐私 Tab | 全新：数据保护声明 / 数据导入导出 / 会话共享开关 / 记忆偏好开关 / 清除数据 |
| 能力配置 Tab | 全新：记忆管理（生成/导入/导出） / 工具访问模式（自动/按需/始终可用） / 清除缓存 |
| Providers/Models | 从 Tab 移至 Settings Popover 的弹窗入口，复用现有 `dialog-settings.tsx` 中的 Providers/Models 逻辑 |

#### Phase 1D 完成门禁

- [ ] `e2e/v2/user-profile.test.ts` — Sidebar 底部显示用户头像+昵称；点击弹出 Settings Popover
- [ ] `e2e/v2/settings-popover.test.ts` — Popover 菜单项可见可点击；语言切换级联菜单正常；各弹窗可打开
- [ ] `e2e/v2/settings-general.test.ts` — 设置页 → 通用 Tab：全称/昵称可编辑保存；主题切换生效
- [ ] `e2e/v2/settings-privacy.test.ts` — 设置页 → 隐私 Tab：数据导入/导出按钮可点击；会话共享/记忆偏好开关切换
- [ ] `e2e/v2/settings-capabilities.test.ts` — 设置页 → 能力配置 Tab：工具访问模式三选一切换；记忆管理按钮可点击
- [ ] `e2e/v2/settings-model.test.ts` — 模型供应商弹窗可打开；Provider 列表可见；启用/禁用切换正常
- [ ] v1 回归 e2e 通过 + `pnpm build` 无报错

---

### Phase 4：全新功能

**依赖**：Phase 1 全部合入 main 后开始。各功能内部可并行，按优先级逐步实施。

> **强制约束：每个子功能完成后，必须有对应 e2e 通过才算 Done。**

#### 4.1 定时任务（P1，依赖 1A）

| 改动 | 说明 |
|------|------|
| 定时任务数据模型 | cron 表达式 / 调度引擎 |
| Sidebar 定时任务区 | → `sidebar-scheduled-tasks.tsx`，嵌入 `sidebar-shell_v2.tsx`，running 置顶 + 绿色指示 |
| 确认卡片 UI | Schedule / Cancel 交互 |

- [ ] `e2e/v2/scheduled-tasks.test.ts` — Sidebar 定时任务区可见；running 定时任务置顶显示绿色指示；任务确认卡片可交互

#### 4.2 MCP / Skills / Plugins 开关（P1，依赖 1B）

| 改动 | 说明 |
|------|------|
| `+` 菜单: MCP 开关 | `add-menu.tsx` 扩展，MCP 服务级联子菜单 + 启用/禁用开关 |
| `+` 菜单: Skills 开关 | Skills 列表/开关 UI + 加载机制（复用 MCP 模式） |
| `+` 菜单: Plugins 开关 | 同 Skills，独立命名空间 |

- [ ] `e2e/v2/add-menu-extensions.test.ts` — `+` 菜单 → MCP/Skills/Plugins 级联子菜单可展开；开关切换状态正确
- [ ] `e2e/v2/skills.test.ts` — 技能子菜单列表可见；开关切换状态持久化；管理入口可跳转
- [ ] `e2e/v2/plugins.test.ts` — 同 Skills 模式

#### 4.3 消息通道（P1，依赖 1D）

| 改动 | 说明 |
|------|------|
| 消息通道（钉钉） | → `dialog-channels.tsx`，Webhook 配置弹窗 + 通知发送服务 |

- [ ] `e2e/v2/channels.test.ts` — Settings Popover → 消息通道弹窗可打开；钉钉配置表单可填写保存；启用/禁用开关正常

#### 4.4 About / 帮助（P2，依赖 1D）

| 改动 | 说明 |
|------|------|
| About 弹窗 | → `dialog-about.tsx`，版本信息 + 更新检查 + 链接 |
| 帮助文档链接 | 一个外部链接 |

- [ ] `e2e/v2/about.test.ts` — Settings Popover → 关于我们弹窗显示版本号和链接

#### 4.5 任务收藏（P2）

| 改动 | 说明 |
|------|------|
| 任务收藏 | Session 增加 favorite 字段 + 星标 UI |

- [ ] `e2e/v2/favorites.test.ts` — 任务右键菜单 → 收藏；收藏后星标可见；再次点击取消收藏

#### 4.6 其他增强（P2）

| 改动 | 说明 |
|------|------|
| 浏览历史前进/后退 | 维护 history stack，Top Bar 按钮 |
| 执行节点折叠行为 | 消息渲染中增加折叠/展开状态管理 |

#### Phase 4 整体门禁

- [ ] v1 回归 e2e 始终 100% 通过
- [ ] `pnpm build` 无报错

---

### Phase 5：验收清理

**依赖**：Phase 1 + Phase 4 全部合入 main

| 改动 | 说明 |
|------|------|
| 删除 `/v1` 路由分支 | `app.tsx` 中移除 v1 路由 |
| 删除原版文件（或归档） | 不再需要的 v1 组件 |
| v2 文件重命名 | 去掉 `_v2` 后缀 |
| e2e 清理 | 删除 `/v1` 前缀测试，v2 测试改为默认路由 |

#### Phase 5 完成门禁

- [ ] 所有 v2 e2e 通过（路由前缀去掉后仍正常）
- [ ] `pnpm build` 无报错
- [ ] 无残留 `_v2` 后缀文件或 `/v1` 路由引用

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
| → `src/pages/home_v2.tsx` | **新建 v2** | 1B | 欢迎页 + 能力卡片 + Composer |
| `src/pages/session/session-header.tsx` | **保留** | — | 原文件不动 |
| → `src/pages/session/session-header_v2.tsx` | **新建 v2** | 1A | Top Bar（折叠+导航+标题） |
| `src/pages/session/session-side-panel.tsx` | **保留** | — | 原文件不动 |
| → `src/pages/session/session-side-panel_v2.tsx` | **新建 v2** | 1C | 产物预览面板（替代 Review/Diff） |
| `src/components/dialog-settings.tsx` | **保留** | — | 原文件不动 |
| → `src/components/dialog-settings_v2.tsx` | **新建 v2** | 1D | Tab 重组：通用/隐私/能力配置 |
| `src/components/prompt-input.tsx` | **保留** | — | 原文件不动 |
| → `src/components/prompt-input_v2.tsx` | **新建 v2** | 1B | 增加 `+` 菜单、工作目录选择器 |
| **原文件保留，仅在引用处解除** | | | |
| `src/pages/layout/sidebar-project.tsx` | **保留，解除引用** | 1A | 在 `layout_v2.tsx` 中不再 import |
| `src/pages/layout/sidebar-workspace.tsx` | **保留，解除引用** | 1A | 在 `layout_v2.tsx` 中不再 import |
| `src/pages/session/file-tabs.tsx` | **保留，解除引用** | 1C | 在 `session-side-panel_v2.tsx` 中不再 import |
| `src/pages/session/terminal-panel.tsx` | **保留，解除引用** | 1C | 在 `session_v2.tsx` 中不再 import |
| `src/components/file-tree.tsx` | **保留，解除引用** | 1C | 在 `session-side-panel_v2.tsx` 中不再 import |
| **路由/父组件切换引用** | | | |
| `src/pages/layout.tsx` | **保留** | — | 原文件不动 |
| → `src/pages/layout_v2.tsx` | **新建 v2** | 0+1A | Phase 0 占位，Phase 1A 填充 |
| `src/pages/session.tsx` | **保留** | — | 原文件不动 |
| → `src/pages/session_v2.tsx` | **新建 v2** | 0+1C | Phase 0 占位，Phase 1C 填充 |
| `src/app.tsx` | **改造** | 0 | 注册双版本路由：`/v1/*` → 原组件，`/` → v2 组件 |
| **e2e 测试** | | | |
| `e2e/*.test.ts`（现有） | **微调** | 0 | baseURL 或路由前缀改为 `/v1`，确保原有测试全部通过 |
| `e2e/v2/*.test.ts`（新增） | **新增** | 各 Phase | v2 版本的 e2e 测试，跑 `/` 路由 |
| **微调复用（直接改原文件）** | | | |
| `src/pages/layout/sidebar-items.tsx` | **微调** | 4.5 | 增加 favorite 字段 + 星标 UI |
| **全新文件** | | | |
| `src/pages/layout/sidebar-task-list.tsx` | 新增 | 1A | 扁平任务列表组件 |
| `src/pages/layout/sidebar-scheduled-tasks.tsx` | 新增 | 4.1 | 定时任务列表组件 |
| `src/pages/layout/sidebar-user-profile.tsx` | 新增 | 1D | 底部用户头像 + Popover |
| `src/components/settings-popover.tsx` | 新增 | 1D | 快捷设置菜单 |
| `src/components/artifact-preview.tsx` | 新增 | 1C | 多格式产物预览器 |
| `src/components/artifact-list.tsx` | 新增 | 1C | 产物列表面板 |
| `src/components/add-menu.tsx` | 新增 | 1B | `+` 按钮菜单（MCP/Skills/Plugins） |
| `src/components/workspace-selector.tsx` | 新增 | 1B | 工作目录下拉选择器 |
| `src/components/dialog-channels.tsx` | 新增 | 4.3 | 消息通道配置弹窗 |
| `src/components/dialog-about.tsx` | 新增 | 4.4 | 关于我们弹窗 |
| `src/components/settings-general.tsx` | 新增 | 1D | 通用设置（个人资料+通知） |
| `src/components/settings-privacy.tsx` | 新增 | 1D | 隐私设置 |
| `src/components/settings-capabilities.tsx` | 新增 | 1D | 能力配置设置 |
