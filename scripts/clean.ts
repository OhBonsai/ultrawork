#!/usr/bin/env bun
/**
 * Clean build artifacts and caches.
 *
 * Usage:
 *   bun scripts/clean.ts          # clean all
 *   bun scripts/clean.ts --cargo  # cargo target only
 *   bun scripts/clean.ts --npm    # node_modules only
 */

import * as fs from "node:fs"
import * as path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const args = process.argv.slice(2)
const all = args.length === 0
const doCargo = all || args.includes("--cargo")
const doNpm = all || args.includes("--npm")

function remove(p: string) {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true })
    console.log(`removed  ${path.relative(ROOT, p)}`)
  }
}

if (doCargo) {
  console.log("\n── cargo ──")
  remove(path.join(ROOT, "packages/desktop/src-tauri/target"))
}

if (doNpm) {
  console.log("\n── node_modules ──")
  for (const p of [
    "node_modules",
    "packages/desktop/node_modules",
    "packages/app/node_modules",
    "packages/ui/node_modules",
    "packages/util/node_modules",
    "packages/sdk/node_modules",
  ]) {
    remove(path.join(ROOT, p))
  }
}

console.log("\ndone.")
