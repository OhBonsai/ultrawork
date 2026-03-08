#!/usr/bin/env bun
/**
 * Local e2e test runner for the standalone ultrawork project.
 *
 * Differences from the monorepo version:
 * - Starts opencode server via the CLI binary (sidecar) instead of direct TS import
 * - Seeds a test session via the public SDK API instead of internal module imports
 *
 * Binary resolution order:
 *   1. OPENCODE_BIN env var
 *   2. ../../desktop/src-tauri/sidecars/opencode-cli-{target}  (local sidecar)
 *   3. `opencode` on PATH
 *
 * Usage:
 *   cd packages/app
 *   bun script/e2e-local.ts
 *   bun script/e2e-local.ts -- --grep "sidebar"
 */

import fs from "node:fs/promises"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"

// ── helpers ────────────────────────────────────────────────────────────────

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once("error", reject)
    srv.listen(0, () => {
      const addr = srv.address()
      if (!addr || typeof addr === "string") {
        srv.close(() => reject(new Error("Failed to acquire a free port")))
        return
      }
      srv.close((err) => (err ? reject(err) : resolve(addr.port)))
    })
  })
}

async function waitForHealth(url: string, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ok = await fetch(url)
      .then((r) => r.ok)
      .catch(() => false)
    if (ok) return
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Timed out waiting for server health: ${url}`)
}

function detectRustTarget(): string {
  const p = process.platform
  const a = process.arch
  if (p === "darwin") return a === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin"
  if (p === "win32") return "x86_64-pc-windows-msvc"
  if (p === "linux") return a === "arm64" ? "aarch64-unknown-linux-gnu" : "x86_64-unknown-linux-gnu"
  throw new Error(`Unsupported platform: ${p}/${a}`)
}

async function resolveOpencodeBin(): Promise<string> {
  // 1. explicit env var
  if (process.env.OPENCODE_BIN) return process.env.OPENCODE_BIN

  // 2. sidecar next to desktop package
  const target = detectRustTarget()
  const sidecar = path.resolve(
    import.meta.dirname,
    "../../desktop/src-tauri/sidecars",
    `opencode-cli-${target}`,
  )
  if (
    await fs
      .access(sidecar)
      .then(() => true)
      .catch(() => false)
  ) {
    return sidecar
  }

  // 3. PATH
  const which = Bun.spawnSync(["which", "opencode"])
  if (which.exitCode === 0) return which.stdout.toString().trim()

  throw new Error(
    "opencode binary not found. Set OPENCODE_BIN, run predev.ts to download the sidecar, or install opencode globally.",
  )
}

// ── main ───────────────────────────────────────────────────────────────────

const appDir = process.cwd()
const repoDir = path.resolve(appDir, "../..")

const extraArgs = (() => {
  const args = process.argv.slice(2)
  return args[0] === "--" ? args.slice(1) : args
})()

const [serverPort, webPort] = await Promise.all([freePort(), freePort()])
const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-e2e-"))
const keepSandbox = process.env.OPENCODE_E2E_KEEP_SANDBOX === "1"

const serverEnv: Record<string, string> = {
  ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]),
  OPENCODE_DISABLE_SHARE: process.env.OPENCODE_DISABLE_SHARE ?? "true",
  OPENCODE_DISABLE_LSP_DOWNLOAD: "true",
  OPENCODE_DISABLE_DEFAULT_PLUGINS: "true",
  OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: "true",
  OPENCODE_TEST_HOME: path.join(sandbox, "home"),
  XDG_DATA_HOME: path.join(sandbox, "share"),
  XDG_CACHE_HOME: path.join(sandbox, "cache"),
  XDG_CONFIG_HOME: path.join(sandbox, "config"),
  XDG_STATE_HOME: path.join(sandbox, "state"),
  OPENCODE_E2E_PROJECT_DIR: repoDir,
  OPENCODE_E2E_SESSION_TITLE: "E2E Session",
  OPENCODE_E2E_MESSAGE: "Seeded for UI e2e",
  OPENCODE_E2E_MODEL: "opencode/gpt-5-nano",
  OPENCODE_CLIENT: "app",
}

const runnerEnv: Record<string, string> = {
  ...serverEnv,
  PLAYWRIGHT_SERVER_HOST: "127.0.0.1",
  PLAYWRIGHT_SERVER_PORT: String(serverPort),
  VITE_OPENCODE_SERVER_HOST: "127.0.0.1",
  VITE_OPENCODE_SERVER_PORT: String(serverPort),
  PLAYWRIGHT_PORT: String(webPort),
}

let server: ReturnType<typeof Bun.spawn> | undefined
let runner: ReturnType<typeof Bun.spawn> | undefined
let cleaned = false

const cleanup = async () => {
  if (cleaned) return
  cleaned = true
  if (server?.exitCode === null) server.kill("SIGTERM")
  if (runner?.exitCode === null) runner.kill("SIGTERM")
  if (!keepSandbox) await fs.rm(sandbox, { recursive: true, force: true }).catch(() => {})
}

const shutdown = (code: number, reason: string) => {
  process.exitCode = code
  void cleanup().finally(() => {
    console.error(`e2e-local shutdown: ${reason}`)
    process.exit(code)
  })
}

process.once("SIGINT", () => shutdown(130, "SIGINT"))
process.once("SIGTERM", () => shutdown(143, "SIGTERM"))
process.once("SIGHUP", () => shutdown(129, "SIGHUP"))
process.once("uncaughtException", (e) => { console.warn("uncaughtException", e) })
process.once("unhandledRejection", (e) => { console.warn("unhandledRejection", e) })

let code = 1

try {
  const bin = await resolveOpencodeBin()
  console.log(`Using opencode binary: ${bin}`)

  // Start opencode server as subprocess
  server = Bun.spawn(
    [bin, "serve", "--port", String(serverPort), "--hostname", "127.0.0.1"],
    { env: serverEnv, stdout: "inherit", stderr: "inherit" },
  )

  const serverUrl = `http://127.0.0.1:${serverPort}`
  console.log(`Waiting for opencode server at ${serverUrl}...`)
  await waitForHealth(`${serverUrl}/global/health`)
  console.log("opencode server is ready")

  // Seed a test session via SDK
  const sdk = createOpencodeClient({ baseUrl: serverUrl, directory: repoDir, throwOnError: false })
  const sessionResult = await sdk.session.create({ title: "E2E Session" })
  if (sessionResult.data) {
    console.log(`Seeded session: ${sessionResult.data.id}`)
  } else {
    console.warn("Failed to seed session, continuing anyway")
  }

  // Run playwright
  runner = Bun.spawn(["bun", "run", "test:e2e", ...extraArgs], {
    cwd: appDir,
    env: runnerEnv,
    stdout: "inherit",
    stderr: "inherit",
  })
  code = await runner.exited
} catch (error) {
  console.error(error)
  code = 1
} finally {
  await cleanup()
}

process.exit(code)
