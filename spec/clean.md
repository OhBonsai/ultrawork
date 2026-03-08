# 代码清理方案

本项目从 opencode monorepo 迁移而来，以下是残留的冗余代码及清理计划。

## 优先级说明

- **P0**：会导致构建/运行失败或引用不存在的代码
- **P1**：不影响运行但会造成混淆的冗余内容
- **P2**：命名/注释层面的不一致，低优先级

---

## P0 — 失效代码

### 1. `packages/desktop/scripts/prepare.ts` — 引用不存在的包

- **问题**：第 4 行 `import { Script } from "@opencode-ai/script"`，该包是 monorepo 私有 CI 辅助包，不存在于本仓库
- **影响**：脚本无法运行
- **方案**：
  - (a) 删除此文件（如果不再需要 CI 自动更新 version）
  - (b) 将 `Script.version` 逻辑内联（直接从根 `package.json` 读取 version）

### 2. `scripts/clean.ts` 第 40 行 — 引用不存在的 `packages/sdk`

- **问题**：`"packages/sdk/node_modules"` 路径不存在（SDK 已改为 npm 依赖）
- **方案**：删除该行

---

## P1 — 冗余文件和依赖

### 3. SST 自动生成文件（4 个）

以下文件由 SST（Serverless Stack）框架自动生成，本项目不使用 SST：

- `packages/app/sst-env.d.ts`
- `packages/app/src/sst-env.d.ts`
- `packages/ui/sst-env.d.ts`
- `packages/util/sst-env.d.ts`

**方案**：全部删除，同时在 `packages/app/src/assets.d.ts` 添加 `/// <reference types="vite/client" />`，
因为 `src/sst-env.d.ts` 间接为 `.aac`、`.woff2`、`.svg` 等资源模块提供了类型声明

### 4. 根 `package.json` catalog 中未使用的服务端依赖

以下 catalog 条目不被任何 package 引用，属于 monorepo 中服务端/edge 相关依赖：

| 依赖 | 说明 |
|------|------|
| `@hono/zod-validator` | Hono 中间件 |
| `@cloudflare/workers-types` | Cloudflare Workers 类型 |
| `@openauthjs/openauth` | 认证库（服务端） |
| `drizzle-kit` | 数据库 ORM 工具 |
| `drizzle-orm` | 数据库 ORM |
| `ai` | Vercel AI SDK |
| `hono` | Web 服务端框架 |
| `hono-openapi` | Hono OpenAPI 插件 |

**方案**：从 `catalog` 中移除这 8 个条目

### 5. 迁移文档已完成使命

以下 spec 文件记录迁移过程，迁移已完成后价值降低：

- `spec/migrate.md`
- `spec/migrate_review.md`
- `spec/migrate_v2.md`
- `spec/sync_update.md`

**方案**：移入 `spec/archive/` 目录归档，或直接删除

---

## P2 — 命名不一致（低优先级）

### 6. Vite 插件名称

- `packages/app/vite.js` 第 10 行：`"opencode-desktop:config"` → 可改为 `"ultrawork-desktop:config"`
- **注意**：仅影响 Vite 内部日志输出，不影响功能

### 7. 环境变量名称

- `packages/ui/vite.config.ts` 第 48 行：`OPENCODE_MODELS_URL` → 可改为 `ULTRAWORK_MODELS_URL`
- **注意**：需同步修改所有使用此环境变量的地方

### 8. GitHub Actions 步骤注释

- `.github/workflows/build.yml` 第 95 行："Download opencode sidecar"
- `.github/workflows/test.yml` 第 53 行："Download opencode sidecar"
- **方案**：改为 "Download CLI sidecar" 或保持现状（不影响功能）

---

## 执行结果

已全部执行完成，typecheck 通过。

### 变更清单

| 操作 | 文件 |
|------|------|
| 修改 | `packages/desktop/scripts/prepare.ts` — 内联 version 读取逻辑，移除 `@opencode-ai/script` |
| 修改 | `scripts/clean.ts` — 移除 `packages/sdk/node_modules` 引用 |
| 删除 | `packages/app/sst-env.d.ts`、`packages/app/src/sst-env.d.ts`、`packages/ui/sst-env.d.ts`、`packages/util/sst-env.d.ts` |
| 新增 | `packages/app/src/assets.d.ts` — `/// <reference types="vite/client" />` 替代 sst-env.d.ts 的类型声明 |
| 修改 | `package.json` — catalog 移除 8 个未使用的服务端依赖 |
| 移动 | 4 个迁移文档 → `spec/archive/` |
| 修改 | `packages/app/vite.js` — 插件名改为 `ultrawork-desktop:config` |
| 修改 | `.github/workflows/build.yml`、`test.yml` — 步骤名改为 "Download CLI sidecar" |
| 保留 | `OPENCODE_MODELS_URL` 环境变量（外部 API 相关，需同步修改部署配置，暂不改动） |
