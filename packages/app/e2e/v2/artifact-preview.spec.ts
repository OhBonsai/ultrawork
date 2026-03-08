import { test, expect } from "../fixtures"
import { withSession, waitSessionIdle } from "../actions"
import { createSdk, v2SessionPath } from "../utils"

const seedSystem = [
  "You are seeding deterministic e2e UI state.",
  "Follow the user's instruction exactly.",
  "When asked to call a tool, call exactly that tool exactly once with the exact JSON input.",
  "Do not call any extra tools.",
].join(" ")

test.describe("V2 Artifact Preview", () => {
  test("clicking artifact opens split preview pane", async ({ page, directory }) => {
    const sdk = createSdk(directory)

    await withSession(sdk, "artifact-preview-click", async (session) => {
      // Seed a markdown file write
      await sdk.session.promptAsync({
        sessionID: session.id,
        agent: "build",
        system: seedSystem,
        parts: [
          {
            type: "text",
            text: [
              "Your only valid response is one write tool call.",
              `Use this JSON input: ${JSON.stringify({ filePath: "preview-test.md", content: "# Preview Test\n\nHello world." })}`,
              "Do not output plain text.",
            ].join("\n"),
          },
        ],
      })

      await waitSessionIdle(sdk, session.id, 60_000)

      await page.goto(v2SessionPath(directory, session.id))
      await expect(page.locator('[data-component="v2-session"]')).toBeVisible()

      const panel = page.locator('[data-component="v2-side-panel"]')
      await expect(panel).toBeVisible()

      // Wait for artifact to appear
      const artifactButton = panel.getByText("preview-test.md")
      await expect(artifactButton).toBeVisible({ timeout: 10_000 })

      // Click the artifact to open preview
      await artifactButton.click()

      // Preview pane should appear with the filename in header
      await expect(panel.getByRole("button", { name: /close preview/i })).toBeVisible()
      await expect(panel.locator("text=preview-test.md").first()).toBeVisible()
    })
  })

  test("close button dismisses preview pane", async ({ page, directory }) => {
    const sdk = createSdk(directory)

    await withSession(sdk, "artifact-preview-close", async (session) => {
      await sdk.session.promptAsync({
        sessionID: session.id,
        agent: "build",
        system: seedSystem,
        parts: [
          {
            type: "text",
            text: [
              "Your only valid response is one write tool call.",
              `Use this JSON input: ${JSON.stringify({ filePath: "close-test.txt", content: "test content" })}`,
              "Do not output plain text.",
            ].join("\n"),
          },
        ],
      })

      await waitSessionIdle(sdk, session.id, 60_000)

      await page.goto(v2SessionPath(directory, session.id))
      await expect(page.locator('[data-component="v2-session"]')).toBeVisible()

      const panel = page.locator('[data-component="v2-side-panel"]')

      // Click the artifact to open preview
      const artifactButton = panel.getByText("close-test.txt")
      await expect(artifactButton).toBeVisible({ timeout: 10_000 })
      await artifactButton.click()

      // Verify preview is open
      const closeButton = panel.getByRole("button", { name: /close preview/i })
      await expect(closeButton).toBeVisible()

      // Close the preview
      await closeButton.click()

      // Preview close button should no longer be visible
      await expect(closeButton).not.toBeVisible()
    })
  })

  test("markdown file renders with markdown preview", async ({ page, directory }) => {
    const sdk = createSdk(directory)

    await withSession(sdk, "artifact-preview-md", async (session) => {
      await sdk.session.promptAsync({
        sessionID: session.id,
        agent: "build",
        system: seedSystem,
        parts: [
          {
            type: "text",
            text: [
              "Your only valid response is one write tool call.",
              `Use this JSON input: ${JSON.stringify({ filePath: "render-test.md", content: "# Heading One\n\nA paragraph of text." })}`,
              "Do not output plain text.",
            ].join("\n"),
          },
        ],
      })

      await waitSessionIdle(sdk, session.id, 60_000)

      await page.goto(v2SessionPath(directory, session.id))
      const panel = page.locator('[data-component="v2-side-panel"]')

      const artifactButton = panel.getByText("render-test.md")
      await expect(artifactButton).toBeVisible({ timeout: 10_000 })
      await artifactButton.click()

      // Markdown should be rendered - look for the heading rendered as an h1
      await expect(panel.locator("h1", { hasText: "Heading One" })).toBeVisible({ timeout: 10_000 })
    })
  })
})
