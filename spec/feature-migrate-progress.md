# UltraWork V1 迁移进度追踪

> 对应方案文档：[feature-migrate-v2.md](./feature-migrate-v2.md)
>
> 更新时间：2026-03-08

---

## 总览

| Phase   | 名称                        | 状态     | 分支                       |
| ------- | ------------------------- | ------ | ------------------------ |
| **0**   | 路由基座 + Slot 骨架            | 🟡 进行中 | `feat/migrate_phase0`    |
| **1A**  | Sidebar 重构                | ⬜ 未开始  | `feature/v2-sidebar`     |
| **1B**  | Home 视图改造                 | ⬜ 未开始  | `feature/v2-home`        |
| **1C**  | Right Side Panel 改造       | ⬜ 未开始  | `feature/v2-right-panel` |
| **1D**  | 用户 Profile + Settings 壳   | ⬜ 未开始  | `feature/v2-settings`    |
| **2.1** | 定时任务                      | ⬜ 未开始  | —                        |
| **2.2** | MCP / Skills / Plugins 开关 | ⬜ 未开始  | —                        |
| **2.3** | 消息通道（钉钉）                  | ⬜ 未开始  | —                        |
| **2.4** | 隐私 / 能力配置 Tab             | ⬜ 未开始  | —                        |
| **2.5** | About / 帮助                | ⬜ 未开始  | —                        |
| **2.6** | 任务收藏                      | ⬜ 未开始  | —                        |
| **2.7** | 浏览历史 / 执行节点折叠             | ⬜ 未开始  | —                        |
| **3**   | 验收清理                      | ⬜ 未开始  | —                        |

状态图例：⬜ 未开始 ｜ 🟡 进行中 ｜ ✅ 完成 ｜ ❌ 阻塞

---

## Phase 0：路由基座 + Slot 骨架

**分支**：`feat/migrate_phase0` ｜ **状态**：🟡 进行中

### 0.1 路由双版本共存

| 改动 | 文件 | 状态 |
|------|------|------|
| v1 路由移至 `/v1` 前缀 | `app.tsx` | ✅ |
| v2 路由注册 `/` + `/task/:dir/:id` | `app.tsx` | ✅ |
| v2 Layout 骨架（5 个 Slot 占位） | `layout_v2.tsx` | ✅ |
| v2 Home 占位 | `home_v2.tsx` | ✅ |
| v2 Session 占位 | `session_v2.tsx` | ✅ |
| ErrorBoundary + 降级链接 | `layout_v2.tsx` | ✅ |
| v1/v2 lazy import | `app.tsx` | ✅ |
| 路由前缀 Context | `context/route-prefix.tsx` | ✅ |
| v1 组件硬编码路径适配 `/v1` 前缀 | `layout.tsx` + 12 个组件 | ✅ |
| e2e `sessionPath` / `dirPath` 适配 | `e2e/utils.ts` | ✅ |
| e2e `home.spec.ts` 适配 `/v1` | `e2e/app/home.spec.ts` | ✅ |
| v2 导航 e2e 测试 | `e2e/v2/navigation.spec.ts` | ✅ |

### 完成门禁

- [x] v1 回归 e2e：原有 e2e 全部改跑 `/v1` 前缀路由，100% 通过
- [x] `e2e/fixtures.ts` 中路由辅助函数已适配 `/v1` 前缀
- [x] `e2e/v2/navigation.spec.ts` — v1/v2 路由互不干扰
- [x] `layout_v2.tsx` ErrorBoundary 生效
- [x] typecheck 无报错（`bun run typecheck` ✅ 已通过，待 CI 确认）
- [x] 人工验证：v1 页面导航、v2 骨架展示

### 待完成项

- 人工验证 v1 全部导航路径带 `/v1` 前缀
- 运行完整 e2e 回归（`bun run test:e2e`）
- 提交 & 推送

---

## Phase 1A：Sidebar 重构

**分支**：`feature/v2-sidebar` ｜ **依赖**：Phase 0 ｜ **状态**：⬜ 未开始

### 改动清单

| 改动 | 文件 | 状态 |
|------|------|------|
| 新建 Sidebar v2（单层可折叠） | `sidebar-shell_v2.tsx` | ⬜ |
| 新建 TaskList 组件（扁平列表 + running 置顶） | `sidebar-task-list.tsx` | ⬜ |
| 新建 Top Bar | `session-header_v2.tsx` | ⬜ |
| 填充 layout_v2 Sidebar + TopBar slot | `layout_v2.tsx` | ⬜ |

### 完成门禁

- [ ] `e2e/v2/layout.test.ts` — v2 布局渲染 Sidebar + Top Bar
- [ ] `e2e/v2/sidebar.test.ts` — 折叠/展开、任务列表、新建按钮
- [ ] v1 回归 e2e 通过 + typecheck 无报错

---

## Phase 1B：Home 视图改造

