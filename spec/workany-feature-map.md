# WorkAny 功能布局分析报告

## 项目概述

**WorkAny** 是一个桌面 AI Agent 应用，通过自然语言驱动任务执行。核心能力包括：代码生成、工具调用沙箱执行、多 AI Provider 支持、实时流式输出。

- **技术栈**：React 19 + TypeScript + Vite + Tailwind CSS 4（前端）、Hono + Claude Agent SDK（后端 API）、Tauri 2 + Rust（桌面壳）
- **存储**：SQLite（Tauri 桌面）/ IndexedDB（Web）
- **数据目录**：`~/.workany/`

---

## 路由结构

```
/                      → Home 页面（欢迎页 + 任务创建）
/setup                 → Setup 页面（依赖检查 + 安装引导）
/task/:taskId          → Task Detail 页面（Agent 执行 + 产物预览）
/library               → Library 页面（历史任务 + 文件浏览）
```

---

## 布局层级

```
App Root
├── Setup (setup.tsx)              ← 路由 /setup（首次启动）
├── Home (Home.tsx)                ← 路由 /
│   ├── Left Sidebar              ← 任务历史列表
│   └── Main Content              ← 欢迎区 + 分类入口 + Prompt 输入
├── Task Detail (TaskDetail.tsx)   ← 路由 /task/:taskId
│   ├── Left Sidebar              ← 任务历史列表
│   ├── Main Content              ← 消息流 + 产物预览
│   └── Right Sidebar             ← 任务信息 + 文件列表
└── Library (Library.tsx)          ← 路由 /library
    ├── Left Sidebar              ← 任务搜索 + 列表
    └── Main Content              ← 文件网格
```

---

## 一、Setup 页面 (`Setup.tsx`)

路由：`/setup`

| 功能 | 说明 |
|------|------|
| 依赖检测 | 检查 Claude Code（必需）、Codex（可选）是否安装 |
| 安装引导 | 显示平台特定的安装命令，支持一键复制/执行 |
| 版本检测 | 检测已安装工具的版本号 |
| 可展开安装指南 | 详细安装步骤说明 |
| 重试机制 | 安装后重新检测 API 连接 |
| 跳过选项 | 可选工具缺失时允许跳过 |

---

## 二、Home 页面 (`Home.tsx`)

路由：`/`

### 功能清单

| 功能 | 说明 |
|------|------|
| 欢迎标题 | 带 CTA 的引导文案 |
| 分类按钮 | Organize Files / Generate Docs / Automate Tasks 三大类 |
| 示例 Prompt | 每个分类下的预设任务示例 |
| 任务输入框 | 自然语言输入，支持多模式（chat / plan+execute） |
| 左侧任务历史 | 最近任务列表，含收藏标记 |

### 左侧 Sidebar

| 功能 | 说明 |
|------|------|
| 任务历史列表 | 按时间倒序排列 |
| 收藏筛选 | 快速访问收藏任务 |
| 任务导航 | 点击跳转到 Task Detail |

---

## 三、Task Detail 页面 (`TaskDetail.tsx`)

路由：`/task/:taskId`

### 整体布局

```
┌──────────────────────────────────────────────────────────┐
│  Left Sidebar  │  Main Content Area  │  Right Sidebar    │
│  (任务历史)     │                     │  (任务信息/文件)   │
│                │  ┌───────────────┐  │                   │
│  任务列表       │  │ Agent Messages│  │  Task Info        │
│  搜索/收藏      │  │ (消息流)      │  │  Files List       │
│                │  └───────────────┘  │                   │
│                │  ┌───────────────┐  │                   │
│                │  │ Artifact      │  │                   │
│                │  │ Preview       │  │                   │
│                │  │ (产物预览)    │  │                   │
│                │  └───────────────┘  │                   │
│                │  ┌───────────────┐  │                   │
│                │  │ Composer      │  │                   │
│                │  │ (输入区域)    │  │                   │
│                │  └───────────────┘  │                   │
└──────────────────────────────────────────────────────────┘
```

### 功能模块详细清单

#### 3.1 Agent 消息流

