# packages/desktop → ultrawork 迁移计划

## 背景

- 源目录：`packages/desktop`
- 目标目录：`ultrawork`（当前空目录）
- 目标：`ultrawork` 可独立运行，不依赖 monorepo 其他包

---

## 1. 依赖树分析

### packages/desktop 本地依赖

| 包名 | 源路径 | 有 npm 替代？ | 说明 |
|------|--------|--------------|------|
| `@opencode-ai/app` | `packages/app/` | ❌ 无 | 项目私有，需复制源码 |
| `@opencode-ai/ui` | `packages/ui/` | ❌ 无 | 项目私有，需复制源码 |
| `@opencode-ai/sdk` | `packages/sdk/js/` | ✅ 有 | 已发布至 npm `1.2.20`，直接作为依赖，**不复制源码** |
| `@opencode-ai/util` | `packages/util/` | ❌ 无 | 项目私有，需复制源码（被 app、ui 依赖） |

### 完整依赖关系图

```
packages/desktop
  ├── @opencode-ai/app       (packages/app)
  │     ├── @opencode-ai/sdk     → npm:@opencode-ai/sdk@1.2.20
  │     ├── @opencode-ai/ui      (packages/ui)
  │     │     ├── @opencode-ai/sdk     → npm（同上）
  │     │     └── @opencode-ai/util  (packages/util) ← 无本地依赖
  │     └── @opencode-ai/util
  └── @opencode-ai/ui        (同上)
```

### 特殊路径问题

`packages/desktop/src/i18n/index.ts` 使用跨包相对路径直接引入 app 的 i18n 文件：

```ts
import { dict as appEn } from "../../../app/src/i18n/en"
// ... 共 15 行类似导入
```

迁移后目录结构变化（`packages/desktop/src/` → `ultrawork/src/`，`packages/app/` → `ultrawork/app/`），相对路径需从 `../../../app/src/` 改为 `../../app/src/`。这是路径调整，不涉及逻辑修改。

---

## 2. 目标目录结构

```
ultrawork/                        ← workspace 根（独立运行）
  package.json                    ← workspace root，含全部 npm 依赖
  tsconfig.json                   ← 基础 tsconfig（引用 ./app）
  index.html                      ← 来自 packages/desktop/index.html
  vite.config.ts                  ← 来自 packages/desktop/vite.config.ts（直接复制）
  scripts/                        ← 来自 packages/desktop/scripts/
  src/                            ← 来自 packages/desktop/src/
  src-tauri/                      ← 来自 packages/desktop/src-tauri/
  app/                            ← 来自 packages/app/（含 src/、vite.js 等）
    package.json
    src/
    vite.js
    public/
    ...
  ui/                             ← 来自 packages/ui/（含 src/）
    package.json
    src/
    ...
  util/                           ← 来自 packages/util/（含 src/）
    package.json
    src/
    ...
```

`@opencode-ai/sdk` 不在目录中出现，由 npm 安装到 `node_modules`。

每个本地包保留自己的 `package.json`，通过 workspace 机制解析彼此，与原有 import 路径完全一致，无需修改包内部导入。

---

## 3. 迁移计划（按执行顺序）

### Step 1：复制 util（底层，无本地依赖）

**操作：**
```bash
cp -r packages/util/ ultrawork/util/
```

复制内容：
- `src/` — util 源码
- `package.json`
- `tsconfig.json`（如有）

**规则：** 零逻辑改动；util 无本地依赖，最先迁移。

**验证：**
```bash
cd ultrawork/util && bunx tsc --noEmit
```

---

### Step 2：复制 ui（依赖 sdk、util）

**操作：**
```bash
cp -r packages/ui/ ultrawork/ui/
```

复制内容：
- `src/` — UI 组件源码（含 assets、components、hooks、i18n、pierre、styles、theme）
- `package.json`
- `tsconfig.json`（如有）

**注意：** `ui/package.json` 中 `@opencode-ai/sdk` 的 `workspace:*` 需改为 `1.2.20`（或在 ultrawork workspace 中用 overrides 统一处理），以便解析到 npm 版本。

**规则：** 零逻辑改动；NPM 优先（sdk 改用 npm 版本）。

**验证：**
```bash
cd ultrawork && bun install && cd ui && bunx tsc --noEmit
```

---

### Step 3：复制 app（依赖 sdk、ui、util）

**操作：**
```bash
cp -r packages/app/ ultrawork/app/
```

