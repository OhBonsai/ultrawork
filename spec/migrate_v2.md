# packages/desktop → ultrawork 迁移计划 v2

基于 v1 评审修正，合并所有已发现问题。

---

## 1. 依赖树分析

### packages/desktop 本地依赖


| 包名                  | 源路径                | 有 npm 替代？                   | 说明              |
| ------------------- | ------------------ | --------------------------- | --------------- |
| `@opencode-ai/app`  | `packages/app/`    | ❌ 无                         | 项目私有，需复制源码      |
| `@opencode-ai/ui`   | `packages/ui/`     | ❌ 无                         | 项目私有，需复制源码      |
| `@opencode-ai/sdk`  | `packages/sdk/js/` | ✅ `@opencode-ai/sdk@1.2.20` | 已发布至 npm，直接作为依赖 |
| `@opencode-ai/util` | `packages/util/`   | ❌ 无                         | 项目私有，需复制源码      |


### 完整依赖关系图

```
packages/desktop
  ├── @opencode-ai/app       (packages/app)
  │     ├── @opencode-ai/sdk     → npm:@opencode-ai/sdk@1.2.20
  │     ├── @opencode-ai/ui      (packages/ui)
  │     │     ├── @opencode-ai/sdk     → npm（同上）
  │     │     └── @opencode-ai/util  (packages/util)
  │     └── @opencode-ai/util
  └── @opencode-ai/ui        (同上)
```

### 已知路径问题（共 4 处跨包引用）


| 文件                                  | 当前路径                                | 迁移后路径                         | 说明            |
| ----------------------------------- | ----------------------------------- | ----------------------------- | ------------- |
| `src/i18n/index.ts` (15 行)          | `"../../../app/src/i18n/*"`         | `"../../app/src/i18n/*"`      | 层级减少一层        |
| `src/index.tsx` (第 27 行)            | `import pkg from "../package.json"` | 不变（指向 ultrawork/package.json） | version 字段须正确 |
| `src-tauri/tauri.conf.json` (第 6 行) | `"version": "../package.json"`      | 不变（指向 ultrawork/package.json） | version 字段须正确 |
| `vite.config.ts` (第 9 行)            | `publicDir: "../app/public"`        | `publicDir: "./app/public"`   | 路径修正          |


---

## 2. 目标目录结构

```
ultrawork/                        ← workspace 根（独立运行）
  package.json                    ← workspace root + catalog 定义 + 全部 npm 依赖
  tsconfig.json                   ← 基础 tsconfig（引用 ./app）
  index.html                      ← 来自 packages/desktop/
  vite.config.ts                  ← 来自 packages/desktop/（需改 publicDir）
  scripts/                        ← 来自 packages/desktop/scripts/（predev.ts 需改）
  src/                            ← 来自 packages/desktop/src/
  src-tauri/                      ← 来自 packages/desktop/src-tauri/（排除 target/）
  app/                            ← 来自 packages/app/
    package.json                     （sdk 改为 npm 版本）
    src/
    vite.js
    public/                          （含指向 ../../ui/src/assets/ 的符号链接，迁移后仍有效）
    bunfig.toml
  ui/                             ← 来自 packages/ui/
    package.json                     （sdk 改为 npm 版本）
    src/
  util/                           ← 来自 packages/util/
    package.json
    src/
```

---

## 3. 迁移步骤

### Step 1：复制 util

```bash
rsync -a --exclude node_modules --exclude '*.tsbuildinfo' \
  packages/util/ ultrawork/util/
```

**验证：** `cd ultrawork/util && bunx tsc --noEmit`

---

### Step 2：复制 ui

```bash
rsync -a --exclude node_modules --exclude '*.tsbuildinfo' \
  packages/ui/ ultrawork/ui/
```

修改 `ultrawork/ui/package.json`：

- `"@opencode-ai/sdk": "workspace:*"` → `"@opencode-ai/sdk": "1.2.20"`

**验证：** 等 Step 5 完成后统一验证。

---

### Step 3：复制 app

```bash
rsync -a --exclude node_modules --exclude e2e --exclude '*.tsbuildinfo' \
  packages/app/ ultrawork/app/
```

修改 `ultrawork/app/package.json`：

- `"@opencode-ai/sdk": "workspace:*"` → `"@opencode-ai/sdk": "1.2.20"`

**验证：** 等 Step 5 完成后统一验证。

---

### Step 4：复制 desktop 文件到 ultrawork 根目录

