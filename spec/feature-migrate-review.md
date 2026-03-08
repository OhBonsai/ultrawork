# feature-migrate.md 技术评审

> 评审基于对 `feature-migrate.md` 方案与实际代码库（`packages/app/src/`、`e2e/`）的交叉比对。

---

## P0 — 阻塞性问题（必须修复）

### 1. 框架错配：代码库是 Solid.js，不是 React

方案上下文（来自先前讨论）提到"React 19 + Radix UI"，但实际代码库使用的是 **SolidJS**（`@solidjs/router`、`solid-js/store`、`createSignal`、`createContext`）。这直接影响：

- 所有组件文件是 Solid 组件（JSX with `createSignal`/`createStore`），不是 React 组件
- 状态管理用的是 `solid-js/store` + Context，不是 Zustand/Redux
- UI 库是 Solid 生态（`@kobalte/core` 等），不是 Radix UI
- 路由是 `@solidjs/router`，不是 `react-router`

**建议**：方案第 7 条"UI 一致性"中修正技术栈描述，明确为 `@kobalte/core`（Solid 版 Radix）+ Tailwind CSS 4。所有新增 `_v2.tsx` 文件必须是 Solid 组件。

### 2. 路由结构映射缺失目录上下文

当前路由：`/:dir/session/:id?`，其中 `:dir` 是 base64 编码的项目目录路径。这个目录上下文是整个 SDK 交互的基础（`createChildStoreManager(directory)`）。

方案提出的 v2 路由：
```
/                → home_v2.tsx
/task/:id        → session_v2.tsx
```

**问题**：`/task/:id` 丢失了 `:dir` 上下文。没有目录信息，SDK 无法知道连接哪个后端项目、加载哪个工作区的 session 数据。

**建议**：
- 方案 A：保留目录上下文 → `/task/:dir/:id`
- 方案 B：在 Home 页选择工作目录后写入全局 state，`/task/:id` 从 state 读取当前目录
- 方案 C：URL 中用 query param → `/task/:id?dir=xxx`

无论选哪种，必须在方案中明确 v2 路由如何获取目录上下文，否则 Phase 0 骨架无法与后端 SDK 对接。

### 3. "扁平任务列表"与 SDK 数据模型的冲突

当前 SDK 数据模型是 `Project → Session`，全局状态结构（`global-sync/types.ts`）中 session 列表按 directory 组织：

```typescript
type State = {
  project: string              // 当前项目目录
  session: Session[]           // 当前目录下的 session 列表
  // ... 所有 session 相关数据都通过 directory 隔离
}
```

方案要求"扁平化为单层任务列表，去掉 Project/Workspace 层级"。但 SDK 的 `session.list()` 是 **per-directory** 的——没有"全局查询所有目录的 session"的 API。

**建议**：
- 评估 SDK 是否支持跨目录 session 查询，若不支持需在前端聚合多目录数据
- 或明确 V1 的"扁平任务列表"实际是**单目录内的 session 列表**（功能缩减），在方案中注明
- 方案需增加一节说明 SDK 层面的适配需求

---

## P1 — 高风险问题（强烈建议修复）

### 4. Phase 1 四分支并行的合并冲突风险

Phase 0 创建 `layout_v2.tsx`（空壳），然后 4 个分支各自修改它：

- **1A**：往 `layout_v2.tsx` 填充 Sidebar v2 + Top Bar
- **1B**：可能需要 `layout_v2.tsx` 中预留 Home 内容区
- **1C**：需要 `session_v2.tsx` 中集成 Right Panel
- **1D**：需要在 `layout_v2.tsx` 中加入 Sidebar 底部用户区

4 个分支都会修改 `layout_v2.tsx` 和/或 `session_v2.tsx`，合并时必然冲突。

**建议**：
- Phase 0 的"占位"应更详细——定义好 `layout_v2.tsx` 的 **slot 结构**（如 `<SidebarSlot />`、`<ContentSlot />`、`<PanelSlot />`），每个 Phase 1 分支只填充自己的 slot
- 或指定 1A 为 layout 的 owner（先合入），其余分支基于 1A 合入后的 main 来 rebase
- 在方案中增加"合并顺序建议"章节

