# migrate.md 方案评审

**评审结论：方案整体可行，但存在 6 个遗漏问题和 3 个风险项需修正后方可执行。**

---

## 一、严重问题（阻塞执行）

### 1. [P0] `vite.config.ts` 声称"无需修改"，实际必须改

**问题：** `vite.config.ts` 第 9 行：

```ts
publicDir: "../app/public",
```

在原 monorepo 中，`vite.config.ts` 位于 `packages/desktop/`，`../app/public` 解析为 `packages/app/public/`。

迁移后 `vite.config.ts` 位于 `ultrawork/`（根目录），`../app/public` 会指向 `ultrawork` 的**上级目录**的 `app/public`——这是错误路径。

**修正：** 需将 `publicDir` 改为 `"./app/public"`。

**补充发现：** `app/public/` 目录中有 14 个符号链接指向 `../../ui/src/assets/`（favicon、社交分享图等）。迁移后 ui 在 `ultrawork/ui/`，符号链接的相对路径仍然成立（`app/public/` → `../../ui/src/assets/` = `ultrawork/ui/src/assets/`），无需额外处理。

**影响：** 方案 Step 4 中"直接复制 vite.config.ts 无需修改"的结论错误；§6"不需要修改的内容"中将 vite.config.ts 列为无需修改也是错误的；总修改量应从 4 个文件变为 5 个文件。

---

### 2. [P0] `src/index.tsx` 导入 `../package.json` 读取 version，迁移后指向不同文件

**问题：** `packages/desktop/src/index.tsx` 第 27 行：

```ts
import pkg from "../package.json"
```

第 84 行使用 `pkg.version` 作为桌面应用版本号。

在原 monorepo 中，`../package.json` 指向 `packages/desktop/package.json`（version: `1.2.20`）。

迁移后 `src/index.tsx` 在 `ultrawork/src/`，`../package.json` 指向 `ultrawork/package.json`——即 Step 5 新建的 workspace root `package.json`（version: `1.0.0`）。

**后果：** 应用运行时版本号显示错误（`1.0.0` 而非 `1.2.20`）。

**修正方案（二选一）：**
- (a) `ultrawork/package.json` 中的 `version` 保持与原 `packages/desktop/package.json` 一致（`1.2.20`），后续版本管理也以此为准
- (b) 将 `src/index.tsx` 中的 `import pkg from "../package.json"` 改为显式常量

**建议选 (a)**，因为 tauri.conf.json 也依赖同一文件（见下条）。

---

### 3. [P0] `tauri.conf.json` 的 `version` 字段引用 `"../package.json"`

**问题：** `src-tauri/tauri.conf.json` 第 6 行：

```json
"version": "../package.json",
```

Tauri 会从该路径读取 `version` 字段用于构建产物的版本号。

原来 `src-tauri/` 在 `packages/desktop/src-tauri/`，`../package.json` 指向 `packages/desktop/package.json`。

迁移后 `src-tauri/` 在 `ultrawork/src-tauri/`，`../package.json` 指向 `ultrawork/package.json`。

**与第 2 点关联：** 只要 `ultrawork/package.json` 的 version 设为正确值，两个问题同时解决。但方案中 Step 5 示例写的是 `"version": "1.0.0"`，这是错误的。

**修正：** `ultrawork/package.json` 的 version 必须设为 `"1.2.20"`（或从 `packages/desktop/package.json` 同步）。

---

### 4. [P0] `catalog:` 协议在子包 package.json 中无法解析

**问题：** `catalog:` 是 bun/npm workspace 的特性，依赖根 `package.json` 中的 `workspaces.catalog` 定义。

迁移后：
- `app/package.json` 中有 **24 处** `"catalog:"` 引用
- `ui/package.json` 中有 **21 处** `"catalog:"` 引用
- `util/package.json` 中有 **3 处** `"catalog:"` 引用

