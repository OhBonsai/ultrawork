import { test, expect } from "../fixtures"

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
    const comingSoonItems = ["workspace", "providers", "channels", "remote", "help", "about"]

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

test.describe("Settings Popover — Language Switching", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("opencode.global.dat:language", JSON.stringify({ locale: "en" }))
    })
    await page.goto("/")
    await expect(page.locator('[data-component="v2-layout"]')).toBeVisible()
  })

  test("language submenu opens on click and displays en/zh", async ({ page }) => {
    await page.locator('[data-action="open-settings-popover"]').click()
    await expect(page.locator('[data-component="settings-popover-menu"]')).toBeVisible()

    // Submenu should not be visible initially
    await expect(page.locator('[data-component="language-submenu"]')).not.toBeVisible()

    // Click language button
    await page.locator('[data-action="settings-popover-language"]').click()

    // Submenu should now be visible
    const submenu = page.locator('[data-component="language-submenu"]')
    await expect(submenu).toBeVisible()

    // Verify en and zh are listed
    await expect(page.locator('[data-action="settings-popover-language-en"]')).toBeVisible()
    await expect(page.locator('[data-action="settings-popover-language-zh"]')).toBeVisible()
  })

  test("language submenu closes on second click", async ({ page }) => {
    await page.locator('[data-action="open-settings-popover"]').click()
    await page.locator('[data-action="settings-popover-language"]').click()
    await expect(page.locator('[data-component="language-submenu"]')).toBeVisible()

    // Click again to close
    await page.locator('[data-action="settings-popover-language"]').click()
    await expect(page.locator('[data-component="language-submenu"]')).not.toBeVisible()
  })

  test("language submenu is inside popover container (no overflow)", async ({ page }) => {
    await page.locator('[data-action="open-settings-popover"]').click()
    await page.locator('[data-action="settings-popover-language"]').click()

    const submenu = page.locator('[data-component="language-submenu"]')
    await expect(submenu).toBeVisible()

    // The submenu should be a child of the popover menu container
    const popover = page.locator('[data-component="settings-popover-menu"]')
    await expect(popover.locator('[data-component="language-submenu"]')).toBeVisible()

    // Submenu should have scrolling when content overflows
    const hasScroll = await submenu.evaluate((el) => {
      const style = window.getComputedStyle(el)
      return style.overflowY === "auto" || style.overflowY === "scroll"
    })
    expect(hasScroll).toBe(true)
  })

  test("switching language from en to zh updates UI text", async ({ page }) => {
    await page.locator('[data-action="open-settings-popover"]').click()
    await page.locator('[data-action="settings-popover-language"]').click()

    await expect(page.locator('[data-action="settings-popover-language-zh"]')).toBeVisible()
    await page.locator('[data-action="settings-popover-language-zh"]').click()

    // Popover should close after selection
    await expect(page.locator('[data-component="settings-popover-menu"]')).not.toBeVisible()

    // Re-open popover and verify Chinese labels
    await page.locator('[data-action="open-settings-popover"]').click()
    const popover = page.locator('[data-component="settings-popover-menu"]')
    await expect(popover).toBeVisible()

    // The menu should now show Chinese text
    await expect(page.locator('[data-action="settings-popover-language"]')).toContainText("语言切换")
  })

  test("switching language from zh back to en restores English text", async ({ page }) => {
    // Switch to zh first
    await page.locator('[data-action="open-settings-popover"]').click()
    await page.locator('[data-action="settings-popover-language"]').click()
    await page.locator('[data-action="settings-popover-language-zh"]').click()

    // Re-open and switch back to en
    await page.locator('[data-action="open-settings-popover"]').click()
    await page.locator('[data-action="settings-popover-language"]').click()
    await page.locator('[data-action="settings-popover-language-en"]').click()

    // Verify English labels restored
    await page.locator('[data-action="open-settings-popover"]').click()
    await expect(page.locator('[data-action="settings-popover-language"]')).toContainText("Language")
  })

  test("current locale shows check icon in submenu", async ({ page }) => {
    await page.locator('[data-action="open-settings-popover"]').click()
    await page.locator('[data-action="settings-popover-language"]').click()

    // English should be highlighted as current
    const enButton = page.locator('[data-action="settings-popover-language-en"]')
    await expect(enButton).toHaveClass(/bg-color-bg-hover/)
  })

  test("language switch persists in localStorage", async ({ page }) => {
    await page.locator('[data-action="open-settings-popover"]').click()
    await page.locator('[data-action="settings-popover-language"]').click()
    await page.locator('[data-action="settings-popover-language-zh"]').click()

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem("opencode.global.dat:language")
      return raw ? JSON.parse(raw) : null
    })
    expect(stored?.locale).toBe("zh")
  })

  test("language switch persists after page reload", async ({ page }) => {
    await page.locator('[data-action="open-settings-popover"]').click()
    await page.locator('[data-action="settings-popover-language"]').click()
    await page.locator('[data-action="settings-popover-language-zh"]').click()

    // Verify zh is stored
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem("opencode.global.dat:language")
      return raw ? JSON.parse(raw) : null
    })
    expect(stored?.locale).toBe("zh")

    // Create a fresh page in the same context (shares localStorage but no addInitScript)
    const page2 = await page.context().newPage()
    await page2.goto("/")
    await expect(page2.locator('[data-component="v2-layout"]')).toBeVisible()

    await page2.locator('[data-action="open-settings-popover"]').click()
    await expect(page2.locator('[data-action="settings-popover-language"]')).toContainText("语言切换")
    await page2.close()
  })
})

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

  test("changing language in General/Appearance to zh updates dialog labels", async ({ page }) => {
    const dialog = await openSettingsV2(page)

    const heading = dialog.getByRole("heading", { level: 2 })
    await expect(heading).toHaveText("General")

    const select = dialog.locator('[data-action="settings-language"]')
    await select.locator('[data-slot="select-select-trigger"]').click()
    await page.locator('[data-slot="select-select-item"]').filter({ hasText: "简体中文" }).click()

    await expect(heading).toHaveText("通用设置")

    // Switch back
    await select.locator('[data-slot="select-select-trigger"]').click()
    await page.locator('[data-slot="select-select-item"]').filter({ hasText: "English" }).click()
    await expect(heading).toHaveText("General")
  })

  test("language set in popover is reflected in General/Appearance language select", async ({ page }) => {
    // Switch to Chinese via popover
    await page.locator('[data-action="open-settings-popover"]').click()
    await page.locator('[data-action="settings-popover-language"]').click()
    await page.locator('[data-action="settings-popover-language-zh"]').click()

    // Open settings dialog
    await page.locator('[data-action="open-settings-popover"]').click()
    await page.locator('[data-action="settings-popover-settings"]').click()
    const dialog = page.locator('[data-slot="dialog-content"]')
    await expect(dialog).toBeVisible()

    // General heading should be in Chinese
    const heading = dialog.getByRole("heading", { level: 2 })
    await expect(heading).toHaveText("通用设置")

    // Language select should show 简体中文
    const langTrigger = dialog.locator('[data-action="settings-language"] [data-slot="select-select-trigger-value"]')
    await expect(langTrigger).toContainText("简体中文")
  })
})
