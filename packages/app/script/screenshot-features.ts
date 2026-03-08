#!/usr/bin/env bun
/**
 * Feature screenshot capture script.
 *
 * Takes annotated screenshots of each app feature with red box highlights.
 * Uses the same server setup as e2e-local.ts.
 *
 * Usage:
 *   cd packages/app
 *   bun script/screenshot-features.ts
 */

import fs from "node:fs/promises"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import { chromium, type Page, type Locator } from "@playwright/test"
import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"
import { base64Encode } from "@opencode-ai/util/encode"

// ── helpers ──────────────────────────────────────────────────────────────

const IMG_DIR = path.resolve(import.meta.dirname, "../../../spec/img")

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
  if (process.env.OPENCODE_BIN) return process.env.OPENCODE_BIN
  const target = detectRustTarget()
  const sidecar = path.resolve(
    import.meta.dirname,
    "../../desktop/src-tauri/sidecars",
    `opencode-cli-${target}`,
  )
  if (await fs.access(sidecar).then(() => true).catch(() => false)) return sidecar
  const which = Bun.spawnSync(["which", "opencode"])
  if (which.exitCode === 0) return which.stdout.toString().trim()
  throw new Error("opencode binary not found.")
}

/**
 * Draw a red rectangle overlay on page at given bounding box,
 * then take a screenshot, then remove the overlay.
 */
async function screenshotWithRedBox(
  page: Page,
  filePath: string,
  boxes: Array<{ x: number; y: number; width: number; height: number; label?: string }>,
) {
  // Inject red box overlays
  await page.evaluate((boxes) => {
    for (const box of boxes) {
      const el = document.createElement("div")
      el.className = "__screenshot-redbox__"
      el.style.cssText = `
        position: fixed;
        left: ${box.x}px;
        top: ${box.y}px;
        width: ${box.width}px;
        height: ${box.height}px;
        border: 3px solid red;
        border-radius: 4px;
        z-index: 99999;
        pointer-events: none;
      `
      if (box.label) {
        const label = document.createElement("div")
        label.textContent = box.label
        label.style.cssText = `
          position: absolute;
          top: -22px;
          left: -3px;
          background: red;
          color: white;
          font-size: 12px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 3px 3px 0 0;
          white-space: nowrap;
          font-family: sans-serif;
        `
        el.appendChild(label)
      }
      document.body.appendChild(el)
    }
  }, boxes)

  await page.screenshot({ path: filePath, fullPage: false })

  // Remove overlays
  await page.evaluate(() => {
    document.querySelectorAll(".__screenshot-redbox__").forEach((el) => el.remove())
  })
  console.log(`  ✓ ${path.basename(filePath)}`)
}

async function getBox(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error("Element not visible")
  return box
}

async function screenshotElement(
  page: Page,
  filePath: string,
  selectors: Array<{ selector: string | Locator; label: string }>,
) {
  const boxes: Array<{ x: number; y: number; width: number; height: number; label: string }> = []
  for (const { selector, label } of selectors) {
    try {
      const locator = typeof selector === "string" ? page.locator(selector).first() : selector
      const visible = await locator.isVisible().catch(() => false)
      if (!visible) {
        console.log(`    ⚠ Skipping "${label}" — not visible`)
        continue
      }
      const box = await getBox(locator)
      boxes.push({ ...box, label })
    } catch (e) {
      console.log(`    ⚠ Skipping "${label}" — ${(e as Error).message}`)
    }
  }
  if (boxes.length > 0 || selectors.length === 0) {
    await screenshotWithRedBox(page, filePath, boxes)
  }
}

// ── main ─────────────────────────────────────────────────────────────────

const appDir = path.resolve(import.meta.dirname, "..")
const repoDir = path.resolve(appDir, "../..")

await fs.mkdir(IMG_DIR, { recursive: true })

const [serverPort, webPort] = await Promise.all([freePort(), freePort()])
const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-screenshot-"))

const serverEnv: Record<string, string> = {
  ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]),
  OPENCODE_DISABLE_SHARE: "true",
  OPENCODE_DISABLE_LSP_DOWNLOAD: "true",
  OPENCODE_DISABLE_DEFAULT_PLUGINS: "true",
  OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: "true",
  OPENCODE_TEST_HOME: path.join(sandbox, "home"),
  XDG_DATA_HOME: path.join(sandbox, "share"),
  XDG_CACHE_HOME: path.join(sandbox, "cache"),
  XDG_CONFIG_HOME: path.join(sandbox, "config"),
  XDG_STATE_HOME: path.join(sandbox, "state"),
  OPENCODE_E2E_PROJECT_DIR: repoDir,
  OPENCODE_CLIENT: "app",
}

