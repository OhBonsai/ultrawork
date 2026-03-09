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
  // The workspace selector button shows the directory path with a folder icon
  const composer = page.locator('[data-testid="home-composer"]')
  await expect(composer).toBeVisible()
  // Find the button that contains the folder icon (workspace selector)
  const workspaceButton = composer.locator('[data-testid="workspace-selector"]')
  await expect(workspaceButton).toBeVisible()
  await workspaceButton.click()
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
