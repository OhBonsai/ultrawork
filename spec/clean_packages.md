# Packages 合并重构方案

> 目标：将 `packages/ui` 和 `packages/util` 合并到 `packages/app` 中，最终只保留 `app` 和 `desktop` 两个 package。

---

## 一、现状分析

### 当前 4 个 Package

| Package | 作用 | 文件数 | 代码量 |
|---------|------|--------|--------|
| `@opencode-ai/util` | 纯工具函数 | 11 | ~388 行 |
| `@opencode-ai/ui` | UI 组件库 | ~180 | ~20k 行 |
| `@opencode-ai/app` | 业务应用 | ~253 | 主体 |
| `@opencode-ai/desktop` | Tauri 桌面壳 | ~12 | 最小 |

### 依赖关系

```
util (0 内部依赖)
  ↑
  ui (依赖 util，10 处 import)
  ↑
  app (依赖 ui 416 处 + util 55 处)
  ↑
  desktop (依赖 app 5 处 + ui 4 处)
```

- **无循环依赖**：ui 不引用 app，util 不引用任何内部包
- **desktop 直接引用 ui**：4 处（Font、Splash、Progress 加载态组件）

### desktop → ui 的直接引用

```typescript
// packages/desktop/src/loading.tsx
import { Font } from "@opencode-ai/ui/font"
import { Splash } from "@opencode-ai/ui/logo"
import { Progress } from "@opencode-ai/ui/progress"

// packages/desktop/src/index.tsx
import { Splash } from "@opencode-ai/ui/logo"
```

这 4 处引用是合并到 app 后需要处理的关键点。

---

## 二、方案评估

### 方案 A：util + ui 全部合入 app（推荐）

将 `packages/util/src/*` 和 `packages/ui/src/*` 移入 `packages/app/` 目录，app 同时 re-export desktop 需要的组件。

#### 目录结构

```
packages/
├── app/
│   ├── src/
│   │   ├── components/       ← 现有 app 组件
│   │   ├── context/          ← 现有 app context
│   │   ├── pages/            ← 现有 app 页面
│   │   ├── utils/            ← 现有 app 工具 + packages/util 合入
│   │   ├── ui/               ← packages/ui/src 整体迁入
│   │   │   ├── components/   ← 120+ UI 组件
│   │   │   ├── context/      ← UI context (dialog, file, i18n, marked, data)
│   │   │   ├── theme/        ← 主题系统
│   │   │   ├── hooks/        ← UI hooks
│   │   │   ├── pierre/       ← Diff 组件
│   │   │   ├── i18n/         ← UI 国际化
│   │   │   ├── styles/       ← Tailwind 样式
│   │   │   └── assets/       ← 字体、音频
│   │   └── i18n/             ← 现有 app 国际化
│   ├── e2e/
│   └── package.json
└── desktop/
    ├── src/
    ├── src-tauri/
    └── package.json
```

#### 迁移步骤

1. **移动 util 源码**
   - `packages/util/src/*.ts` → `packages/app/src/utils/`（合并到已有 utils 目录）
   - 更新 app 内 55 处 import：`@opencode-ai/util/xxx` → `@/utils/xxx`

2. **移动 ui 源码**
   - `packages/ui/src/` → `packages/app/src/ui/`
   - 更新 app 内 416 处 import：`@opencode-ai/ui/xxx` → `@/ui/xxx`
   - 更新 ui 内部 10 处 util import：`@opencode-ai/util/xxx` → `@/utils/xxx`

3. **处理 desktop → ui 的 4 处引用**
   - 方案 A1（推荐）：app 的 `package.json` exports 中 re-export desktop 需要的 3 个组件：
     ```json
     {
       "./ui/font": "./src/ui/components/font.tsx",
       "./ui/logo": "./src/ui/components/logo.tsx",
       "./ui/progress": "./src/ui/components/progress.tsx"
     }
     ```
     desktop 引用改为：`@opencode-ai/app/ui/font`
   - 方案 A2：将 Font/Splash/Progress 3 个组件复制到 desktop 包内（但会造成重复）

4. **更新配置文件**
   - 根 `package.json` workspaces 移除 ui、util
   - app `tsconfig.json` 合并 ui 的 tsconfig 配置（如有）
   - app `package.json` 合并 ui/util 的外部依赖（`@kobalte/core`、`tailwindcss` 等）
   - 删除 `packages/ui/` 和 `packages/util/` 目录

5. **更新构建**
   - app 的 Vite 配置可能需要调整（新增 ui 资产处理、CSS import 路径）
   - Tailwind 配置合并

#### 影响评估

| 维度 | 影响 |
|------|------|
| **改动量** | ~481 处 import 修改（可自动化 sed 替换） |
| **风险** | 中 — 主要是 import 路径变更，逻辑不变 |
| **构建** | 需调整 Vite 配置处理 ui 资产（字体、CSS） |
| **desktop** | 仅 4 处 import 路径变更 |
| **e2e** | 不受影响（e2e 通过 URL 访问，不涉及 import） |
| **typecheck** | 需确认 tsconfig paths 覆盖新目录 |