复制内容：
- `src/` — app 源码（含 components、context、hooks、i18n、pages、utils）
- `vite.js` — vite plugin 入口（desktop 的 vite.config.ts 引用此文件）
- `public/` — 静态资源
- `package.json`
- `tsconfig.json`（如有）

**注意：** `app/package.json` 中 `@opencode-ai/sdk` 的 `workspace:*` 同样需改为 `1.2.20`。

**规则：** 零逻辑改动；NPM 优先（sdk 改用 npm 版本）。

**验证：**
```bash
cd ultrawork && bun install && cd app && bunx tsc --noEmit
```

---

### Step 4：复制 desktop 文件到 ultrawork 根目录

**操作：**
```bash
cp packages/desktop/index.html         ultrawork/index.html
cp packages/desktop/tsconfig.json      ultrawork/tsconfig.json
cp packages/desktop/vite.config.ts     ultrawork/vite.config.ts
cp -r packages/desktop/src/            ultrawork/src/
cp -r packages/desktop/src-tauri/      ultrawork/src-tauri/
cp -r packages/desktop/scripts/        ultrawork/scripts/
```

不复制：
- `packages/desktop/package.json` — 由 Step 5 重新创建
- `packages/desktop/node_modules/` — 安装时自动生成

**规则：** 结构简单（desktop 源码直接放根目录）；零逻辑改动。

**验证：** 目录存在性检查（见 Step 7 整体验证）。

---

### Step 5：创建 ultrawork/package.json

创建 workspace root 的 `package.json`，合并所有依赖（详见第 §4 依赖清单），声明本地 workspace 包，并将 sdk 作为普通 npm 依赖：

```json
{
  "name": "ultrawork",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "packageManager": "bun@1.3.10",
  "workspaces": ["app", "ui", "util"],
  "scripts": {
    "dev": "bun run predev && vite",
    "predev": "bun ./scripts/predev.ts",
    "build": "tsc -b && vite build",
    "tauri": "tauri"
  },
  "dependencies": {
    "@opencode-ai/app": "workspace:*",
    "@opencode-ai/ui": "workspace:*",
    "@opencode-ai/util": "workspace:*",
    "@opencode-ai/sdk": "1.2.20",
    "...（详见 §4 package.json 变更清单）": ""
  }
}
```

`sdk` 不在 workspaces 列表中，bun 会从 npm 安装。

**规则：** NPM 优先（sdk 已有 npm 版本，直接使用）；workspace 声明其余本地包。

**验证：**
```bash
cd ultrawork && bun install  # 无报错
```

---

### Step 6：修改 tsconfig.json

`packages/desktop/tsconfig.json` 中：

```json
{
  "references": [{ "path": "../app" }]
}
```

迁移后 app 在 `./app`，需改为：

```json
{
  "references": [{ "path": "./app" }]
}
```

**操作：** 将 `"../app"` 改为 `"./app"`（单处修改，非逻辑变更）。

**规则：** 零逻辑改动（仅路径引用变化）。

**验证：**
```bash
cd ultrawork && bunx tsc --noEmit
```

---

### Step 7：修复 src/i18n/index.ts 中的跨包相对路径

**问题：** `src/i18n/index.ts` 共 15 行使用硬编码相对路径引用 app 的 i18n 文件：

```ts
// 当前（从 packages/desktop/src/i18n/）
import { dict as appEn } from "../../../app/src/i18n/en"
```

迁移后（从 `ultrawork/src/i18n/`），app 在 `ultrawork/app/`，路径变为：

```ts
// 迁移后
import { dict as appEn } from "../../app/src/i18n/en"
```

**操作：** 将 `src/i18n/index.ts` 中所有 `"../../../app/src/i18n/` 替换为 `"../../app/src/i18n/`。

共涉及 15 行（en、zh、zht、ko、de、es、fr、da、ja、pl、ru、ar、no、br、bs）。

**规则：** 零逻辑改动（仅相对路径层级调整）。

**验证：**
```bash
cd ultrawork && bunx tsc --noEmit  # 类型检查通过
```

---

### Step 8：整体联调验证

```bash
cd ultrawork
bun install
bun tauri dev
```

预期：Tauri 窗口正常启动，功能与 `packages/desktop` 一致。

---

## 4. package.json 变更清单

以下为 `ultrawork/package.json` 需声明的全部 npm 依赖（合并自 desktop、app、ui、util 四个包）：

### dependencies

