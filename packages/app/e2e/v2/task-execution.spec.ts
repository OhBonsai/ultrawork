import { test, expect } from "../fixtures"
import { withSession, cleanupSession } from "../actions"
import { createSdk, dirSlug, v2SessionPath } from "../utils"

test.describe("V2 Task Execution", () => {
  test("navigating to v2 session URL renders session view", async ({ page, directory }) => {
    const sdk = createSdk(directory)

    await withSession(sdk, "task-nav-test", async (session) => {
      await page.goto(v2SessionPath(directory, session.id))

      // Should show v2 layout
      await expect(page.locator('[data-component="v2-layout"]')).toBeVisible()

      // Should show v2 session content
      await expect(page.locator('[data-component="v2-session"]')).toBeVisible()

      // URL should contain the correct path pattern
      const slug = dirSlug(directory)
      expect(page.url()).toContain(`/task/${slug}/${session.id}`)
    })
  })

  test("v2 session shows task view with params", async ({ page, directory }) => {
    const sdk = createSdk(directory)

    await withSession(sdk, "task-params-test", async (session) => {
      await page.goto(v2SessionPath(directory, session.id))
      await expect(page.locator('[data-component="v2-session"]')).toBeVisible()

      // Session should display dir and id params (placeholder content)
      const sessionView = page.locator('[data-component="v2-session"]')
      await expect(sessionView.getByText("Task View")).toBeVisible()
    })
  })

  test("v2 home page renders correctly", async ({ page }) => {
    await page.goto("/")

    await expect(page.locator('[data-component="v2-layout"]')).toBeVisible()
    await expect(page.locator('[data-component="v2-home"]')).toBeVisible()
    await expect(page.getByText("UltraWork")).toBeVisible()
  })

  test("navigating between home and session preserves layout", async ({ page, directory }) => {
    const sdk = createSdk(directory)

    await withSession(sdk, "task-layout-test", async (session) => {
      // Start at home
      await page.goto("/")
      await expect(page.locator('[data-component="v2-layout"]')).toBeVisible()
      await expect(page.locator('[data-component="v2-home"]')).toBeVisible()

      // Navigate to session
      await page.goto(v2SessionPath(directory, session.id))
      await expect(page.locator('[data-component="v2-layout"]')).toBeVisible()
      await expect(page.locator('[data-component="v2-session"]')).toBeVisible()
      // Home should not be visible
      await expect(page.locator('[data-component="v2-home"]')).not.toBeVisible()

      // Navigate back to home
      await page.goto("/")
      await expect(page.locator('[data-component="v2-layout"]')).toBeVisible()
      await expect(page.locator('[data-component="v2-home"]')).toBeVisible()
      // Session should not be visible
      await expect(page.locator('[data-component="v2-session"]')).not.toBeVisible()
    })
  })

  test("invalid session ID still renders v2 layout", async ({ page, directory }) => {
    const slug = dirSlug(directory)
    await page.goto(`/task/${slug}/nonexistent-session-id`)

    // Layout should still render even with invalid session
    await expect(page.locator('[data-component="v2-layout"]')).toBeVisible()
  })
})
