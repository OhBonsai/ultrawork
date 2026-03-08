import { test, expect } from "../fixtures"

test("clicking capability card expands prompt list", async ({ page }) => {
  await page.goto("/")
  const card = page.locator('[data-testid="capability-card-0"]')
  await expect(card).toBeVisible()
  await card.click()
  // Prompt suggestions should appear
  const prompts = page.locator('[data-testid="prompt-suggestion"]')
  await expect(prompts.first()).toBeVisible()
  await expect(prompts).toHaveCount(3)
})

test("clicking prompt fills input box", async ({ page }) => {
  await page.goto("/")
  // Expand first capability card
  await page.locator('[data-testid="capability-card-0"]').click()
  // Click first prompt suggestion
  const firstPrompt = page.locator('[data-testid="prompt-suggestion"]').first()
  const promptText = await firstPrompt.textContent()
  await firstPrompt.click()
  // Input should be filled with prompt text
  const input = page.locator('[data-testid="home-input"]')
  await expect(input).toHaveValue(promptText!.trim())
})

test("clicking different card closes previous and expands new", async ({ page }) => {
  await page.goto("/")
  // Expand first card
  await page.locator('[data-testid="capability-card-0"]').click()
  await expect(page.locator('[data-testid="prompt-suggestion"]')).toHaveCount(3)

  // Click second card
  await page.locator('[data-testid="capability-card-1"]').click()
  // Should still have 3 prompts (from the new card)
  await expect(page.locator('[data-testid="prompt-suggestion"]')).toHaveCount(3)
})