```bash
cp packages/desktop/index.html      ultrawork/index.html
cp packages/desktop/tsconfig.json   ultrawork/tsconfig.json
cp packages/desktop/vite.config.ts  ultrawork/vite.config.ts
cp -r packages/desktop/src/         ultrawork/src/
cp -r packages/desktop/scripts/     ultrawork/scripts/

# src-tauri 排除 4.3GB target 目录
rsync -a --exclude target \
  packages/desktop/src-tauri/ ultrawork/src-tauri/
```

不复制：

- `packages/desktop/package.json` — 由 Step 5 创建
- `packages/desktop/node_modules/`

---

### Step 5：创建 ultrawork/package.json

```json
{
  "name": "@opencode-ai/desktop",
  "private": true,
  "version": "1.2.20",
  "type": "module",
  "license": "MIT",
  "packageManager": "bun@1.3.10",
  "workspaces": {
    "packages": ["app", "ui", "util"],
    "catalog": {
      "@types/bun": "1.3.9",
      "@types/luxon": "3.7.1",
      "@types/node": "22.13.9",
      "@tsconfig/node22": "22.0.2",
      "@tsconfig/bun": "1.0.9",
      "@kobalte/core": "0.13.11",
      "@pierre/diffs": "1.1.0-beta.18",
      "@solid-primitives/storage": "4.3.3",
      "@tailwindcss/vite": "4.1.11",
      "@solidjs/meta": "0.29.4",
      "@solidjs/router": "0.15.4",
      "@typescript/native-preview": "7.0.0-dev.20251207.1",
      "diff": "8.0.2",
      "fuzzysort": "3.1.0",
      "luxon": "3.6.1",
      "marked": "17.0.1",
      "marked-shiki": "1.2.1",
      "remeda": "2.26.0",
      "shiki": "3.20.0",
      "solid-js": "1.9.10",
      "solid-list": "0.3.0",
      "tailwindcss": "4.1.11",
      "typescript": "5.8.2",
      "vite": "7.1.4",
      "vite-plugin-solid": "2.11.10",
      "virtua": "0.42.3",
      "zod": "4.1.8"
    }
  },
  "scripts": {
    "typecheck": "tsc -b",
    "predev": "bun ./scripts/predev.ts",
    "dev": "vite",
    "build": "bun run typecheck && vite build",
    "tauri": "tauri"
  },
  "dependencies": {
    "@opencode-ai/app": "workspace:*",
    "@opencode-ai/ui": "workspace:*",
    "@opencode-ai/util": "workspace:*",
    "@opencode-ai/sdk": "1.2.20",
    "@solid-primitives/i18n": "2.2.1",
    "@solid-primitives/storage": "catalog:",
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-clipboard-manager": "~2",
    "@tauri-apps/plugin-deep-link": "~2",
    "@tauri-apps/plugin-dialog": "~2",
    "@tauri-apps/plugin-http": "~2",
    "@tauri-apps/plugin-notification": "~2",
    "@tauri-apps/plugin-opener": "^2",
    "@tauri-apps/plugin-os": "~2",
    "@tauri-apps/plugin-process": "~2",
    "@tauri-apps/plugin-shell": "~2",
    "@tauri-apps/plugin-store": "~2",
    "@tauri-apps/plugin-updater": "~2",
    "@tauri-apps/plugin-window-state": "~2",
    "solid-js": "catalog:",
    "@solidjs/meta": "catalog:"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "@types/bun": "catalog:",
    "@typescript/native-preview": "catalog:",
    "typescript": "catalog:",
    "vite": "catalog:"
  }
}
```

关键点：

- `version` 必须为 `"1.2.20"`（`src/index.tsx` 和 `tauri.conf.json` 均读取此值）
- `workspaces.catalog` 从 monorepo 根 package.json 复制，子包的 `catalog:` 引用不修改
- `@opencode-ai/sdk` 为普通 npm 依赖，不在 workspaces 中
- 根目录依赖仅列 desktop 自身所需；app/ui/util 的依赖保留在各自 package.json 中

**验证：**

```bash
cd ultrawork && bun install
```

---

### Step 6：修改 vite.config.ts

将 `publicDir` 路径从上级目录改为同级目录：

```diff
- publicDir: "../app/public",
+ publicDir: "./app/public",
```

`app/public/` 中有 14 个符号链接指向 `../../ui/src/assets/`，迁移后相对路径仍有效（`app/public/` → `../../ui/src/assets/` = `ultrawork/ui/src/assets/`）。

**验证：**

```bash
cd ultrawork && bunx vite build 2>&1 | head -10
```

---

### Step 7：修改 tsconfig.json

```diff
- "references": [{ "path": "../app" }]
+ "references": [{ "path": "./app" }]
```

**验证：**

