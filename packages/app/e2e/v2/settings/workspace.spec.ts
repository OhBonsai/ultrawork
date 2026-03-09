import { test, expect } from "../../fixtures"
import { createTestProject, cleanupTestProject, seedProjects } from "../../actions"

test.describe("Settings — Workspace Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("opencode.global.dat:language", JSON.stringify({ locale: "en" }))
    })
    await page.goto("/")
    await expect(page.locator('[data-component="v2-layout"]')).toBeVisible()
  })

  async function openWorkspace(page: import("@playwright/test").Page) {
    await page.locator('[data-action="open-settings-popover"]').click()
    await expect(page.locator('[data-component="settings-popover-menu"]')).toBeVisible()
    await page.locator('[data-action="settings-popover-workspace"]').click()
    const dialog = page.locator('[data-slot="dialog-content"]')
    await expect(dialog).toBeVisible()
    return dialog
  }

  test("clicking workspace menu item opens workspace dialog", async ({ page }) => {
    const dialog = await openWorkspace(page)

    // Popover should close
    await expect(page.locator('[data-component="settings-popover-menu"]')).not.toBeVisible()

    // Dialog should contain workspace component
    await expect(dialog.locator('[data-component="dialog-workspace"]')).toBeVisible()
  })

  test("workspace dialog has title", async ({ page }) => {
    const dialog = await openWorkspace(page)

    const heading = dialog.locator("h2")
    await expect(heading).toBeVisible()
  })

  test("workspace dialog has Directories and Environment tabs", async ({ page }) => {
    const dialog = await openWorkspace(page)

    await expect(dialog.locator('[data-slot="tabs-trigger"][data-value="directories"]')).toBeVisible()
    await expect(dialog.locator('[data-slot="tabs-trigger"][data-value="environment"]')).toBeVisible()
  })

  test("Directories tab is active by default", async ({ page }) => {
    const dialog = await openWorkspace(page)

    // Add directory button should be visible in directories tab
    await expect(dialog.locator('[data-action="workspace-add"]')).toBeVisible()
  })

  test("switching to Environment tab shows coming soon placeholder", async ({ page }) => {
    const dialog = await openWorkspace(page)

    await dialog.locator('[data-slot="tabs-trigger"][data-value="environment"]').click()

    // Add button should no longer be visible (it's in directories tab)
    await expect(dialog.locator('[data-action="workspace-add"]')).not.toBeVisible()
  })

  test("can switch between Directories and Environment tabs", async ({ page }) => {
    const dialog = await openWorkspace(page)

    // Start on Directories
    await expect(dialog.locator('[data-action="workspace-add"]')).toBeVisible()

    // Switch to Environment
    await dialog.locator('[data-slot="tabs-trigger"][data-value="environment"]').click()
    await expect(dialog.locator('[data-action="workspace-add"]')).not.toBeVisible()

    // Switch back to Directories
    await dialog.locator('[data-slot="tabs-trigger"][data-value="directories"]').click()
    await expect(dialog.locator('[data-action="workspace-add"]')).toBeVisible()
  })

  test("dialog closes via Escape key", async ({ page }) => {
    const dialog = await openWorkspace(page)
    await expect(dialog).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(dialog).not.toBeVisible()
  })

  test("clicking a workspace item switches the active workspace", async ({ page, directory }) => {
    // Create a second project directory
    const secondDir = await createTestProject()

    try {
      // Seed both directories into storage
      await seedProjects(page, { directory, extra: [secondDir] })
      await page.goto("/")
      await expect(page.locator('[data-component="v2-layout"]')).toBeVisible()

      // Open workspace dialog
      const dialog = await openWorkspace(page)

      // Both workspace items should be visible
      const firstItem = dialog.locator(`[data-component="workspace-item"][data-path="${directory}"]`)
      const secondItem = dialog.locator(`[data-component="workspace-item"][data-path="${secondDir}"]`)
      await expect(firstItem).toBeVisible()
      await expect(secondItem).toBeVisible()

      // Click the second workspace item to switch
      await secondItem.click()

      // Dialog should close after selection
      await expect(dialog).not.toBeVisible({ timeout: 3000 })

      // Re-open workspace dialog to verify the active workspace changed
      const dialog2 = await openWorkspace(page)
      const items = dialog2.locator('[data-component="workspace-item"]')

      // The first item in the list should now be the second directory (moved to front)
      const firstItemPath = await items.first().getAttribute("data-path")
      expect(firstItemPath).toBe(secondDir)
    } finally {
      await cleanupTestProject(secondDir)
    }
  })
})
