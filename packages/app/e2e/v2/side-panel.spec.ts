import { test, expect } from "../fixtures"
import { withSession, cleanupSession, waitSessionIdle } from "../actions"
import { createSdk, v2SessionPath } from "../utils"

test.describe("V2 Side Panel", () => {
  test("side panel renders on desktop viewport in session view", async ({ page, directory }) => {
    const sdk = createSdk(directory)

    await withSession(sdk, "side-panel-test", async (session) => {
      await page.goto(v2SessionPath(directory, session.id))
      await expect(page.locator('[data-component="v2-session"]')).toBeVisible()

      // Side panel should be visible on desktop
      const panel = page.locator('[data-component="v2-side-panel"]')
      await expect(panel).toBeVisible()
    })
  })

  test("side panel shows empty state when no artifacts", async ({ page, directory }) => {
    const sdk = createSdk(directory)

    await withSession(sdk, "side-panel-empty", async (session) => {
      await page.goto(v2SessionPath(directory, session.id))
      await expect(page.locator('[data-component="v2-session"]')).toBeVisible()

      const panel = page.locator('[data-component="v2-side-panel"]')
      await expect(panel).toBeVisible()

      // Should show "Artifacts" title
      await expect(panel.getByText("Artifacts", { exact: true })).toBeVisible()

      // Should show empty state message
      await expect(panel.getByText(/no artifacts/i)).toBeVisible()
    })
  })

  test.skip("side panel shows artifacts after file-writing tool call", async ({ page, directory }) => {
    const sdk = createSdk(directory)

    await withSession(sdk, "side-panel-artifacts", async (session) => {
      // Seed a file write via promptAsync
      await sdk.session.promptAsync({
        sessionID: session.id,
        agent: "build",
        system: [
          "You are seeding deterministic e2e UI state.",
          "Follow the user's instruction exactly.",
          "When asked to call a tool, call exactly that tool exactly once with the exact JSON input.",
          "Do not call any extra tools.",
        ].join(" "),
        parts: [
          {
            type: "text",
            text: [
              "Your only valid response is one write tool call.",
              `Use this JSON input: ${JSON.stringify({ filePath: "test-artifact.md", content: "# Test Artifact\n\nThis is a test file." })}`,
              "Do not output plain text.",
            ].join("\n"),
          },
        ],
      })

      await waitSessionIdle(sdk, session.id, 60_000)

      // Navigate to v2 session
      await page.goto(v2SessionPath(directory, session.id))
      await expect(page.locator('[data-component="v2-session"]')).toBeVisible()

      const panel = page.locator('[data-component="v2-side-panel"]')
      await expect(panel).toBeVisible()

      // Should show the artifact in the list
      await expect(panel.getByText("test-artifact.md")).toBeVisible({ timeout: 10_000 })
    })
  })

  test("side panel not visible on mobile viewport", async ({ page, directory }) => {
    const sdk = createSdk(directory)

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await withSession(sdk, "side-panel-mobile", async (session) => {
      await page.goto(v2SessionPath(directory, session.id))
      await expect(page.locator('[data-component="v2-session"]')).toBeVisible()

      // Side panel should not be visible on mobile
      const panel = page.locator('[data-component="v2-side-panel"]')
      await expect(panel).not.toBeVisible()
    })
  })
})