```bash
cd ultrawork && bunx tsc --noEmit
```

---

### Step 8：修复 src/i18n/index.ts 中的 15 处相对路径

```diff
- import { dict as appEn } from "../../../app/src/i18n/en"
+ import { dict as appEn } from "../../app/src/i18n/en"
```

全局替换 `"../../../app/src/i18n/` → `"../../app/src/i18n/`，共 15 行（en/zh/zht/ko/de/es/fr/da/ja/pl/ru/ar/no/br/bs）。

**验证：**

```bash
cd ultrawork && bunx tsc --noEmit
```

---

### Step 9：处理 scripts/predev.ts（sidecar 来源）

**问题：** `predev.ts` 中硬编码了 monorepo 路径：

```ts
const binaryPath = windowsify(`../opencode/dist/${sidecarConfig.ocBinary}/bin/opencode`)
await $`cd ../opencode && bun run build --single`
```

迁移后 `../opencode`（即 `packages/opencode`）不存在。

**待确认方案（三选一）：**

- (a) 改为从 npm 安装 `opencode-ai` CLI 后复制二进制到 sidecars/
- (b) 改为从 GitHub Release 下载预编译二进制
- (c) 保留对 monorepo 的软依赖，开发时需将 monorepo 克隆到特定位置

> **需决策：请选择方案后再执行此步骤。**

同样，`scripts/prepare.ts` 依赖 `@opencode-ai/script`（monorepo 私有 CI 包），暂不迁移，标记为 TODO。

---

### Step 10：整体联调验证

```bash
cd ultrawork
bun install
bun tauri dev
```

预期：Tauri 窗口正常启动，功能与 `packages/desktop` 一致。

---

## 4. 全部修改文件清单


| 文件                  | 修改内容                                                      | 规则     |
| ------------------- | --------------------------------------------------------- | ------ |
| `ui/package.json`   | `@opencode-ai/sdk`: `workspace:*` → `1.2.20`              | NPM 优先 |
| `app/package.json`  | `@opencode-ai/sdk`: `workspace:*` → `1.2.20`              | NPM 优先 |
| `vite.config.ts`    | `publicDir`: `"../app/public"` → `"./app/public"`         | 路径修正   |
| `tsconfig.json`     | `references.path`: `"../app"` → `"./app"`                 | 路径修正   |
| `src/i18n/index.ts` | 15 行 `"../../../app/src/i18n/"` → `"../../app/src/i18n/"` | 路径修正   |
| `scripts/predev.ts` | sidecar 来源策略（待确认）                                         | 待决策    |


新建文件：


| 文件                       | 说明                                          |
| ------------------------ | ------------------------------------------- |
| `ultrawork/package.json` | workspace root，含 version/catalog/依赖/scripts |


总计：**6 个文件修改 + 1 个文件新建**（不含纯复制）。

---

## 5. package.json 依赖清单

以下列出所有 npm 依赖。根目录只列 desktop 直接依赖；app/ui/util 各自 package.json 中的依赖保留原样（catalog 通过根 package.json 的 catalog 定义解析）。

### 根目录 dependencies


| 包名                                     | 版本            | 说明           |
| -------------------------------------- | ------------- | ------------ |
| `@opencode-ai/app`                     | `workspace:`* | 本地 workspace |
| `@opencode-ai/ui`                      | `workspace:*` | 本地 workspace |
| `@opencode-ai/util`                    | `workspace:*` | 本地 workspace |
| `@opencode-ai/sdk`                     | `1.2.20`      | npm          |
| `@solid-primitives/i18n`               | `2.2.1`       | desktop      |
| `@solid-primitives/storage`            | `catalog:`    | desktop      |
| `@tauri-apps/api`                      | `^2`          | desktop      |
| `@tauri-apps/plugin-clipboard-manager` | `~2`          | desktop      |
| `@tauri-apps/plugin-deep-link`         | `~2`          | desktop      |
| `@tauri-apps/plugin-dialog`            | `~2`          | desktop      |
| `@tauri-apps/plugin-http`              | `~2`          | desktop      |
| `@tauri-apps/plugin-notification`      | `~2`          | desktop      |
| `@tauri-apps/plugin-opener`            | `^2`          | desktop      |
| `@tauri-apps/plugin-os`                | `~2`          | desktop      |
| `@tauri-apps/plugin-process`           | `~2`          | desktop      |
| `@tauri-apps/plugin-shell`             | `~2`          | desktop      |
| `@tauri-apps/plugin-store`             | `~2`          | desktop      |
| `@tauri-apps/plugin-updater`           | `~2`          | desktop      |
| `@tauri-apps/plugin-window-state`      | `~2`          | desktop      |
| `solid-js`                             | `catalog:`    | desktop      |
| `@solidjs/meta`                        | `catalog:`    | desktop      |