### 5. Phase 1D 范围过大，混合了 UI 重构与新数据模型

Phase 1D 包含：
- User Model（全新数据模型：全称、昵称、头像、工作场景 → 需要持久化方案）
- Settings Popover（UI 组件）
- Settings 三 Tab 重组（通用/隐私/能力配置 → 其中隐私和能力配置是**全新业务功能**）

按照"Phase 1 只做 UI 布局重构，不含全新业务功能"的原则，隐私 Tab（数据导入导出、会话共享）和能力配置 Tab（记忆管理、工具访问模式）应该属于 Phase 4。

**建议**：
- Phase 1D 缩减为：User Model 基础字段 + Settings Popover 壳 + 通用 Tab（复用已有设置项）
- 隐私 Tab、能力配置 Tab 的**业务逻辑**移至 Phase 4
- Phase 1D 的 Settings 页面可以先放空的 Tab 占位

### 6. Artifact 预览缺乏数据模型支撑

Phase 1C 的"产物预览"是核心交互改造，但当前 SDK 中没有 Artifact 概念。现有数据模型只有：
- `Message` + `Part`（消息内容）
- `FileDiff`（文件变更）
- `Todo`（任务列表）

方案没有说明：
- 产物从哪里来？是从 `Part` 中提取文件路径？还是新增 SDK 类型？
- 产物列表的数据结构是什么？
- "过程产物 vs 最终产物"如何区分？

**建议**：在 Phase 1C 中增加"Artifact 数据模型设计"小节，明确：
- Artifact 的数据源（从 `Part` 的 tool call 结果中提取？从文件系统监听？）
- 前端 store 结构（`createStore<ArtifactStore>`）
- 是否需要 SDK 层面的适配

### 7. e2e 测试 fixtures 需要适配

现有 e2e 测试的 fixtures 深度依赖当前路由结构：

```typescript
// fixtures.ts
gotoSession(sessionID?) → navigates to /:dir/session/:id
withProject(callback) → creates temp project with directory context
sessionPath(directory, sessionID) → builds /:dir/session/:id URL
dirSlug(directory) → base64 encodes directory
```

Phase 0 "原有 e2e 改跑 `/v1` 前缀路由"不只是在 URL 前加 `/v1`，还需要修改：
- `fixtures.ts` 中的 `sessionPath()` 和 `gotoSession()`
- 所有使用 `page.goto()` 的测试
- `selectors.ts` 中可能依赖路由状态的选择器

**建议**：Phase 0 门禁中增加一条：
- [ ] `e2e/fixtures.ts` 中的路由辅助函数已适配 `/v1` 前缀，提交 PR review

---

## P2 — 中风险问题（建议修复）

### 8. 状态管理的 v1/v2 共享边界未定义

方案提到"共享一切底层（hooks / SDK / state / utils），只换 UI 壳"。但 Solid.js 的 Context Provider 是树状嵌套的，当前 `app.tsx` 中 Provider 层级为：

```
AppBaseProviders → AppInterface → RouterRoot → SessionProviders
```

v1 和 v2 路由需要共享 `AppInterface`（SDK 连接）和 `RouterRoot`（Settings、Models 等），但可能需要不同的 Layout Provider。

**建议**：方案中增加 Provider 层级示意，说明哪些 Provider 在 v1/v2 路由之上（共享），哪些在各自路由内部（独立）。

### 9. Phase 1B `home_v2.tsx` 中的 Composer 提取复杂度被低估

方案说"Composer 移至 Home：从 Session 页提取"。但当前 Composer（`prompt-input.tsx`）深度耦合于 Session 上下文：
- 依赖 `usePrompt()` context（PromptStore）
- 依赖 `useSync()` context（当前 session 的消息列表）
- 依赖 `useTerminal()` context（命令执行）
- 依赖 `useFile()` context（文件附件）

在 Home 页没有 session 上下文时，Composer 无法直接复用。需要：
- 创建一个"无 session"模式的 Composer 变体
- 或在用户提交时先创建 session，再注入上下文