方案只在 §6 "风险与注意事项"中提到了 `@solid-primitives/storage` 和 `@pierre/diffs` 两个 catalog 引用，严重低估了问题规模。

**修正方案（二选一）：**
- (a) 在 `ultrawork/package.json` 中添加完整的 `workspaces.catalog` 定义（从 monorepo 根 package.json 复制），子包 package.json 不改
- (b) 将所有子包 package.json 中的 `catalog:` 替换为显式版本号

**建议选 (a)**，改动最少，符合"零逻辑改动"原则。但需将完整 catalog 内容列入 Step 5。

---

## 二、重要问题（影响功能）

### 5. [P1] `scripts/predev.ts` 依赖 monorepo 中的 `packages/opencode`

**问题：** `scripts/predev.ts` 第 9、12-13 行：

```ts
const binaryPath = windowsify(`../opencode/dist/${sidecarConfig.ocBinary}/bin/opencode`)
await $`cd ../opencode && bun run build --single`
```

这些路径相对于 `packages/desktop/` 指向 `packages/opencode/`——即 monorepo 中的 CLI 构建工具。迁移后 `ultrawork/` 脱离 monorepo，`../opencode` 不再存在。

**影响：** `bun run dev`（通过 predev）会立即失败，无法启动开发模式。

**修正：** 方案需说明 sidecar 二进制的来源策略——是预构建下载？还是保留对 monorepo 的引用？还是将 opencode CLI 也作为依赖？这里需要与你确认。

---

### 6. [P1] `scripts/prepare.ts` 依赖 `@opencode-ai/script`（monorepo 私有包）

**问题：** `scripts/prepare.ts` 第 4 行：

```ts
import { Script } from "@opencode-ai/script"
```

`@opencode-ai/script` 是 monorepo 的 CI 辅助脚本包（`packages/script/`），且其内部硬编码了 monorepo 根目录路径（`path.resolve(import.meta.dir, "../../../package.json")`）。

**影响：** CI/CD 发布流程无法在独立 ultrawork 目录中运行。

**修正：** 如果 `prepare.ts` 仅用于 CI 发布，可暂不迁移（标记为 TODO）；若需独立运行，需将 `@opencode-ai/script` 逻辑内联或发布为 npm 包。

---

### 7. [P1] `app/src/entry.tsx` 也导入 `../package.json` 读取 version

**问题：** `packages/app/src/entry.tsx` 第 10 行：

```ts
import pkg from "../package.json"
```

第 103 行使用 `pkg.version`。迁移后 `app/package.json` 被原样复制，其 `version` 字段为 `1.2.20`，此处**暂无问题**。但需注意后续版本更新时，`app/package.json` 的 version 是否与根 `package.json` 同步维护。

**严重程度：** 低风险，记录备查。

---

## 三、改进建议（非阻塞）

### 7. [P2] `cp -r` 命令会复制 `node_modules` 和构建产物

**问题：** 方案中的 `cp -r packages/app/ ultrawork/app/` 会连带复制：
- `node_modules/`（含 32 个条目，是 bun workspace 的 hoisted 依赖）
- `e2e/` 目录（playwright 测试，与桌面应用无关）
- `playwright.config.ts`、`happydom.ts`

`packages/ui/node_modules` 含 35 个条目，`packages/util/node_modules` 含 6 个条目，同样会被复制。

`cp -r packages/desktop/src-tauri/ ultrawork/src-tauri/` 会复制 `target/` 目录（**4.3GB** Rust 构建缓存）。

**修正：** 使用 `rsync --exclude` 或明确列出需要复制的文件/目录，避免无用内容：

```bash
# app 示例
rsync -a --exclude node_modules --exclude e2e --exclude '*.tsbuildinfo' \
  packages/app/ ultrawork/app/

# src-tauri 示例
rsync -a --exclude target --exclude gen \
  packages/desktop/src-tauri/ ultrawork/src-tauri/
```

---

