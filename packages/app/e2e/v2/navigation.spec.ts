import { test, expect } from "../fixtures"

test("v1 route renders original layout", async ({ page }) => {
  await page.goto("/v1")
  // v1 home should show the Open project button
  await expect(page.getByRole("button", { name: "Open project" }).first()).toBeVisible()
})

test("v2 route renders v2 layout skeleton", async ({ page }) => {
  await page.goto("/")
  // v2 home should show the v2 layout
  await expect(page.locator('[data-component="v2-layout"]')).toBeVisible()
  await expect(page.locator('[data-component="v2-home"]')).toBeVisible()
})

test("v1 and v2 routes do not interfere", async ({ page }) => {
  // Visit v2 first
  await page.goto("/")
  await expect(page.locator('[data-component="v2-layout"]')).toBeVisible()

  // Then visit v1
  await page.goto("/v1")
  await expect(page.getByRole("button", { name: "Open project" }).first()).toBeVisible()
  // v2 layout should not be visible
  await expect(page.locator('[data-component="v2-layout"]')).not.toBeVisible()
})
