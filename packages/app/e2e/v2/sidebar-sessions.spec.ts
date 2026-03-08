import { test, expect } from "../fixtures"
import type { Page } from "@playwright/test"
import { cleanupSession, cleanupTestProject, createTestProject, seedProjects } from "../actions"
import { createSdk, dirSlug } from "../utils"

/**
 * These tests use a standalone test project to avoid directory resolution issues
 * (the layout context's rootFor rewrites git worktree directories to their parent).
 */

async function seedStorage(page: Page, directory: string) {
  await seedProjects(page, { directory })
  await page.addInitScript(() => {
    localStorage.setItem(
      "opencode.global.dat:model",
      JSON.stringify({
        recent: [{ providerID: "opencode", modelID: "big-pickle" }],
        user: [],
        variant: {},
      }),
    )
  })
}

test("session list shows sessions created via SDK", async ({ page }) => {
  const directory = await createTestProject()
  const sdk = createSdk(directory)
  await seedStorage(page, directory)

  const stamp = Date.now()
  const title = `e2e v2 sidebar session ${stamp}`
  const session = await sdk.session.create({ title }).then((r) => r.data)
  if (!session?.id) throw new Error("Session create did not return an id")

  try {
    await page.goto("/")
    const sidebar = page.locator('[data-component="v2-sidebar"]')
    await expect(sidebar).toBeVisible()

    // Session should appear in the task list
    const sessionItem = sidebar.locator(`[data-session-id="${session.id}"]`)
    await expect(sessionItem).toBeVisible({ timeout: 10_000 })
    await expect(sessionItem).toContainText(title)
  } finally {
    await cleanupSession({ sdk, sessionID: session.id })
    await cleanupTestProject(directory)
  }
})

test("clicking a session in the list navigates to task view", async ({ page }) => {
  const directory = await createTestProject()
  const sdk = createSdk(directory)
  await seedStorage(page, directory)

  const stamp = Date.now()
  const session = await sdk.session.create({ title: `e2e v2 nav ${stamp}` }).then((r) => r.data)
  if (!session?.id) throw new Error("Session create did not return an id")

  const slug = dirSlug(directory)

  try {
    await page.goto("/")
    const sidebar = page.locator('[data-component="v2-sidebar"]')

    // Wait for session to appear
    const sessionLink = sidebar.locator(`[data-session-id="${session.id}"] a`).first()
    await expect(sessionLink).toBeVisible({ timeout: 10_000 })

    // Click the session
    await sessionLink.click()

    // Should navigate to /task/:dir/:id
    await expect(page).toHaveURL(new RegExp(`/task/${slug}/${session.id}`))
  } finally {
    await cleanupSession({ sdk, sessionID: session.id })
    await cleanupTestProject(directory)
  }
})

test("multiple sessions are listed", async ({ page }) => {
  const directory = await createTestProject()
  const sdk = createSdk(directory)
  await seedStorage(page, directory)

  const stamp = Date.now()
  const s1 = await sdk.session.create({ title: `e2e v2 multi A ${stamp}` }).then((r) => r.data)
  const s2 = await sdk.session.create({ title: `e2e v2 multi B ${stamp}` }).then((r) => r.data)

  if (!s1?.id || !s2?.id) throw new Error("Session create did not return ids")

  try {
    await page.goto("/")
    const sidebar = page.locator('[data-component="v2-sidebar"]')

    // Both sessions should appear
    await expect(sidebar.locator(`[data-session-id="${s1.id}"]`)).toBeVisible({ timeout: 10_000 })
    await expect(sidebar.locator(`[data-session-id="${s2.id}"]`)).toBeVisible({ timeout: 10_000 })
  } finally {
    await cleanupSession({ sdk, sessionID: s1.id })
    await cleanupSession({ sdk, sessionID: s2.id })
    await cleanupTestProject(directory)
  }
})

test("archiving a session removes it from the list", async ({ page }) => {
  const directory = await createTestProject()
  const sdk = createSdk(directory)
  await seedStorage(page, directory)

  const stamp = Date.now()
  const session = await sdk.session.create({ title: `e2e v2 archive ${stamp}` }).then((r) => r.data)
  if (!session?.id) throw new Error("Session create did not return an id")

  try {
    await page.goto("/")
    const sidebar = page.locator('[data-component="v2-sidebar"]')
    const sessionItem = sidebar.locator(`[data-session-id="${session.id}"]`)
    await expect(sessionItem).toBeVisible({ timeout: 10_000 })

    // Hover to reveal archive button
    await sessionItem.hover()
    const archiveButton = sessionItem.getByRole("button", { name: /archive/i })
    await expect(archiveButton).toBeVisible()
    await archiveButton.click()

    // Session should disappear from the list
    await expect(sessionItem).not.toBeVisible({ timeout: 5_000 })
  } finally {
    // Cleanup even if already archived (idempotent)
    await cleanupSession({ sdk, sessionID: session.id }).catch(() => {})
    await cleanupTestProject(directory)
  }
})

test("new task button navigates to home from task view", async ({ page }) => {
  const directory = await createTestProject()
  const sdk = createSdk(directory)
  await seedStorage(page, directory)

  const stamp = Date.now()
  const session = await sdk.session.create({ title: `e2e v2 new btn ${stamp}` }).then((r) => r.data)
  if (!session?.id) throw new Error("Session create did not return an id")

  const slug = dirSlug(directory)

  try {
    // Navigate to a task view first
    await page.goto(`/task/${slug}/${session.id}`)
    await expect(page.locator('[data-component="v2-session"]')).toBeVisible({ timeout: 15_000 })

    // Click "New session" button in sidebar
    const sidebar = page.locator('[data-component="v2-sidebar"]')
    const newButton = sidebar.getByRole("button").filter({ hasText: /new session/i })
    await expect(newButton).toBeVisible()
    await newButton.click()

    // Should navigate back to home
    await expect(page).toHaveURL("/")
    await expect(page.locator('[data-component="v2-home"]')).toBeVisible()
  } finally {
    await cleanupSession({ sdk, sessionID: session.id })
    await cleanupTestProject(directory)
  }
})
