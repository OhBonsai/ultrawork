import { test, expect } from "../fixtures"

test("input box can be focused and typed into", async ({ page }) => {
  await page.goto("/")
  const input = page.locator('[data-testid="home-input"]')
  await expect(input).toBeVisible()
  await input.click()
  await input.fill("Hello world")
  await expect(input).toHaveValue("Hello world")
})

test("workspace selector can be opened", async ({ page }) => {
  await page.goto("/")
  // Find the workspace selector button (has folder icon)
  const workspaceButton = page.locator('[data-testid="home-composer"]').locator('button:has-text("Select workspace"), button:has-text("~")')
  await expect(workspaceButton.first()).toBeVisible()
  await workspaceButton.first().click()
  // Popover should appear with recent projects or browse option
  await expect(page.getByText("Open project").last()).toBeVisible()
})

test("model selector can be opened", async ({ page }) => {
  await page.goto("/")
  const modelButton = page.locator('[data-testid="model-selector"]')
  await expect(modelButton).toBeVisible()
  await modelButton.click()
  // Model selection dialog should appear
  await expect(page.getByRole("heading", { name: "Select model" })).toBeVisible()
})