| 功能 | 说明 |
|------|------|
| 实时流式输出 | SSE (Server-Sent Events) 增量消息传递 |
| 消息类型区分 | text / tool_use / tool_result / result / error / user / plan |
| 工具调用反馈 | 实时显示工具执行过程和结果 |
| Markdown 渲染 | 支持代码块、表格等格式 |
| 代码语法高亮 | 带行号的代码展示 |

#### 3.2 两阶段执行流程

| 阶段 | 说明 |
|------|------|
| Planning 阶段 | Agent 生成详细任务计划 |
| 用户审批 | Plan Approval Modal —— 用户审查并确认计划 |
| Execution 阶段 | Agent 按计划逐步执行，调用工具完成任务 |
| 直接执行模式 | 跳过 Planning，直接执行（可配置） |

#### 3.3 产物预览系统 (Artifact Preview)

| 格式 | 预览方式 |
|------|----------|
| HTML / React | 实时 iframe 预览 + Vite 热更新 |
| 代码文件 | 语法高亮 + 行号 |
| 图片 | 懒加载 + 缩放 |
| PDF | 内嵌查看器 |
| Office 文档 | DOCX / XLSX / PPTX 格式转换查看 |
| 视频 / 音频 | 原生媒体播放器 |
| 字体文件 | 字体预览 |
| Web 搜索结果 | 富卡片展示 |

#### 3.4 Composer 输入区域

| 功能 | 说明 |
|------|------|
| 自然语言输入 | 文本输入框 |
| 多轮对话 | 在同一 Session 中持续交互 |
| 上下文保持 | 跨多轮保持对话上下文 |

#### 3.5 右侧信息面板

| 功能 | 说明 |
|------|------|
| 任务信息 | 状态、耗时、成本等 |
| 文件列表 | 任务关联的产出文件 |
| 文件操作 | 预览、下载 |

---

## 四、Library 页面 (`Library.tsx`)

路由：`/library`

| 功能 | 说明 |
|------|------|
| 搜索过滤 | 按任务名搜索 |
| 任务列表 | Prompt 文本（截断）+ 更新时间（相对） |
| 收藏切换 | 标记/取消收藏 |
| 批量选择 | Select Mode 批量操作 |
| 空状态引导 | 无任务时的引导页面 |
| 文件分类 | image / text / code / document / website / presentation / spreadsheet |

---

## 五、全局共享组件

### 5.1 Settings Modal（多 Tab 设置）

| Tab | 功能 |
|-----|------|
| General | 语言（zh-CN / en-US）、主题、外观 |
| Account | 用户配置文件、工作区设置 |
| Model | AI Provider 配置、API Key 管理、默认模型选择 |
| Workplace | 任务工作区、文件组织 |
| MCP | MCP 服务器配置管理 |
| Skills | 技能发现与管理 |
| Data | 数据库操作、导入/导出 |
| About | 版本号、链接、致谢 |

### 5.2 多 Provider 支持

| Provider | 说明 |
|----------|------|
| Anthropic (Claude) | 默认 Provider |
| OpenAI | GPT 系列模型 |
| OpenRouter | 多模型代理 |
| 自定义端点 | 用户配置的 API 端点 |

### 5.3 MCP 支持

| 功能 | 说明 |
|------|------|
| MCP 服务器加载 | 从 `~/.claude/settings.json` 和 `~/.workany/mcp.json` 加载 |
| 动态管理 | API 接口管理 MCP 服务器配置 |
| 能力扩展 | 通过 MCP 协议扩展 Agent 工具集 |

### 5.4 Skills 支持

| 功能 | 说明 |
|------|------|
| 技能加载 | 从 `~/.claude/skills/` 和 `~/.workany/skills/` 加载 |
| 自定义工具 | 扩展 Agent 的能力范围 |

---

## 六、后端 API 结构 (`src-api/`)

### API 端点一览

#### 健康检查 & 依赖

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 服务器健康状态 |
| `/health/dependencies` | GET | 检测已安装 CLI 工具 |
| `/health/dependencies/:id/install-commands` | GET | 获取安装指令 |