let server: ReturnType<typeof Bun.spawn> | undefined
let devServer: ReturnType<typeof Bun.spawn> | undefined

const cleanup = async () => {
  if (server?.exitCode === null) server.kill("SIGTERM")
  if (devServer?.exitCode === null) devServer.kill("SIGTERM")
  await fs.rm(sandbox, { recursive: true, force: true }).catch(() => {})
}

process.once("SIGINT", () => { void cleanup().finally(() => process.exit(130)) })
process.once("SIGTERM", () => { void cleanup().finally(() => process.exit(143)) })

try {
  // 1. Start opencode server
  const bin = await resolveOpencodeBin()
  console.log(`Using opencode binary: ${bin}`)

  server = Bun.spawn(
    [bin, "serve", "--port", String(serverPort), "--hostname", "127.0.0.1"],
    { env: serverEnv, stdout: "inherit", stderr: "inherit" },
  )

  const serverUrl = `http://127.0.0.1:${serverPort}`
  console.log(`Waiting for opencode server at ${serverUrl}...`)
  await waitForHealth(`${serverUrl}/global/health`)
  console.log("opencode server is ready")

  // 2. Seed a test session
  const sdk = createOpencodeClient({ baseUrl: serverUrl, directory: repoDir, throwOnError: false })
  const sessionResult = await sdk.session.create({ title: "Feature Demo Session" })
  const sessionId = sessionResult.data?.id
  console.log(`Seeded session: ${sessionId}`)

  // 3. Start vite dev server
  devServer = Bun.spawn(
    ["bun", "run", "dev", "--", "--host", "0.0.0.0", "--port", String(webPort)],
    {
      cwd: appDir,
      env: {
        ...serverEnv,
        VITE_OPENCODE_SERVER_HOST: "127.0.0.1",
        VITE_OPENCODE_SERVER_PORT: String(serverPort),
      },
      stdout: "inherit",
      stderr: "inherit",
    },
  )

  const webUrl = `http://127.0.0.1:${webPort}`
  console.log(`Waiting for vite dev server at ${webUrl}...`)
  await waitForHealth(webUrl, 60_000)
  console.log("Vite dev server is ready")

  // 4. Launch browser
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()

  // Seed localStorage with project data
  const dirSlug = base64Encode(repoDir)
  await page.addInitScript(
    (args: { serverUrl: string; directory: string }) => {
      localStorage.setItem(
        "opencode.global.dat:server",
        JSON.stringify({
          list: [],
          projects: {
            local: [{ worktree: args.directory, expanded: true }],
            [args.serverUrl]: [{ worktree: args.directory, expanded: true }],
          },
          lastProject: {},
        }),
      )
      localStorage.setItem(
        "opencode.global.dat:model",
        JSON.stringify({
          recent: [{ providerID: "opencode", modelID: "big-pickle" }],
          user: [],
          variant: {},
        }),
      )
    },
    { serverUrl, directory: repoDir },
  )

  // ── Screenshot: Home page ──────────────────────────────────────────

  console.log("\n📸 Home page")
  await page.goto(webUrl)
  await page.waitForTimeout(2000)

  // Full page
  await screenshotWithRedBox(page, path.join(IMG_DIR, "01-home-full.png"), [])

  // Home with annotations
  await screenshotElement(page, path.join(IMG_DIR, "01-home-annotated.png"), [
    { selector: page.locator("svg").first(), label: "Logo" },
    { selector: page.getByRole("button", { name: /127\.0\.0\.1|localhost/i }).first(), label: "Server Status" },
    { selector: page.getByText("Recent projects", { exact: false }).first(), label: "Recent Projects" },
    { selector: page.getByRole("button", { name: /open project/i }).first(), label: "Open Project" },
  ])

  // ── Screenshot: Session page ───────────────────────────────────────

  console.log("\n📸 Session page")
  const sessionUrl = `${webUrl}/${dirSlug}/session${sessionId ? `/${sessionId}` : ""}`
  await page.goto(sessionUrl)
  await page.waitForTimeout(3000)

  // Full session view
  await screenshotWithRedBox(page, path.join(IMG_DIR, "02-session-full.png"), [])

  // Session layout with major regions annotated
  await screenshotElement(page, path.join(IMG_DIR, "02-session-layout.png"), [
    { selector: '[data-component="sidebar-nav-desktop"]', label: "Sidebar" },
    { selector: '[data-component="prompt-input"]', label: "Composer" },
    { selector: '[data-session-title]', label: "Session Header" },
  ])

  // ── Screenshot: Sidebar ────────────────────────────────────────────

  console.log("\n📸 Sidebar")
  // Open sidebar
  const sidebarToggle = page.getByRole("button", { name: /toggle sidebar/i }).first()
  if (await sidebarToggle.isVisible()) {
    const expanded = await sidebarToggle.getAttribute("aria-expanded")
    if (expanded !== "true") {
      await sidebarToggle.click()
      await page.waitForTimeout(500)
    }
  }

  await screenshotElement(page, path.join(IMG_DIR, "03-sidebar.png"), [
    { selector: '[data-component="sidebar-nav-desktop"]', label: "Sidebar Navigation" },
  ])

  // ── Screenshot: Composer/Prompt ────────────────────────────────────

  console.log("\n📸 Composer")
  const promptInput = page.locator('[data-component="prompt-input"]').first()
  if (await promptInput.isVisible()) {
    await promptInput.click()
    await page.waitForTimeout(300)
  }

  await screenshotElement(page, path.join(IMG_DIR, "04-composer.png"), [
    { selector: '[data-component="prompt-input"]', label: "Prompt Input" },
  ])

  // ── Screenshot: Command Palette ────────────────────────────────────

  console.log("\n📸 Command Palette")
  const modKey = process.platform === "darwin" ? "Meta" : "Control"
  // Defocus first
  await page.evaluate(() => {
    const el = document.activeElement
    if (el instanceof HTMLElement) el.blur()
  })
  await page.keyboard.press(`${modKey}+p`)
  await page.waitForTimeout(500)

  const paletteDialog = page.getByRole("dialog").first()
  if (await paletteDialog.isVisible()) {
    await screenshotElement(page, path.join(IMG_DIR, "05-command-palette.png"), [
      { selector: paletteDialog, label: "Command Palette" },
    ])
    await page.keyboard.press("Escape")
    await page.waitForTimeout(300)
  }

  // ── Screenshot: Settings Dialog ────────────────────────────────────

  console.log("\n📸 Settings")
  await page.evaluate(() => {
    const el = document.activeElement
    if (el instanceof HTMLElement) el.blur()
  })
  await page.keyboard.press(`${modKey}+,`)
  await page.waitForTimeout(1000)

  const settingsDialog = page.getByRole("dialog").first()
  if (await settingsDialog.isVisible()) {
    // General tab
    await screenshotElement(page, path.join(IMG_DIR, "06-settings-general.png"), [
      { selector: settingsDialog, label: "Settings - General" },
    ])

    // Try clicking Keyboard tab
    const keybindsTab = settingsDialog.getByRole("tab", { name: /keyboard|keybind|shortcut/i }).first()
    if (await keybindsTab.isVisible().catch(() => false)) {
      await keybindsTab.click()
      await page.waitForTimeout(500)
      await screenshotElement(page, path.join(IMG_DIR, "06-settings-keybinds.png"), [
        { selector: settingsDialog, label: "Settings - Keyboard Shortcuts" },
      ])
    }

    // Try clicking Providers tab
    const providersTab = settingsDialog.getByRole("tab", { name: /provider/i }).first()
    if (await providersTab.isVisible().catch(() => false)) {
      await providersTab.click()
      await page.waitForTimeout(500)
      await screenshotElement(page, path.join(IMG_DIR, "06-settings-providers.png"), [
        { selector: settingsDialog, label: "Settings - Providers" },
      ])
    }

    // Try clicking Models tab
    const modelsTab = settingsDialog.getByRole("tab", { name: /model/i }).first()
    if (await modelsTab.isVisible().catch(() => false)) {
      await modelsTab.click()
      await page.waitForTimeout(500)
      await screenshotElement(page, path.join(IMG_DIR, "06-settings-models.png"), [
        { selector: settingsDialog, label: "Settings - Models" },
      ])
    }

    await page.keyboard.press("Escape")
    await page.waitForTimeout(300)
  }

  // ── Screenshot: Session Header detail ──────────────────────────────

  console.log("\n📸 Session Header")
  await screenshotElement(page, path.join(IMG_DIR, "07-session-header.png"), [
    { selector: '[data-session-title]', label: "Session Title & Controls" },
    { selector: '#opencode-titlebar-right', label: "Titlebar Actions" },
  ])

  // ── Screenshot: Review Panel ───────────────────────────────────────

  console.log("\n📸 Review Panel")
  // The review panel is on the right side of session view
  // Annotate the Review tab area and the Changes/All files tabs
  await screenshotElement(page, path.join(IMG_DIR, "10-review-panel.png"), [
    { selector: page.getByText("Review").first(), label: "Review Tab" },
    { selector: page.getByText("0 Changes").first(), label: "Changes Tab" },
    { selector: page.getByText("All files").first(), label: "All Files Tab" },
  ])

  // ── Screenshot: Composer Toolbar ───────────────────────────────────

  console.log("\n📸 Composer Toolbar")
  // The toolbar below prompt input: Build, Model, Default, Terminal, etc.
  await screenshotElement(page, path.join(IMG_DIR, "11-composer-toolbar.png"), [
    { selector: page.getByText("Build", { exact: true }).first(), label: "Agent Selector" },
    { selector: page.getByText("Big Pickle").first(), label: "Model Selector" },
    { selector: page.getByText("Default", { exact: true }).first(), label: "Thinking Level" },
    { selector: '[data-component="prompt-input"]', label: "Prompt Input" },
  ])

  // ── Screenshot: Terminal Panel ─────────────────────────────────────

  console.log("\n📸 Terminal Panel")
  // Try to open terminal via keyboard shortcut
  await page.evaluate(() => {
    const el = document.activeElement
    if (el instanceof HTMLElement) el.blur()
  })
  await page.keyboard.press("Control+`")
  await page.waitForTimeout(1500)

  const terminal = page.locator('[data-component="terminal"]').first()
  if (await terminal.isVisible().catch(() => false)) {
    await screenshotElement(page, path.join(IMG_DIR, "12-terminal-panel.png"), [
      { selector: terminal, label: "Terminal Panel" },
    ])
    // Close terminal
    await page.keyboard.press("Control+`")
    await page.waitForTimeout(500)
  } else {
    console.log("    ⚠ Terminal not visible, taking full page with annotation attempt")
    await screenshotWithRedBox(page, path.join(IMG_DIR, "12-terminal-panel.png"), [])
  }

  // ── Screenshot: Status Popover ─────────────────────────────────────

  console.log("\n📸 Status Popover")
  await page.evaluate(() => {
    const el = document.activeElement
    if (el instanceof HTMLElement) el.blur()
  })
  // Click the status dot/button in titlebar right
  const statusTrigger = page.locator('#opencode-titlebar-right').getByRole("button").first()
  if (await statusTrigger.isVisible().catch(() => false)) {
    await statusTrigger.click()
    await page.waitForTimeout(800)
    const popoverBody = page.locator('[data-slot="popover-body"]').first()
    if (await popoverBody.isVisible().catch(() => false)) {
      await screenshotElement(page, path.join(IMG_DIR, "13-status-popover.png"), [
        { selector: popoverBody, label: "Status Popover" },
      ])
      await page.keyboard.press("Escape")
      await page.waitForTimeout(300)
    } else {
      console.log("    ⚠ Status popover not visible")
    }
  }

  // ── Screenshot: Mobile layout ──────────────────────────────────────

  console.log("\n📸 Mobile layout")
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(sessionUrl)
  await page.waitForTimeout(2000)

  // Mobile session view
  await screenshotElement(page, path.join(IMG_DIR, "08-mobile-session.png"), [
    { selector: page.getByText("Session", { exact: true }).first(), label: "Session Tab" },
    { selector: page.getByText("Changes", { exact: true }).first(), label: "Changes Tab" },
  ])

  // Mobile Changes tab
  const changesTab = page.getByText("Changes", { exact: true }).first()
  if (await changesTab.isVisible().catch(() => false)) {
    await changesTab.click()
    await page.waitForTimeout(500)
    await screenshotWithRedBox(page, path.join(IMG_DIR, "08-mobile-changes.png"), [])
  }

  // Mobile home
  await page.goto(webUrl)
  await page.waitForTimeout(2000)
  await screenshotWithRedBox(page, path.join(IMG_DIR, "08-mobile-home.png"), [])

  // Restore desktop viewport
  await page.setViewportSize({ width: 1440, height: 900 })

  // ── Screenshot: Home (empty state) ─────────────────────────────────

  console.log("\n📸 Home (empty state)")
  // Create a new context without seeded projects to get empty home
  const emptyContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const emptyPage = await emptyContext.newPage()
  await emptyPage.goto(webUrl)
  await emptyPage.waitForTimeout(2000)

  await screenshotElement(emptyPage, path.join(IMG_DIR, "01-home-empty.png"), [
    { selector: emptyPage.getByRole("button", { name: /open project/i }).first(), label: "Open Project" },
    { selector: emptyPage.getByRole("button", { name: /127\.0\.0\.1|localhost/i }).first(), label: "Server Status" },
  ])
  await emptyPage.close()
  await emptyContext.close()

  // ── SDK seeding helpers (adapted from e2e/actions.ts) ──────────────

  const seedSystem = [
    "You are seeding deterministic e2e UI state.",
    "Follow the user's instruction exactly.",
    "When asked to call a tool, call exactly that tool exactly once with the exact JSON input.",
    "Do not call any extra tools.",
  ].join(" ")

  async function poll<T>(probe: () => Promise<T | undefined>, timeout = 30_000): Promise<T | undefined> {
    const end = Date.now() + timeout
    while (Date.now() < end) {
      const value = await probe()
      if (value !== undefined) return value
      await new Promise((r) => setTimeout(r, 250))
    }
    return undefined
  }

  async function seedPrompt<T>(opts: {
    prompt: string
    probe: () => Promise<T | undefined>
    timeout?: number
  }): Promise<T | undefined> {
    for (let i = 0; i < 2; i++) {
      await sdk.session.promptAsync({
        sessionID: sessionId!,
        agent: "build",
        system: seedSystem,
        parts: [{ type: "text", text: opts.prompt }],
      })
      const value = await poll(opts.probe, opts.timeout)
      if (value !== undefined) return value
    }
    return undefined
  }

  // ── Screenshot: Message Timeline ───────────────────────────────────

  console.log("\n📸 Message Timeline")
  try {
    // Send a simple prompt to generate messages
    await sdk.session.promptAsync({
      sessionID: sessionId!,
      parts: [{ type: "text", text: "Say exactly: Hello! This is a demo message for the screenshot." }],
    })

    // Wait for messages to appear
    const hasMessages = await poll(async () => {
      const msgs = await sdk.session.messages({ sessionID: sessionId!, limit: 10 }).then((x) => x.data ?? []).catch(() => [])
      return msgs.length >= 2 ? true : undefined
    }, 30_000)

    if (hasMessages) {
      // Wait for the session to be idle
      await poll(async () => {
        const statuses = await sdk.session.status().then((x) => x.data ?? {}).catch(() => ({})) as Record<string, any>
        const s = statuses[sessionId!]
        return (!s || s.type === "idle") ? true : undefined
      }, 30_000)

      await page.goto(sessionUrl)
      await page.waitForTimeout(3000)

      // Wait for message elements to appear in DOM
      const msgVisible = await page.locator('[data-message-id]').first().isVisible().catch(() => false)
      if (msgVisible) {
        // Use the scroll viewport that contains messages as the "timeline"
        await screenshotElement(page, path.join(IMG_DIR, "14-message-timeline.png"), [
          { selector: page.locator('[data-message-id]').first(), label: "User Message" },
          { selector: page.locator('[data-message-id]').nth(1), label: "Assistant Response" },
        ])
      } else {
        console.log("    ⚠ Message elements not visible in DOM, taking full page")
        await screenshotWithRedBox(page, path.join(IMG_DIR, "14-message-timeline.png"), [])
      }
    } else {
      console.log("    ⚠ Could not seed messages")
    }
  } catch (e) {
    console.log(`    ⚠ Message timeline failed: ${(e as Error).message}`)
  }

  // ── Screenshot: Question Dock ──────────────────────────────────────

  console.log("\n📸 Question Dock")
  try {
    const questionPrompt = [
      "Your only valid response is one question tool call.",
      `Use this JSON input: ${JSON.stringify({
        questions: [{
          header: "Select a framework",
          question: "Which framework would you like to use for this project?",
          options: [
            { label: "React", description: "A popular UI library" },
            { label: "SolidJS", description: "Fine-grained reactivity" },
            { label: "Vue", description: "Progressive framework" },
          ],
        }],
      })}`,
      "Do not output plain text.",
      "After calling the tool, wait for the user response.",
    ].join("\n")

    const questionResult = await seedPrompt({
      prompt: questionPrompt,
      timeout: 30_000,
      probe: async () => {
        const list = await sdk.question.list().then((x) => x.data ?? []).catch(() => [])
        return list.find((item: any) => item.sessionID === sessionId && item.questions[0]?.header === "Select a framework")
      },
    })

    if (questionResult) {
      await page.goto(sessionUrl)
      await page.waitForTimeout(2000)

      const questionDock = page.locator('[data-component="dock-prompt"][data-kind="question"]').first()
      if (await questionDock.isVisible().catch(() => false)) {
        await screenshotElement(page, path.join(IMG_DIR, "15-question-dock.png"), [
          { selector: questionDock, label: "Question Dock" },
        ])
      } else {
        console.log("    ⚠ Question dock not visible after seeding")
      }

      // Reject to clean up
      await sdk.question.reject({ requestID: (questionResult as any).id }).catch(() => {})
      await page.waitForTimeout(500)
    } else {
      console.log("    ⚠ Could not seed question")
    }
  } catch (e) {
    console.log(`    ⚠ Question dock failed: ${(e as Error).message}`)
  }

  // ── Screenshot: Permission Dock ────────────────────────────────────

  console.log("\n📸 Permission Dock")
  try {
    const permissionPrompt = [
      "Your only valid response is one bash tool call.",
      `Use this JSON input: ${JSON.stringify({
        command: "ls /tmp",
        workdir: "/",
        description: "List temporary files",
      })}`,
      "Do not output plain text.",
    ].join("\n")

    const permissionResult = await seedPrompt({
      prompt: permissionPrompt,
      timeout: 30_000,
      probe: async () => {
        const list = await sdk.permission.list().then((x) => x.data ?? []).catch(() => [])
        return list.find((item: any) => item.sessionID === sessionId)
      },
    })

    if (permissionResult) {
      await page.goto(sessionUrl)
      await page.waitForTimeout(2000)

      const permissionDock = page.locator('[data-component="dock-prompt"][data-kind="permission"]').first()
      if (await permissionDock.isVisible().catch(() => false)) {
        await screenshotElement(page, path.join(IMG_DIR, "16-permission-dock.png"), [
          { selector: permissionDock, label: "Permission Dock" },
        ])
      } else {
        console.log("    ⚠ Permission dock not visible after seeding")
      }

      // Reject to clean up
      await sdk.permission.reply({ requestID: (permissionResult as any).id, reply: "reject" }).catch(() => {})
      await page.waitForTimeout(500)
    } else {
      console.log("    ⚠ Could not seed permission")
    }
  } catch (e) {
    console.log(`    ⚠ Permission dock failed: ${(e as Error).message}`)
  }

  // ── Screenshot: Todo Dock ──────────────────────────────────────────

  console.log("\n📸 Todo Dock")
  try {
    const todos = [
      { content: "Set up project structure", status: "completed", priority: "high" },
      { content: "Implement authentication", status: "in_progress", priority: "high" },
      { content: "Write unit tests", status: "pending", priority: "medium" },
      { content: "Update documentation", status: "pending", priority: "low" },
    ]

    const todoPrompt = [
      "Your only valid response is one todowrite tool call.",
      `Use this JSON input: ${JSON.stringify({ todos })}`,
      "Do not output plain text.",
    ].join("\n")

    const todoResult = await seedPrompt({
      prompt: todoPrompt,
      timeout: 30_000,
      probe: async () => {
        const list = await sdk.session.todo({ sessionID: sessionId! }).then((x) => x.data ?? []).catch(() => [])
        return list.length >= todos.length ? true : undefined
      },
    })

    if (todoResult) {
      await page.goto(sessionUrl)
      await page.waitForTimeout(2000)

      // Click the todo toggle to show the dock
      const todoToggle = page.locator('[data-action="session-todo-toggle-button"]').first()
      if (await todoToggle.isVisible().catch(() => false)) {
        await todoToggle.click()
        await page.waitForTimeout(500)
      }

      const todoDock = page.locator('[data-component="session-todo-dock"]').first()
      if (await todoDock.isVisible().catch(() => false)) {
        await screenshotElement(page, path.join(IMG_DIR, "17-todo-dock.png"), [
          { selector: todoDock, label: "Todo Dock" },
        ])
      } else {
        console.log("    ⚠ Todo dock not visible after seeding")
      }
    } else {
      console.log("    ⚠ Could not seed todos")
    }
  } catch (e) {
    console.log(`    ⚠ Todo dock failed: ${(e as Error).message}`)
  }

  // ── Screenshot: File Tabs (via Mod+P file open) ─────────────────────

  console.log("\n📸 File Tabs")
  try {
    await page.goto(sessionUrl)
    await page.waitForTimeout(2000)

    // Defocus and use Mod+P to open file search (same keybind as /open command)
    await page.evaluate(() => {
      const el = document.activeElement
      if (el instanceof HTMLElement) el.blur()
    })
    await page.keyboard.press(`${modKey}+p`)
    await page.waitForTimeout(800)

    const fileDialog = page.getByRole("dialog").first()
    if (await fileDialog.isVisible().catch(() => false)) {
      // Type a filename to search
      const searchInput = fileDialog.getByRole("textbox").first()
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill("package.json")
        await page.waitForTimeout(800)

        // Click the first result to open it
        const listItem = fileDialog.locator('[data-slot="list-item"]').first()
        if (await listItem.isVisible().catch(() => false)) {
          await listItem.click()
          await page.waitForTimeout(1500)

          // Screenshot — look for tabs in the side panel
          // The file tab should now be visible in the editor area
          await screenshotWithRedBox(page, path.join(IMG_DIR, "18-file-tabs.png"), [])
        } else {
          console.log("    ⚠ No file search results")
          await page.keyboard.press("Escape")
        }
      } else {
        await page.keyboard.press("Escape")
      }
    } else {
      console.log("    ⚠ File dialog not visible")
    }
  } catch (e) {
    console.log(`    ⚠ File tabs failed: ${(e as Error).message}`)
  }

  // ── Screenshot: Slash command / @ mention ──────────────────────────

  console.log("\n📸 Slash commands")
  await page.goto(sessionUrl)
  await page.waitForTimeout(2000)

  const promptInput2 = page.locator('[data-component="prompt-input"]').first()
  if (await promptInput2.isVisible()) {
    await promptInput2.click()
    await page.waitForTimeout(200)
    await page.keyboard.type("/")
    await page.waitForTimeout(500)

    const slashPopover = page.locator('[data-component="prompt-popover"]').first()
    if (await slashPopover.isVisible().catch(() => false)) {
      await screenshotElement(page, path.join(IMG_DIR, "09-slash-commands.png"), [
        { selector: slashPopover, label: "Slash Commands" },
      ])
    } else {
      console.log("    ⚠ Slash popover not visible, taking full page screenshot")
      await screenshotWithRedBox(page, path.join(IMG_DIR, "09-slash-commands.png"), [])
    }

    // Clear and try @ mention
    await page.keyboard.press("Backspace")
    await page.waitForTimeout(200)
    await page.keyboard.type("@")
    await page.waitForTimeout(500)

    const mentionPopover = page.locator('[data-component="prompt-popover"]').first()
    if (await mentionPopover.isVisible().catch(() => false)) {
      await screenshotElement(page, path.join(IMG_DIR, "09-at-mention.png"), [
        { selector: mentionPopover, label: "@ Mention" },
      ])
    } else {
      console.log("    ⚠ @ mention popover not visible, taking full page screenshot")
      await screenshotWithRedBox(page, path.join(IMG_DIR, "09-at-mention.png"), [])
    }
  }

  // ── Done ───────────────────────────────────────────────────────────

  await browser.close()
  console.log(`\n✅ Screenshots saved to ${IMG_DIR}`)
  console.log(`   Total files: ${(await fs.readdir(IMG_DIR)).length}`)

} catch (error) {
  console.error("Screenshot script failed:", error)
  process.exitCode = 1
} finally {
  await cleanup()
}