| 包名 | 版本 | 来源 |
|------|------|------|
| `@opencode-ai/sdk` | `1.2.20` | npm（不复制源码） |
| `@kobalte/core` | `0.13.11` | app, ui |
| `@pierre/diffs` | `1.1.0-beta.18` | ui |
| `@shikijs/transformers` | `3.9.2` | app, ui |
| `@solid-primitives/active-element` | `2.1.3` | app |
| `@solid-primitives/audio` | `1.4.2` | app |
| `@solid-primitives/bounds` | `0.1.3` | ui |
| `@solid-primitives/event-bus` | `1.1.2` | app |
| `@solid-primitives/i18n` | `2.2.1` | desktop, app |
| `@solid-primitives/media` | `2.3.3` | app, ui |
| `@solid-primitives/resize-observer` | `2.1.3` | app, ui |
| `@solid-primitives/scroll` | `2.1.3` | app |
| `@solid-primitives/storage` | `4.3.3` | desktop, app |
| `@solid-primitives/websocket` | `1.3.1` | app |
| `@solidjs/meta` | `0.29.4` | desktop, app, ui |
| `@solidjs/router` | `0.15.4` | app, ui |
| `@tauri-apps/api` | `^2` | desktop |
| `@tauri-apps/plugin-clipboard-manager` | `~2` | desktop |
| `@tauri-apps/plugin-deep-link` | `~2` | desktop |
| `@tauri-apps/plugin-dialog` | `~2` | desktop |
| `@tauri-apps/plugin-http` | `~2` | desktop |
| `@tauri-apps/plugin-notification` | `~2` | desktop |
| `@tauri-apps/plugin-opener` | `^2` | desktop |
| `@tauri-apps/plugin-os` | `~2` | desktop |
| `@tauri-apps/plugin-process` | `~2` | desktop |
| `@tauri-apps/plugin-shell` | `~2` | desktop |
| `@tauri-apps/plugin-store` | `~2` | desktop |
| `@tauri-apps/plugin-updater` | `~2` | desktop |
| `@tauri-apps/plugin-window-state` | `~2` | desktop |
| `@thisbeyond/solid-dnd` | `0.7.5` | app |
| `diff` | `8.0.2` | app |
| `dompurify` | `3.3.1` | ui |
| `fuzzysort` | `3.1.0` | app, ui |
| `ghostty-web` | `github:anomalyco/ghostty-web#main` | app |
| `katex` | `0.16.27` | ui |
| `luxon` | `3.6.1` | app, ui |
| `marked` | `17.0.1` | app, ui |
| `marked-katex-extension` | `5.1.6` | ui |
| `marked-shiki` | `1.2.1` | app, ui |
| `morphdom` | `2.7.8` | ui |
| `motion` | `12.34.5` | ui |
| `motion-dom` | `12.34.3` | ui |
| `motion-utils` | `12.29.2` | ui |
| `remeda` | `2.26.0` | app, ui |
| `shiki` | `3.20.0` | app, ui |
| `solid-js` | `1.9.10` | desktop, app, ui |
| `solid-list` | `0.3.0` | app, ui |
| `strip-ansi` | `7.1.2` | ui |
| `tailwindcss` | `4.1.11` | app, ui |
| `virtua` | `0.42.3` | app, ui |
| `zod` | `4.1.8` | app, ui, util |

### devDependencies

| 包名 | 版本 | 来源 |
|------|------|------|
| `@actions/artifact` | `4.0.0` | desktop |
| `@tailwindcss/vite` | `4.1.11` | app, ui |
| `@tsconfig/bun` | `1.0.9` | app |
| `@types/bun` | `1.3.9` | desktop, app |
| `@types/katex` | `0.16.7` | ui |
| `@types/luxon` | `3.7.1` | app |
| `@types/node` | `22.13.9` | app |
| `@typescript/native-preview` | `7.0.0-dev.20251207.1` | desktop, app, ui |
| `typescript` | `5.8.2` | desktop, app, ui |
| `vite` | `7.1.4` | desktop, app, ui |
| `vite-plugin-icons-spritesheet` | `3.0.1` | app, ui |
| `vite-plugin-solid` | `2.11.10` | app, ui |
| `@tauri-apps/cli` | `^2` | desktop |

---

## 5. 测试方案

### 模块级测试

