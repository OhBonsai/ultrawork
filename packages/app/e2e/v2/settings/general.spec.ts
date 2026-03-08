import { test, expect } from "../../fixtures"

test.describe("Settings Dialog — Tab Switching", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("opencode.global.dat:language", JSON.stringify({ locale: "en" }))
    })
    await page.goto("/")
    await expect(page.locator('[data-component="v2-layout"]')).toBeVisible()
  })

  async function openSettingsV2(page: import("@playwright/test").Page) {
    await page.locator('[data-action="open-settings-popover"]').click()
    await expect(page.locator('[data-component="settings-popover-menu"]')).toBeVisible()
    await page.locator('[data-action="settings-popover-settings"]').click()
    const dialog = page.locator('[data-slot="dialog-content"]')
    await expect(dialog).toBeVisible()
    return dialog
  }

  test("settings dialog has General, Privacy, Capabilities tabs", async ({ page }) => {
    const dialog = await openSettingsV2(page)

    const tabs = dialog.locator('[data-component="tabs"]')
    await expect(tabs).toBeVisible()

    await expect(dialog.locator('[data-slot="tabs-trigger"][data-value="general"]')).toBeVisible()
    await expect(dialog.locator('[data-slot="tabs-trigger"][data-value="privacy"]')).toBeVisible()
    await expect(dialog.locator('[data-slot="tabs-trigger"][data-value="capabilities"]')).toBeVisible()
  })

  test("General tab is active by default and shows profile section", async ({ page }) => {
    const dialog = await openSettingsV2(page)

    await expect(dialog.locator('[data-action="settings-profile-fullname"]')).toBeVisible()
    await expect(dialog.locator('[data-action="settings-profile-nickname"]')).toBeVisible()
  })

  test("switching to Privacy tab shows placeholder content", async ({ page }) => {
    const dialog = await openSettingsV2(page)

    await dialog.locator('[data-slot="tabs-trigger"][data-value="privacy"]').click()

    // Privacy content should be visible, general should not
    await expect(dialog.locator('[data-action="settings-profile-fullname"]')).not.toBeVisible()
  })

  test("switching to Capabilities tab shows placeholder content", async ({ page }) => {
    const dialog = await openSettingsV2(page)

    await dialog.locator('[data-slot="tabs-trigger"][data-value="capabilities"]').click()

    await expect(dialog.locator('[data-action="settings-profile-fullname"]')).not.toBeVisible()
  })

  test("can switch between all tabs without error", async ({ page }) => {
    const dialog = await openSettingsV2(page)

    // General -> Privacy
    await dialog.locator('[data-slot="tabs-trigger"][data-value="privacy"]').click()
    await expect(dialog.locator('[data-action="settings-profile-fullname"]')).not.toBeVisible()

    // Privacy -> Capabilities
    await dialog.locator('[data-slot="tabs-trigger"][data-value="capabilities"]').click()
    await expect(dialog.locator('[data-action="settings-profile-fullname"]')).not.toBeVisible()

    // Capabilities -> General
    await dialog.locator('[data-slot="tabs-trigger"][data-value="general"]').click()
    await expect(dialog.locator('[data-action="settings-profile-fullname"]')).toBeVisible()
  })
})

test.describe("Settings Dialog — General Tab Appearance", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("opencode.global.dat:language", JSON.stringify({ locale: "en" }))
    })
    await page.goto("/")
    await expect(page.locator('[data-component="v2-layout"]')).toBeVisible()
  })

  async function openSettingsV2(page: import("@playwright/test").Page) {
    await page.locator('[data-action="open-settings-popover"]').click()
    await page.locator('[data-action="settings-popover-settings"]').click()
    const dialog = page.locator('[data-slot="dialog-content"]')
    await expect(dialog).toBeVisible()
    return dialog
  }

  test("appearance section has language, color scheme, theme, and font selects", async ({ page }) => {
    const dialog = await openSettingsV2(page)

    await expect(dialog.locator('[data-action="settings-language"]')).toBeVisible()
    await expect(dialog.locator('[data-action="settings-color-scheme"]')).toBeVisible()
    await expect(dialog.locator('[data-action="settings-theme"]')).toBeVisible()
    await expect(dialog.locator('[data-action="settings-font"]')).toBeVisible()
  })

  test("changing color scheme to dark updates document attribute", async ({ page }) => {
    const dialog = await openSettingsV2(page)

    const select = dialog.locator('[data-action="settings-color-scheme"]')
    await select.locator('[data-slot="select-select-trigger"]').click()
    await page.locator('[data-slot="select-select-item"]').filter({ hasText: "Dark" }).click()

    const colorScheme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-color-scheme"),
    )
    expect(colorScheme).toBe("dark")

    // Switch back to light
    await select.locator('[data-slot="select-select-trigger"]').click()
    await page.locator('[data-slot="select-select-item"]').filter({ hasText: "Light" }).click()

    const lightScheme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-color-scheme"),
    )
    expect(lightScheme).toBe("light")
  })

  test("changing theme updates document data-theme attribute", async ({ page }) => {
    const dialog = await openSettingsV2(page)

    const select = dialog.locator('[data-action="settings-theme"]')
    await select.locator('[data-slot="select-select-trigger"]').click()

    const items = page.locator('[data-slot="select-select-item"]')
    const count = await items.count()
    expect(count).toBeGreaterThan(1)

    await items.nth(1).click()

    const dataTheme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    )
    expect(dataTheme).toBeTruthy()
  })
})