### 根目录 devDependencies


| 包名                           | 版本         | 说明      |
| ---------------------------- | ---------- | ------- |
| `@tauri-apps/cli`            | `^2`       | desktop |
| `@types/bun`                 | `catalog:` | desktop |
| `@typescript/native-preview` | `catalog:` | desktop |
| `typescript`                 | `catalog:` | desktop |
| `vite`                       | `catalog:` | desktop |


### app/ui/util 各自 package.json 中的依赖

原样保留，仅将 `@opencode-ai/sdk` 的 `workspace:*` 改为 `1.2.20`。所有 `catalog:` 引用通过根 package.json 的 catalog 定义解析，**无需替换为显式版本号**。

---

## 6. 测试方案

### 分层验证


| 阶段         | 命令                             | 通过标准               | 失败诊断                                                                                    |
| ---------- | ------------------------------ | ------------------ | --------------------------------------------------------------------------------------- |
| 依赖安装       | `cd ultrawork && bun install`  | 无报错，workspace 链接正确 | 若报 `catalog:` 错误 → 检查根 package.json 的 catalog 定义；若报 `workspace:`* 错误 → 检查 workspaces 配置 |
| util 类型检查  | `cd util && bunx tsc --noEmit` | 无类型错误              | 检查 `zod` catalog 版本是否正确                                                                 |
| ui 类型检查    | `cd ui && bunx tsc --noEmit`   | 无类型错误              | 若 sdk 类型不匹配 → npm 版本可能滞后，需确认 sdk 版本                                                     |
| app 类型检查   | `cd app && bunx tsc --noEmit`  | 无类型错误              | 同上                                                                                      |
| app 单元测试   | `cd app && bun test ./src`     | 已有测试全部通过           | 检查 `bunfig.toml` 是否正确复制                                                                 |
| 根目录类型检查    | `bunx tsc --noEmit`            | 无类型错误              | 检查 tsconfig references 和 i18n 路径                                                        |
| Vite 构建    | `bunx vite build`              | 构建成功               | 若 publicDir 报错 → 检查 vite.config.ts 修改；若模块解析失败 → 检查 workspace 链接                         |
| Tauri 开发模式 | `bun tauri dev`                | 窗口正常启动             | 若 sidecar 缺失 → predev.ts 未适配；若版本号错误 → package.json version 不对                           |


### 回归验证


| 功能点        | 验证方式                          |
| ---------- | ----------------------------- |
| 版本号显示      | 应用内显示的版本号应为 `1.2.20`          |
| i18n 多语言   | 切换语言后 UI 文字正确更新               |
| 应用菜单       | macOS 菜单栏显示正确，各功能可触发          |
| 文件/目录选择器   | 打开选择器，返回路径正确                  |
| 深链接        | `opencode://` URL Scheme 正常跳转 |
| webview 缩放 | Cmd+/Cmd- 正常缩放                |
| 剪贴板图片      | 粘贴图片可附加到输入框                   |


---

## 7. 执行顺序总览

```
Step 1   复制 util         → ultrawork/util/
Step 2   复制 ui           → ultrawork/ui/           (sdk 改 npm)
Step 3   复制 app          → ultrawork/app/           (sdk 改 npm)
Step 4   复制 desktop 文件  → ultrawork/               (排除 target/)
Step 5   创建 package.json  (version=1.2.20, catalog, workspaces)
Step 6   修改 vite.config.ts (publicDir 路径)
Step 7   修改 tsconfig.json  (references 路径)
Step 8   修复 src/i18n/index.ts (15 处相对路径)
Step 9   处理 predev.ts      (sidecar 来源 — 待确认)
Step 10  bun install + bun tauri dev 联调
```

---

## 8. 待确认决策点


| #   | 问题                                         | 选项                                                       | 建议     |
| --- | ------------------------------------------ | -------------------------------------------------------- | ------ |
| 1   | sidecar 来源（`predev.ts` 中 `../opencode` 失效） | (a) npm 安装 CLI (b) GitHub Release 下载 (c) 保留 monorepo 软依赖 | 请确认    |
| 2   | `scripts/prepare.ts` 是否迁移                  | (a) 暂不迁移，标记 TODO (b) 内联 `@opencode-ai/script` 逻辑         | 建议 (a) |
| 3   | `app/package.json` 的 version 后续如何维护        | (a) 与根 package.json 同步 (b) 各自独立管理                        | 建议 (a) |


