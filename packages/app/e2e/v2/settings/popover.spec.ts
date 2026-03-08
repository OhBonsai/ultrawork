import { test, expect } from "../../fixtures"

test.describe("Settings Popover", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("opencode.global.dat:language", JSON.stringify({ locale: "en" }))
    })
    await page.goto("/")
    await expect(page.locator('[data-component="v2-layout"]')).toBeVisible()
  })

  test("opens settings popover from user profile area", async ({ page }) => {
    const trigger = page.locator('[data-action="open-settings-popover"]')
    await expect(trigger).toBeVisible()
    await trigger.click()

    const popover = page.locator('[data-component="settings-popover-menu"]')
    await expect(popover).toBeVisible()

    // Verify all menu items are visible
    await expect(page.locator('[data-action="settings-popover-settings"]')).toBeVisible()
    await expect(page.locator('[data-action="settings-popover-language"]')).toBeVisible()
    await expect(page.locator('[data-action="settings-popover-workspace"]')).toBeVisible()
    await expect(page.locator('[data-action="settings-popover-providers"]')).toBeVisible()
    await expect(page.locator('[data-action="settings-popover-channels"]')).toBeVisible()
    await expect(page.locator('[data-action="settings-popover-remote"]')).toBeVisible()
    await expect(page.locator('[data-action="settings-popover-help"]')).toBeVisible()
    await expect(page.locator('[data-action="settings-popover-about"]')).toBeVisible()
  })

  test("closes popover via close button", async ({ page }) => {
    await page.locator('[data-action="open-settings-popover"]').click()
    const popover = page.locator('[data-component="settings-popover-menu"]')
    await expect(popover).toBeVisible()

    await page.locator('[data-action="settings-popover-close"]').click()
    await expect(popover).not.toBeVisible()
  })

  test("opens settings dialog from popover", async ({ page }) => {
    await page.locator('[data-action="open-settings-popover"]').click()
    await expect(page.locator('[data-component="settings-popover-menu"]')).toBeVisible()

    await page.locator('[data-action="settings-popover-settings"]').click()

    const dialog = page.locator('[data-slot="dialog-content"]')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('[data-component="tabs"]')).toBeVisible()
  })

  test("unimplemented menu items show coming soon dialog", async ({ page }) => {
    const comingSoonItems = ["channels", "remote", "help", "about"]

    for (const item of comingSoonItems) {
      await page.locator('[data-action="open-settings-popover"]').click()
      await expect(page.locator('[data-component="settings-popover-menu"]')).toBeVisible()

      await page.locator(`[data-action="settings-popover-${item}"]`).click()

      const dialog = page.locator('[data-slot="dialog-content"]')
      await expect(dialog).toBeVisible()

      // Close dialog via overlay click
      const overlay = page.locator('[data-component="dialog-overlay"]')
      if (await overlay.isVisible().catch(() => false)) {
        await overlay.click({ position: { x: 5, y: 5 } })
      } else {
        await page.keyboard.press("Escape")
      }
      await expect(dialog).not.toBeVisible({ timeout: 3000 })
    }
  })
})