**建议**：Phase 1B 中增加说明：Home Composer 的工作模式（提交后创建 session 并跳转），以及需要解耦哪些 context 依赖。

### 10. `_v2` 文件命名在 Phase 5 的批量重命名成本

Phase 5 要求"v2 文件重命名去掉 `_v2` 后缀"。这意味着：
- 所有 import 路径都要改（`sidebar-shell_v2` → `sidebar-shell`）
- 所有 e2e 测试中如果引用了组件 data-testid 包含 `v2`，也要改
- git blame 历史会断裂

方案中有 13 个 `_v2` 文件，每个文件被多处 import。

**建议**：
- 考虑在 Phase 5 使用自动化脚本批量重命名（`sed` + `git mv`）
- 或在 Phase 0 就约定 v2 组件的 export name 不含 `v2`（如 `export function SidebarShell()`），只在文件名上区分，减少 Phase 5 的改动面

---

## P3 — 低风险 / 建议优化

### 11. 功能映射表中的标记可能偏乐观

部分标记为 `=`（可直接复用）的项实际可能需要较大改动：

| 功能 | 标记 | 实际复杂度 |
|------|------|-----------|
| 模型切换 `=` | `DialogSelectModel` 当前在 Settings 中，移至 Composer 需要解耦 Provider 依赖 | 可能应为 `~` |
| 文件/图片上传 `=` | 当前上传绑定于 Session 的 Prompt context，Home 页无 session 时需适配 | 可能应为 `~` |
| 停止执行 `=` | Cancel 逻辑绑定于 session 状态管理，Composer 独立使用时需适配 | 应为 `=` 但需前提条件 |

**建议**：对 `=` 标记项做二次校验，确认在 v2 上下文中是否真的"零改动复用"。

### 12. Phase 编号跳跃

当前编号为 Phase 0 → 1A/1B/1C/1D → 4 → 5。缺少 Phase 2 和 3，阅读时可能产生困惑。

**建议**：改为 Phase 0 → 1A-1D → 2 → 3，或在方案中说明编号跳跃的原因。

### 13. 缺少性能和包体积考量

v1/v2 双版本共存期间，打包产物会包含两套组件。对于 Tauri 桌面应用影响较小，但建议：
- v1 路由使用 lazy import（`lazy(() => import(...))`）
- v2 路由也使用 lazy import
- Phase 5 清理后验证包体积回落

### 14. 缺少错误处理和降级策略

方案未提及：
- v2 路由出错时的 fallback（是否跳回 v1？）
- Phase 1 部分合入但未全部完成时，v2 的不完整状态如何处理
- SDK 连接失败时 v2 的表现

**建议**：Phase 0 中增加 v2 路由的 ErrorBoundary，出错时显示"开发中"提示或跳转 `/v1`。

### 15. 国际化（i18n）改造未提及

当前代码库使用 `@solid-primitives/i18n`，所有文案通过 `t()` 函数翻译。方案中大量提到中文文案（"新建任务"、"马上开始"等），但未说明：
- 新增文案是否需要同时维护中英文
- 现有 i18n key 结构是否需要调整

**建议**：在代码改造原则中增加一条：新增文案必须通过 `t()` 函数国际化，不得硬编码。

---

## 评审总结

| 级别 | 数量 | 核心关注 |
|------|------|---------|
| **P0 阻塞** | 3 | 框架错配、路由目录上下文、SDK 数据模型 |
| **P1 高风险** | 4 | 合并冲突、Phase 1D 范围、Artifact 模型、e2e fixtures |
| **P2 中风险** | 3 | Provider 共享、Composer 解耦、重命名成本 |
| **P3 建议** | 5 | 标记校验、编号、性能、错误处理、i18n |

**总体评价**：方案的架构方向（路由双版本共存 + `_v2` 文件 + git worktree 并行）是合理的，Phase 分层和 e2e 门禁设计清晰。主要风险集中在**方案与实际代码库的技术细节对齐**上——特别是框架（Solid vs React）、路由参数（目录上下文）、SDK 数据模型（per-directory session）这三个基础假设需要先行修正，否则 Phase 0 落地时会遇到根本性阻塞。
