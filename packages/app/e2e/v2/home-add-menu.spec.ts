import { test, expect } from "../fixtures"

test("+ button opens menu with attachment options", async ({ page }) => {
  await page.goto("/")
  // Find the add menu button (plus icon)
  const addButton = page.locator('[data-testid="home-composer"]').locator('button[aria-label="Add"]')
  await expect(addButton).toBeVisible()
  await addButton.click()
  // Menu should show attachment options
  await expect(page.getByText("Attach file")).toBeVisible()
  await expect(page.getByText("Attach image")).toBeVisible()
})