**分支**：`feature/v2-home` ｜ **依赖**：Phase 0 ｜ **状态**：⬜ 未开始

### 改动清单

| 改动 | 文件 | 状态 |
|------|------|------|
| Home v2（欢迎 + 能力卡片 + 轻量 Composer） | `home_v2.tsx` | ⬜ |
| 工作目录选择器 | `workspace-selector.tsx` | ⬜ |
| `+` 按钮菜单（文件附件） | `add-menu.tsx` | ⬜ |

### 完成门禁

- [ ] `e2e/v2/home.test.ts` — 欢迎标题 + 能力卡片
- [ ] `e2e/v2/home-composer.test.ts` — 输入框、目录选择器、模型选择器
- [ ] `e2e/v2/home-add-menu.test.ts` — `+` 按钮菜单
- [ ] `e2e/v2/home-prompts.test.ts` — 能力卡片推荐 Prompt
- [ ] v1 回归 e2e 通过 + typecheck 无报错

---

## Phase 1C：Right Side Panel 改造

**分支**：`feature/v2-right-panel` ｜ **依赖**：Phase 0 ｜ **状态**：⬜ 未开始

### 改动清单

| 改动 | 文件 | 状态 |
|------|------|------|
| Side Panel v2（可折叠多 Section） | `session-side-panel_v2.tsx` | ⬜ |
| 产物列表 Section | `artifact-list.tsx` | ⬜ |
| 产物预览区 + 多格式预览器 | `artifact-preview.tsx` | ⬜ |
| Artifact Store | `context/artifact.ts` | ⬜ |
| 更新 session_v2 引用 | `session_v2.tsx` | ⬜ |

### 完成门禁

- [ ] `e2e/v2/side-panel.test.ts` — 面板折叠/展开、产物列表
- [ ] `e2e/v2/artifact-preview.test.ts` — 分屏预览、Markdown 渲染
- [ ] `e2e/v2/task-execution.test.ts` — Home → Task 跳转、消息流
- [ ] v1 回归 e2e 通过 + typecheck 无报错

---

## Phase 1D：用户 Profile + Settings 壳

**分支**：`feature/v2-settings` ｜ **依赖**：Phase 0 ｜ **状态**：⬜ 未开始

### 改动清单

| 改动 | 文件 | 状态 |
|------|------|------|
| User Model（本地存储） | — | ⬜ |
| 左下角用户区 | `sidebar-user-profile.tsx` | ⬜ |
| Settings Popover | `settings-popover.tsx` | ⬜ |
| Settings Tab 重组（通用 / 隐私占位 / 能力配置占位） | `dialog-settings_v2.tsx` | ⬜ |
| 通用设置（个人资料 + 通知） | `settings-general.tsx` | ⬜ |
| 隐私 / 能力配置占位 UI | `settings-privacy.tsx`, `settings-capabilities.tsx` | ⬜ |

### 完成门禁

- [ ] `e2e/v2/user-profile.test.ts` — 头像+昵称、Settings Popover
- [ ] `e2e/v2/settings-popover.test.ts` — 菜单项、语言切换
- [ ] `e2e/v2/settings-general.test.ts` — 全称/昵称编辑、主题切换
- [ ] `e2e/v2/settings-model.test.ts` — 模型供应商弹窗
- [ ] v1 回归 e2e 通过 + typecheck 无报错

---

## Phase 2：全新功能

**依赖**：Phase 1 全部合入 ｜ **状态**：⬜ 未开始

| # | 功能 | 优先级 | 依赖 | 状态 |
|---|------|--------|------|------|
| 2.1 | 定时任务 | P1 | 1A | ⬜ |
| 2.2 | MCP / Skills / Plugins 开关 | P1 | 1B | ⬜ |
| 2.3 | 消息通道（钉钉） | P1 | 1D | ⬜ |
| 2.4 | 隐私 / 能力配置 Tab 业务逻辑 | P1 | 1D | ⬜ |
| 2.5 | About / 帮助 | P2 | 1D | ⬜ |
| 2.6 | 任务收藏 | P2 | — | ⬜ |
| 2.7 | 浏览历史 / 执行节点折叠 | P2 | — | ⬜ |

---

## Phase 3：验收清理

**依赖**：Phase 1 + Phase 2 全部合入 ｜ **状态**：⬜ 未开始

| 改动 | 状态 |
|------|------|
| 删除 `/v1` 路由分支 | ⬜ |
| 删除/归档原版 v1 组件文件 | ⬜ |
| `_v2.tsx` → `.tsx` 批量重命名 | ⬜ |
| e2e 清理（删除 v1 前缀测试） | ⬜ |
| 包体积验证 | ⬜ |

---

## 变更日志

| 日期 | 变更 |
|------|------|
| 2026-03-08 | Phase 0 代码实现完成（路由双版本、v2 骨架、route-prefix、e2e 适配），待人工验证和 e2e 回归 |
