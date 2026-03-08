import { test, expect } from "../../fixtures"

test.describe("Settings — Provider Models Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("opencode.global.dat:language", JSON.stringify({ locale: "en" }))
    })
    await page.goto("/")
    await expect(page.locator('[data-component="v2-layout"]')).toBeVisible()
  })

  async function openProviderModels(page: import("@playwright/test").Page) {
    await page.locator('[data-action="open-settings-popover"]').click()
    await expect(page.locator('[data-component="settings-popover-menu"]')).toBeVisible()
    await page.locator('[data-action="settings-popover-providers"]').click()
    const dialog = page.locator('[data-slot="dialog-content"]')
    await expect(dialog).toBeVisible()
    return dialog
  }

  test("clicking providers menu item opens provider models dialog", async ({ page }) => {
    const dialog = await openProviderModels(page)

    // Popover should close
    await expect(page.locator('[data-component="settings-popover-menu"]')).not.toBeVisible()

    // Dialog should have tabs
    const tabs = dialog.locator('[data-component="tabs"]')
    await expect(tabs).toBeVisible()
  })

  test("dialog has Providers and Models tabs", async ({ page }) => {
    const dialog = await openProviderModels(page)

    await expect(dialog.locator('[data-slot="tabs-trigger"][data-value="providers"]')).toBeVisible()
    await expect(dialog.locator('[data-slot="tabs-trigger"][data-value="models"]')).toBeVisible()
  })

  test("Providers tab is active by default and shows providers content", async ({ page }) => {
    const dialog = await openProviderModels(page)

    // Should show Providers heading
    const heading = dialog.locator("h2")
    await expect(heading).toContainText("Providers")

    // Should have connected providers section
    await expect(dialog.locator('[data-component="connected-providers-section"]')).toBeVisible()
  })

  test("switching to Models tab shows models content", async ({ page }) => {
    const dialog = await openProviderModels(page)

    await dialog.locator('[data-slot="tabs-trigger"][data-value="models"]').click()

    // Should show Models heading
    const heading = dialog.locator("h2")
    await expect(heading).toContainText("Models")
  })

  test("can switch between Providers and Models tabs", async ({ page }) => {
    const dialog = await openProviderModels(page)

    // Start on Providers
    await expect(dialog.locator('[data-component="connected-providers-section"]')).toBeVisible()

    // Switch to Models
    await dialog.locator('[data-slot="tabs-trigger"][data-value="models"]').click()
    await expect(dialog.locator('[data-component="connected-providers-section"]')).not.toBeVisible()

    // Switch back to Providers
    await dialog.locator('[data-slot="tabs-trigger"][data-value="providers"]').click()
    await expect(dialog.locator('[data-component="connected-providers-section"]')).toBeVisible()
  })

  test("dialog closes via Escape key", async ({ page }) => {
    const dialog = await openProviderModels(page)
    await expect(dialog).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(dialog).not.toBeVisible()
  })
})