### 8. [P2] `app/vite.js` 中的 `@` 别名指向问题未分析

**问题：** `app/vite.js` 中：

```js
"@": fileURLToPath(new URL("./src", import.meta.url)),
```

`import.meta.url` 指向 `vite.js` 文件自身的位置。在 workspace 模式下，`app/vite.js` 会被 `vite.config.ts` 通过 `@opencode-ai/app/vite` 引入。

如果 bun workspace 将 `@opencode-ai/app` 符号链接到 `ultrawork/app/`，则 `import.meta.url` 指向 `ultrawork/app/vite.js`，`@` 别名解析为 `ultrawork/app/src/` —— 这是正确的。

**结论：** 实际无问题，但方案应明确说明此依赖关系，作为验证检查点。

---

### 9. [P2] `@opencode-ai/sdk` npm 版本 vs workspace 源码的 exports 差异

**问题：** workspace 源码中 sdk 的 exports 使用 `.ts` 入口：

```json
".": "./src/index.ts",
"./v2/client": "./src/v2/client.ts"
```

而 npm 发布版使用编译后的 `.js`/`.d.ts`：

```json
".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
```

app 和 ui 中实际使用的导入路径为 `@opencode-ai/sdk/v2` 和 `@opencode-ai/sdk/v2/client`，npm 版本均有对应导出，**兼容性无问题**。

**但需注意：** 如果 sdk npm 版本的类型定义与 app/ui 代码不完全匹配（monorepo 中两者始终同步，npm 可能滞后），会导致类型错误。建议在迁移后立即运行 `tsc --noEmit` 验证。

---

## 四、方案文档质量问题

### 10. 章节编号混乱

- §2 "目标目录结构" 和 §3 "迁移计划" 之间缺少过渡
- §3 标题是"迁移计划"，但 §4 标题是"package.json 变更清单"——容易与 §3 中的 Step 5 混淆
- §7 的 Step 编号从 1 开始复述，与 §3 中的详细步骤有冗余

### 11. 测试方案缺少失败场景

测试方案只列出了"通过"条件，未说明常见失败情形的诊断方式。例如：
- `bun install` 失败时，如何判断是 catalog 问题还是 workspace 配置问题？
- `tsc --noEmit` 失败时，如何区分是路径问题还是 sdk 类型不兼容？

---

## 五、评审总结

| 类别 | 数量 | 说明 |
|------|------|------|
| P0 阻塞问题 | 4 | 必须修正后才能执行 |
| P1 重要问题 | 3 | 影响开发和 CI 流程 |
| P2 改进建议 | 3 | 不阻塞但建议修正 |
| 文档问题 | 2 | 影响可读性 |

### 修正后的总修改量

| 文件 | 修改内容 |
|------|----------|
| `vite.config.ts` | `publicDir` 路径修正（`"../app/public"` → `"./app/public"`） |
| `ultrawork/package.json` | version 设为 `1.2.20`；添加完整 `workspaces.catalog` |
| `app/package.json` | `@opencode-ai/sdk` 从 `workspace:*` 改为 `1.2.20` |
| `ui/package.json` | `@opencode-ai/sdk` 从 `workspace:*` 改为 `1.2.20` |
| `tsconfig.json` | references 路径修正 |
| `src/i18n/index.ts` | 15 行相对路径修正 |
| `scripts/predev.ts` | sidecar 来源策略待定（需确认） |

实际修改文件数：**6-7 个**（方案声称 4 个）。

### 需要你确认的决策点

1. **sidecar 来源**：`predev.ts` 中的 `../opencode` 路径失效后，开发模式如何获取 CLI 二进制？
2. **`prepare.ts` 是否迁移**：CI 发布脚本是否需要在 ultrawork 中独立运行？
3. **catalog 处理方式**：在 `ultrawork/package.json` 中重建 catalog（方案 a）还是显式替换所有版本号（方案 b）？
