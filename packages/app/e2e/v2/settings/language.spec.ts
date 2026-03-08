import { test, expect } from "../../fixtures"

test.describe("Settings — Language Switching", () => {
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

  test("changing language in General/Appearance to zh updates dialog labels", async ({ page }) => {
    await page.locator('[data-action="open-settings-popover"]').click()
    await page.locator('[data-action="settings-popover-settings"]').click()
    const dialog = page.locator('[data-slot="dialog-content"]')
    await expect(dialog).toBeVisible()

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

  test("language set in popover is reflected in General/Appearance language select", async ({
    page,
  }) => {
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
    const langTrigger = dialog.locator(
      '[data-action="settings-language"] [data-slot="select-select-trigger-value"]',
    )
    await expect(langTrigger).toContainText("简体中文")
  })
})
