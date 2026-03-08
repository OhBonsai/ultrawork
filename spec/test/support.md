# 测试体系说明

本项目从 monorepo（`opencode`）迁移而来，测试体系经过适配以支持独立运行。

## 项目结构

```
packages/
  app/           ← 前端应用（含单元测试 + e2e 测试）
  desktop/       ← Tauri 桌面壳（无测试文件）
  ui/            ← UI 组件库（无测试文件）
  util/          ← 工具库（无测试文件）
```

## 测试分层

### 1. 单元测试

- **位置**：`packages/app/src/**/*.test.ts`（约 50 个文件）
- **框架**：bun test + happydom（模拟 DOM）
- **运行方式**：

```bash
bun run test                          # 根目录快捷命令
cd packages/app && bun test           # 直接运行
cd packages/app && bun run test:unit:watch  # watch 模式
```

- **说明**：与上游 monorepo 完全一致，无任何改动。

### 2. E2E 测试

- **位置**：`packages/app/e2e/**/*.spec.ts`（约 50 个文件）
- **框架**：Playwright（chromium）
- **运行方式**：

```bash
bun run test:e2e                                    # 根目录快捷命令
cd packages/app && bun script/e2e-local.ts          # 直接运行
cd packages/app && bun script/e2e-local.ts -- --headed   # 显示浏览器窗口
cd packages/app && bun script/e2e-local.ts -- --debug    # 调试模式
cd packages/app && bun script/e2e-local.ts -- --grep "sidebar"  # 过滤指定 case
```

- **报告路径**：`packages/app/e2e/playwright-report/index.html`
- **查看报告**：`cd packages/app && bun run test:e2e:report`

#### 与上游的关键差异

上游 `e2e-local.ts` 直接 import opencode 的 TypeScript 源码启动 server：

```ts
// 上游（依赖 monorepo 内的 opencode 源码）
const servermod = await import("../../opencode/src/server/server")
server = servermod.Server.listen({ port, hostname })
```

迁移后改为通过 opencode CLI 二进制（sidecar）启动 server 子进程：

```ts
// 迁移后（独立运行，不依赖 monorepo）
const bin = await resolveOpencodeBin()
server = Bun.spawn([bin, "serve", "--port", String(port), "--hostname", "127.0.0.1"], ...)
```

二进制查找顺序：
1. `OPENCODE_BIN` 环境变量
2. `packages/desktop/src-tauri/sidecars/opencode-cli-{target}`（predev.ts 下载的 sidecar）
3. PATH 中的 `opencode` 命令

种子数据（seed）也从直接写入内部 store 改为通过 SDK 公开 API 创建 session。

### 3. 类型检查

```bash
bun run typecheck    # 等价于 bun --filter @opencode-ai/desktop typecheck (tsc -b)
```

## CI/CD Workflows

### test.yml — 测试

- **触发**：push 到 `dev-openwork` 分支、PR 到 `main` 分支、手动 `workflow_dispatch`
- **流程**：typecheck + unit（并行） → e2e（串行，依赖前两者通过）
- **e2e 在 CI 中的额外步骤**：
  1. `bun ./scripts/predev.ts` 下载 opencode CLI sidecar
  2. `bunx playwright install --with-deps chromium` 安装浏览器
  3. `bun run test:e2e` 运行测试
- **失败时**：自动上传 `e2e/test-results` 和 `e2e/playwright-report` 为 artifact

### build.yml — 构建安装包

- **触发**：push tag `v*`、手动 `workflow_dispatch`（可选单平台）
- **不依赖测试**：打 tag 直接触发构建，不等待测试通过
- **构建目标**：macOS Intel（dmg）、macOS ARM（dmg）、Windows（msi）、Linux（deb）
- **Release**：构建完成后自动创建 draft release 并上传安装包

### 流程图

```
push dev-openwork / PR 到 main:
  test.yml → typecheck + unit → e2e

push tag v*:
  build.yml → 构建 4 平台安装包 → 创建 draft release（不跑测试）

手动 workflow_dispatch:
  test.yml → 可手动触发测试
  build.yml → 直接构建（可选单平台）
```

## 本地开发前置条件

1. **Bun** >= 1.3.10
2. **Node.js** >= 22.12（Vite 7 要求）
3. **Playwright chromium**：首次运行需 `cd packages/app && bunx playwright install chromium`
4. **opencode sidecar**（e2e 需要）：`cd packages/desktop && bun ./scripts/predev.ts`

## .gitignore

以下测试产物已加入 `.gitignore`：

```
e2e/test-results/
e2e/playwright-report/
```