#### 优势

- 只剩 app + desktop 两个包，结构最简
- 消除跨包开发的认知负担
- app 内部引用更直观（`@/ui/button` vs `@opencode-ai/ui/button`）
- 统一构建流程，不再需要多包协调

#### 劣势

- app 体积膨胀（~500+ 文件），目录层级加深
- 失去 UI 组件库的独立性（未来如需复用 UI 需重新拆分）
- 一次性改动量大（481 处 import），需充分测试

---

### 方案 B：仅合并 util 到 ui

保留 3 个包：app、ui（含 util）、desktop。

| 维度 | 评估 |
|------|------|
| **改动量** | ~65 处 import |
| **风险** | 低 |
| **收益** | 有限 — 仍是 3 个包 |

不推荐：不满足"只保留 app + desktop"的目标。

---

### 方案 C：不做合并

当前结构已经是**合理的分层架构**：
- util → ui → app → desktop，依赖方向单一
- 无循环依赖
- 各包职责清晰

如果目标仅是简化开发体验而非严格"两个包"，保持现状也是可行选择。

---

## 三、可行性结论

| 方案 | 可行性 | 推荐度 |
|------|--------|--------|
| **A: util + ui → app** | ✅ 可行 | ⭐⭐⭐ 满足目标 |
| **B: util → ui** | ✅ 可行 | ⭐⭐ 不满足目标 |
| **C: 不变** | ✅ 可行 | ⭐ 现状合理但不满足目标 |

**方案 A 可行**，核心原因：
1. 依赖方向单一，无循环，合并不会产生架构问题
2. desktop → ui 的 4 处引用可通过 app re-export 解决
3. 所有改动都是 import 路径变更，无逻辑修改
4. 可通过 sed/codemod 脚本自动化完成

**主要风险点**：
1. Vite 构建配置合并（ui 有独立的样式/资产处理逻辑）
2. Tailwind CSS 配置合并
3. 改动量大，需完整 e2e 回归验证

---

## 四、执行计划（如采用方案 A）

| 步骤 | 说明 | 预估 |
|------|------|------|
| 1 | 编写 import 替换脚本 | 小 |
| 2 | 移动 util → app/src/utils/ | 小 |
| 3 | 移动 ui → app/src/ui/ | 中 |
| 4 | 执行 import 替换（481 处） | 自动化 |
| 5 | 合并 package.json 依赖 | 小 |
| 6 | 合并 tsconfig / Vite / Tailwind 配置 | 中 |
| 7 | app re-export desktop 需要的 3 个组件 | 小 |
| 8 | 更新 desktop 的 4 处 import | 小 |
| 9 | 删除 packages/ui、packages/util | 小 |
| 10 | typecheck + build 验证 | 中 |
| 11 | e2e 全量回归 | 中 |

---

## 五、执行结果（方案 A）

> 执行日期：2026-03-09

### 完成的工作

1. **util 迁入 app/src/utils/**：11 个文件（array, binary, encode, error, fn, identifier, iife, lazy, path, retry, slug）
2. **ui 迁入 app/src/ui/**：~180 个文件整体迁入
3. **import 替换**：~481 处 `@opencode-ai/ui/` → `@/ui/`，~55 处 `@opencode-ai/util/` → `@/utils/`
4. **desktop 引用**：4 处改为 `@opencode-ai/app/font`、`@opencode-ai/app/logo`、`@opencode-ai/app/progress`
5. **app package.json exports**：新增 `./font`、`./logo`、`./progress` 导出
6. **依赖合并**：ui/util 的外部依赖合入 app package.json
7. **root workspaces**：从 4 个缩减为 2 个（app、desktop）
8. **tsconfig.json**：新增 `src/**/*.json` include，排除 `**/*.stories.*`、`**/*.mdx`
9. **broken symlinks**：修复 public/ 下 15 个指向旧 ui 目录的符号链接
10. **删除 packages/ui/ 和 packages/util/**

### 验证结果

| 检查项 | 状态 |
|--------|------|
| `bun install` | ✅ |
| app typecheck | ✅ |
| desktop typecheck | ✅ |
| app build | ✅ (12.4s) |
| unit tests | ✅ (229 pass, 与合并前一致) |

### 最终目录结构

```
packages/
├── app/          # 业务应用 + UI 组件 + 工具函数
│   ├── src/
│   │   ├── components/   ← 业务组件
│   │   ├── context/      ← 业务 context
│   │   ├── pages/        ← 页面
│   │   ├── utils/        ← 工具函数（含原 util 包）
│   │   ├── ui/           ← UI 组件库（含原 ui 包）
│   │   └── i18n/         ← 国际化
│   └── package.json
└── desktop/      # Tauri 桌面壳
    ├── src/
    ├── src-tauri/
    └── package.json
```
