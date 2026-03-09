import { test, expect } from "../fixtures"

test("sidebar is expanded by default and shows UltraWork title", async ({ page }) => {
  await page.goto("/")
  const sidebar = page.locator('[data-component="v2-sidebar"]')
  await expect(sidebar).toBeVisible()
  // Should show UltraWork brand text when expanded
  await expect(sidebar.getByText("UltraWork")).toBeVisible()
})

test("sidebar collapse and expand toggle works", async ({ page }) => {
  await page.goto("/")
  const sidebar = page.locator('[data-component="v2-sidebar"]')
  await expect(sidebar).toBeVisible()

  // Find the toggle button
  const toggleButton = sidebar.getByRole("button", { name: /toggle sidebar/i })
  await expect(toggleButton).toBeVisible()

  // Click to collapse
  await toggleButton.click()
  // After collapse, UltraWork text should not be visible
  await expect(sidebar.getByText("UltraWork")).not.toBeVisible()

  // Click to expand again
  await toggleButton.click()
  // UltraWork text should be visible again
  await expect(sidebar.getByText("UltraWork")).toBeVisible()
})

test("new task button is visible and clickable", async ({ page }) => {
  await page.goto("/")
  const sidebar = page.locator('[data-component="v2-sidebar"]')
  // New session button should be present
  const newButton = sidebar.getByRole("button").filter({ hasText: /new task/i })
  await expect(newButton).toBeVisible()
  // Should be clickable even when already on home
  await newButton.click()
})

test("task list area is rendered", async ({ page, directory }) => {
  await page.goto("/")
  // Task list may need a project to be loaded; check sidebar has the component
  const sidebar = page.locator('[data-component="v2-sidebar"]')
  await expect(sidebar).toBeVisible()
  // The task list renders inside the sidebar scrollable area
  await expect(sidebar.locator('[data-component="v2-task-list"]')).toBeVisible()
})

test("user profile area is present", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator('[data-component="v2-user-profile"]')).toBeVisible()
})
