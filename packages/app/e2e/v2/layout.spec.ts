import { test, expect } from "../fixtures"

test("v2 layout renders sidebar and top bar", async ({ page }) => {
  await page.goto("/")
  // v2 layout should be visible
  await expect(page.locator('[data-component="v2-layout"]')).toBeVisible()
  // Sidebar v2 should be rendered (not the placeholder slot)
  await expect(page.locator('[data-component="v2-sidebar"]')).toBeVisible()
  // Top bar v2 should be rendered
  await expect(page.locator('[data-component="v2-topbar"]')).toBeVisible()
  // Content area should be visible
  await expect(page.locator('[data-component="v2-content"]')).toBeVisible()
})

test("v2 layout shows home content by default", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator('[data-component="v2-home"]')).toBeVisible()
})