#### Agent 执行

| 端点 | 方法 | 说明 |
|------|------|------|
| `/agent/chat` | POST | 轻量对话（无工具调用） |
| `/agent/plan` | POST | Planning 阶段（生成计划） |
| `/agent/execute` | POST | 执行计划（带工具调用） |
| `/agent/session` | POST | 创建/管理 Session |

#### 沙箱执行

| 端点 | 方法 | 说明 |
|------|------|------|
| `/sandbox/execute` | POST | 在沙箱中执行脚本 |
| `/sandbox/pool` | POST | 管理沙箱池 |
| `/sandbox/available` | GET | 检查可用沙箱 Provider |

#### 预览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/preview/start` | POST | 启动 Vite 预览服务器 |
| `/preview/status/:taskId` | GET | 获取预览状态 |
| `/preview/stop/:taskId` | POST | 停止预览服务器 |

#### Provider 管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/providers/sandbox` | GET | 列出沙箱 Providers |
| `/providers/agent` | GET | 列出 Agent Providers |
| `/providers/switch` | POST | 切换活跃 Provider |
| `/providers/detect` | GET | 检测可用 Providers |

#### 文件操作

| 端点 | 方法 | 说明 |
|------|------|------|
| `/files/skills` | GET | 列出可用 Skills |
| `/files/browse/:path` | GET | 浏览目录 |
| `/files/tree/:path` | GET | 获取文件树 |
| `/files/create` | POST | 创建文件 |

#### MCP 管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/mcp/config` | GET | 读取 MCP 配置 |
| `/mcp/config` | POST | 更新 MCP 配置 |
| `/mcp/servers` | GET | 列出活跃 MCP 服务器 |

---

## 七、数据模型

### Sessions

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 格式：`YYYYMMDDHHmmss_slug` |
| prompt | string | 原始任务描述 |
| task_count | number | Session 内任务数 |
| created_at | string | 创建时间 (ISO) |
| updated_at | string | 更新时间 (ISO) |

### Tasks

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 任务 ID |
| session_id | string | 所属 Session |
| task_index | number | Session 内序号 |
| prompt | string | 任务描述 |
| status | enum | running / completed / error / stopped |
| cost | number? | API 费用估算 |
| duration | number? | 执行耗时 (ms) |
| favorite | boolean | 收藏标记 |

### Messages

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 消息 ID |
| task_id | string | 所属任务 |
| type | enum | text / tool_use / tool_result / result / error / user / plan |
| content | string? | 消息内容 |
| tool_name | string? | 工具名称 |
| tool_input | string? | 工具输入 |
| tool_output | string? | 工具输出 |
| attachments | string? | 附件 (JSON 数组) |

### Library Files

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 文件 ID |
| task_id | string | 所属任务 |
| name | string | 文件名 |
| type | enum | image / text / code / document / website / presentation / spreadsheet |
| path | string | 完整路径 |
| is_favorite | boolean | 收藏标记 |

---

## 八、核心服务

### Agent Service (`src-api/src/shared/services/agent.ts`)

| 功能 | 说明 |
|------|------|
| Agent 实例管理 | 创建和管理 Agent 实例 |
| 多 Provider 抽象 | Claude / DeepAgents / Kimi / 自定义 |
| 两阶段调度 | Planning → Approval → Execution |
| 对话历史管理 | 维护 Session 内上下文 |
| 计划存储 | 缓存和检索任务计划 |

### Sandbox Service (`src-api/src/core/sandbox/`)

| 功能 | 说明 |
|------|------|
| 沙箱抽象 | 多种沙箱实现（Codex CLI / Native） |
| 沙箱池管理 | 最多 5 个并发实例 |
| 脚本执行 | 可配置超时 |
| 自动降级 | Provider 不可用时自动切换 |

### Preview Service (`src-api/src/shared/services/preview.ts`)

| 功能 | 说明 |
|------|------|
| Vite 预览服务器 | 管理实时预览 |
| Node.js 检测 | 自动检测运行时 |
| 端口分配 | 动态分配预览端口 |
| 生命周期管理 | 优雅启停 |

