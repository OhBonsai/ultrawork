import { test, expect } from "../fixtures"

test("renders welcome title", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator('[data-component="v2-home"]')).toBeVisible()
  // Welcome title should be visible
  await expect(page.getByText("What can I help you with?")).toBeVisible()
})

test("renders three capability cards", async ({ page }) => {
  await page.goto("/")
  const cards = page.locator('[data-testid^="capability-card-"]')
  await expect(cards).toHaveCount(3)
  // Check each card has content
  await expect(page.locator('[data-testid="capability-card-0"]')).toBeVisible()
  await expect(page.locator('[data-testid="capability-card-1"]')).toBeVisible()
  await expect(page.locator('[data-testid="capability-card-2"]')).toBeVisible()
})