| 迁移模块 | 测试工具 | 测试命令 | 验证内容 |
|----------|----------|----------|----------|
| `util/` | TypeScript tsc | `cd ultrawork/util && bunx tsc --noEmit` | 类型检查无错误 |
| `ui/` | TypeScript tsc | `cd ultrawork && bun install && cd ui && bunx tsc --noEmit` | 类型检查无错误 |
| `app/` | bun test + TypeScript | `cd ultrawork/app && bun test ./src` | 已有单元测试通过 |
| `app/` | TypeScript tsc | `cd ultrawork/app && bunx tsc --noEmit` | 类型检查无错误 |
| `src/` (desktop) | TypeScript tsc | `cd ultrawork && bunx tsc --noEmit` | 类型检查无错误（含 Step 6/7 修改） |

### 集成测试

| 测试阶段 | 命令 | 验证内容 |
|----------|------|----------|
| 依赖安装 | `cd ultrawork && bun install` | 所有依赖可正常解析，workspace 链接正确 |
| Vite 构建 | `cd ultrawork && bunx vite build` | 前端可正常构建，无模块解析错误 |
| Tauri 开发模式 | `cd ultrawork && bun tauri dev` | 桌面应用正常启动，UI 渲染正确 |
| Tauri 生产构建 | `cd ultrawork && bun tauri build` | 可打包为安装程序 |

### 行为对比测试（回归）

以下功能在迁移前后应保持一致：

| 功能点 | 验证方式 |
|--------|----------|
| i18n 多语言切换 | 切换语言后 UI 文字正确更新 |
| 应用自动更新 | 触发更新检查，弹窗显示正确 |
| CLI 安装 | 通过菜单触发 CLI 安装，提示路径正确 |
| 深链接 | 通过 URL Scheme 打开应用，路由跳转正确 |
| 文件/目录 picker | 打开文件选择器，返回路径正确 |
| WSL 路径转换（Windows） | WSL 模式下路径转换正确 |
| 剪贴板图片粘贴 | 粘贴图片后可正常附加到输入框 |
| webview 缩放 | Cmd+/Cmd- 缩放 webview |

---

## 6. 风险与注意事项

### 已知需要确认的问题

1. **`ui/package.json` 和 `app/package.json` 中 sdk 的版本引用**：原来是 `workspace:*`，复制后需改为 `"@opencode-ai/sdk": "1.2.20"`，否则 bun 会找不到本地 workspace 包。

2. **`ghostty-web` 包**：当前从 GitHub 安装（`github:anomalyco/ghostty-web#main`），需确认迁移后网络访问正常。

3. **`src-tauri/Cargo.toml` 中的 sidecar**：引用了 `sidecars/opencode-cli` 二进制。迁移后需从原始位置获取该二进制，或在 `scripts/predev.ts` 中处理。

4. **`@solid-primitives/storage` catalog 版本**：原 `catalog:` 解析为 `4.3.3`，在独立 package.json 中需显式写出版本号。

5. **`@pierre/diffs` catalog 版本**：原 `catalog:` 解析为 `1.1.0-beta.18`，同上需显式指定。

6. **`bunfig.toml`**：`packages/app/` 中有 `bunfig.toml`，需检查是否对构建有影响，如有需复制到 `ultrawork/app/`。

### 不需要修改的内容

- `src-tauri/` 内所有 Rust 代码
- `src/bindings.ts` — 自动生成文件
- `app/`、`ui/`、`util/` 内部源码 — 零逻辑改动
- `app/vite.js` — 内容不变，路径通过 workspace 正确解析
- `vite.config.ts` — 直接复制，无需修改

---

## 7. 执行顺序总览

```
Step 1  复制 util         → ultrawork/util/
Step 2  复制 ui           → ultrawork/ui/          （ui/package.json 中 sdk 改为 npm 版本）
Step 3  复制 app          → ultrawork/app/          （app/package.json 中 sdk 改为 npm 版本）
Step 4  复制 desktop 文件  → ultrawork/（根目录）
Step 5  创建 package.json  （workspaces: [app, ui, util]，sdk 作为 npm dep）
Step 6  修改 tsconfig.json 中的 references 路径（"../app" → "./app"）
Step 7  修复 src/i18n/index.ts 中 15 处相对路径（"../../../app/" → "../../app/"）
Step 8  bun install + bun tauri dev 联调验证
```

总修改量：**4 个文件有实质内容变更**
- `ui/package.json`：sdk 版本从 `workspace:*` 改为 `1.2.20`
- `app/package.json`：sdk 版本从 `workspace:*` 改为 `1.2.20`
- `tsconfig.json`：references 路径 1 处
- `src/i18n/index.ts`：15 行路径前缀替换

其余均为纯复制，零逻辑改动。
