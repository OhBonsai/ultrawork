# ultrawork 同步更新方案

## 问题

ultrawork 从 monorepo (`packages/desktop` + `app` + `ui` + `util` + `sdk/js`) 提取而来。
上游持续开发，需要一种可重复的方式将新代码同步到 ultrawork。

---

## 核心思路

将文件分为三层：

| 层 | 含义 | 同步策略 |
|---|---|---|
| **纯复制层** | 内容与 monorepo 完全一致 | rsync 覆盖 |
| **补丁层** | 迁移时做了已知修改 | rsync 覆盖后重新打补丁 |
| **独立层** | ultrawork 独有文件 | 不动 |

---

## 文件分类

### 纯复制层（直接 rsync 覆盖）

```
packages/util/       →  ultrawork/util/
packages/ui/         →  ultrawork/ui/
packages/app/        →  ultrawork/app/         (排除 e2e/)
packages/sdk/js/     →  ultrawork/sdk/
packages/desktop/src/                →  ultrawork/src/         (排除 i18n/index.ts)
packages/desktop/scripts/utils.ts    →  ultrawork/scripts/utils.ts
packages/desktop/scripts/prepare.ts  →  ultrawork/scripts/prepare.ts
packages/desktop/scripts/copy-bundles.ts  →  ultrawork/scripts/copy-bundles.ts
packages/desktop/scripts/finalize-latest-json.ts →  ultrawork/scripts/finalize-latest-json.ts
packages/desktop/index.html          →  ultrawork/index.html
packages/desktop/src-tauri/          →  ultrawork/src-tauri/   (排除 target/，特殊处理 cli.rs 和 Cargo.toml)
install                              →  ultrawork/install
```

### 补丁层（6 个文件，rsync 后需重新打补丁）

| 文件 | monorepo 源 | 补丁内容 |
|---|---|---|
| `vite.config.ts` | `packages/desktop/vite.config.ts` | `publicDir: "../app/public"` → `"./app/public"` |
| `tsconfig.json` | `packages/desktop/tsconfig.json` | `"path": "../app"` → `"./app"` |
| `src/i18n/index.ts` | `packages/desktop/src/i18n/index.ts` | `"../../../app/src/i18n/` → `"../../app/src/i18n/` (15 处) |
| `src-tauri/src/cli.rs` | `packages/desktop/src-tauri/src/cli.rs` | `include_str!("../../../../install")` → `"../../install"` |
| `src-tauri/Cargo.toml` | `packages/desktop/src-tauri/Cargo.toml` | `tauri = "2.9.5"` → `"2.10"` + 删除 `[patch.crates-io]` 中的 tauri 行 |
| `package.json` | 无对应源（独立编写） | 见独立层 |

### 独立层（不参与同步）

```
ultrawork/package.json           ← workspace root，手动维护
ultrawork/scripts/predev.ts      ← GitHub Release 下载逻辑，手动维护
ultrawork/scripts/copy-to.ts     ← 复制工具脚本
ultrawork/bun.lock               ← bun install 自动生成
ultrawork/migrate*.md            ← 文档
ultrawork/sync_update.md         ← 本文件
```

---

## 同步脚本：`scripts/sync-from-monorepo.ts`

自动化执行同步。用法：

```bash
bun scripts/sync-from-monorepo.ts /path/to/opencode
```

脚本逻辑：

```
1. 参数校验：检查 monorepo 路径存在
2. rsync 纯复制层（排除 node_modules, target, e2e, *.tsbuildinfo）
3. rsync 补丁层源文件
4. 自动应用已知补丁（sed 替换）
5. 打印 diff 摘要供人工确认
6. 提示运行 bun install
```

### 补丁应用规则（硬编码在脚本中）

```ts
const PATCHES = [
  {
    file: "vite.config.ts",
    find: 'publicDir: "../app/public"',
    replace: 'publicDir: "./app/public"',
  },
  {
    file: "tsconfig.json",
    find: '"path": "../app"',
    replace: '"path": "./app"',
  },
  {
    file: "src/i18n/index.ts",
    find: '"../../../app/src/i18n/',
    replace: '"../../app/src/i18n/',
    all: true,
  },
  {
    file: "src-tauri/src/cli.rs",
    find: 'include_str!("../../../../install")',
    replace: 'include_str!("../../install")',
  },
  {
    file: "src-tauri/Cargo.toml",
    patches: [
      { find: 'version = "2.9.5"', replace: 'version = "2.10"' },
      // 删除 tauri git patch 行（如果上游仍存在）
    ],
  },
]
```

### 手动检查项

同步后需人工确认：

1. **package.json catalog 版本** — 如果上游 monorepo 根 `package.json` 的 `workspaces.catalog` 中有版本升级，需手动同步到 `ultrawork/package.json` 的 catalog。
2. **新增依赖** — 如果 `app/package.json` 或 `ui/package.json` 新增了 `catalog:` 引用，对应的版本需存在于 ultrawork 根 catalog。
3. **新增 workspace 包** — 如果上游新增了 `@opencode-ai/*` 的 workspace 依赖，需决定是加入 ultrawork 的 workspaces 还是用 npm 版本。
4. **src-tauri/Cargo.toml 依赖变更** — Rust 侧依赖由上游独立管理，补丁仅覆盖 tauri 版本和 `[patch.crates-io]`，其余变更会被 rsync 自然带入。

---

## 操作流程

```
1.  cd opencode && git pull          # 拉取上游最新代码
2.  cd ultrawork
3.  bun scripts/sync-from-monorepo.ts ../   # 或指定 monorepo 绝对路径
4.  git diff                         # 检查变更
5.  bun install                      # 更新依赖
6.  bun run typecheck                # 验证类型
7.  bun tauri dev                    # 验证运行
8.  git add -A && git commit         # 提交
```

---

## 补丁稳定性

当前 6 个补丁都是简单的字符串替换，只要上游不改变被替换的那行就不会冲突。具体：

| 补丁 | 失效条件 | 可能性 |
|---|---|---|
| `publicDir` | 上游改 vite.config.ts 的 publicDir | 低 |
| `tsconfig references` | 上游改 tsconfig 的 project references | 低 |
| `i18n imports` | 上游增减 i18n 语言文件 | 中（新增语言时需同步补丁） |
| `cli.rs include_str` | 上游移动 install 脚本路径 | 低 |
| `Cargo.toml tauri` | 上游升级 tauri 版本 | 中（届时只需更新补丁中的目标版本） |
| `Cargo.toml patch` | 上游移除 git patch | 高（届时此补丁自然失效，无害） |

脚本应在每次 sed 替换后检查是否成功（目标字符串是否存在），替换失败时打印警告而非静默跳过。

---

## catalog 版本同步

ultrawork 根 `package.json` 中的 `workspaces.catalog` 必须包含所有子包 `catalog:` 引用的版本。同步时需要对比：

```bash
# 检查 monorepo 根 catalog 是否有新版本
diff <(jq -S '.workspaces.catalog' /path/to/opencode/package.json) \
     <(jq -S '.workspaces.catalog' ultrawork/package.json)
```

脚本应自动检测差异并提示更新。