---

## 九、用户交互流程

### 任务执行流程

```
用户输入 Prompt
    ↓
创建 Session + Task（写入 DB）
    ↓
跳转 Task Detail 页面
    ↓
SSE 流式连接 Agent
    ↓
┌──────────────────────┐
│  Planning 阶段        │
│  Agent 生成任务计划    │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│  Plan Approval        │
│  用户审查 + 确认计划   │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│  Execution 阶段       │
│  Agent 逐步执行计划    │
│  实时工具调用 + 反馈   │
└──────────┬───────────┘
           ↓
展示产物 + 保存到 Library
```

### Setup 流程

```
检查依赖 → 显示安装引导 → 一键安装 → 重新检测 → 进入 Home
```

---

## 十、配置体系

### 配置文件

| 文件 | 说明 |
|------|------|
| `src/config/index.ts` | 前端配置（API 端口、应用名等） |
| `src-api/src/config/constants.ts` | 后端常量（超时、限制等） |
| `~/.workany/config.json` | 运行时配置（Provider、API Key、模型偏好） |
| `~/.workany/mcp.json` | MCP 服务器配置 |

### 端口

| 环境 | 端口 |
|------|------|
| Development | 2026 |
| Production | 2620 |

### 数据目录 (`~/.workany/`)

```
~/.workany/
├── sessions/          # 任务和对话数据
├── skills/            # 自定义技能
├── logs/              # 应用日志
├── cache/             # 临时文件
├── config.json        # 主配置
└── mcp.json           # MCP 配置
```

---

## 十一、构建 & 部署

### 开发命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 仅前端 |
| `pnpm dev:api` | 仅后端 API |
| `pnpm dev:app` | 桌面应用 (Tauri) |
| `pnpm dev:all` | 前端 + API (concurrently) |

### 构建命令

| 命令 | 说明 |
|------|------|
| `pnpm build` | 前端构建 |
| `pnpm build:api` | 后端构建 |
| `pnpm build:api:binary` | API 二进制（平台特定） |
| `pnpm tauri:build` | 完整桌面应用 |

### 多平台支持

| 命令 | 平台 |
|------|------|
| `pnpm tauri:build:mac-arm` | macOS ARM64 |
| `pnpm tauri:build:mac-intel` | macOS Intel |
| `pnpm tauri:build:linux` | Linux |
| `pnpm tauri:build:windows` | Windows |

---

## 十二、国际化

| 语言 | 代码 |
|------|------|
| 中文（默认） | zh-CN |
| 英文 | en-US |

翻译系统位于 `src/config/locale/`，基于 key 的翻译方案，所有 UI 字符串均已本地化。

---

## 十三、关键文件索引

| 文件 | 说明 |
|------|------|
| `src/app/App.tsx` | 主应用组件 |
| `src/app/router.tsx` | 路由配置 |
| `src/app/pages/Home.tsx` | Home 页面 |
| `src/app/pages/Setup.tsx` | Setup 依赖检查页 |
| `src/app/pages/TaskDetail.tsx` | Task Detail 主页面（最大最复杂，77KB+） |
| `src/app/pages/Library.tsx` | Library 页面 |
| `src/components/home/` | Home 页面子组件 |
| `src/components/task/` | Task Detail 子组件 |
| `src/components/settings/` | Settings Modal Tabs |
| `src/components/artifacts/` | 产物预览组件 |
| `src/components/layout/` | 布局组件 |
| `src/components/shared/` | 共享 UI 组件 |
| `src/shared/hooks/useAgent.ts` | 前端 Agent Hook（100KB+） |
| `src/shared/db/database.ts` | IndexedDB / SQLite 抽象层 |
| `src-api/src/index.ts` | API 服务器入口 |
| `src-api/src/shared/services/agent.ts` | Agent 编排服务 |
| `src-api/src/core/sandbox/` | 沙箱执行层 |
| `src-api/src/shared/provider/manager.ts` | Provider 管理器 |
| `src-tauri/src/lib.rs` | Tauri 桌面应用核心 |
