import { $ } from "bun"
import { join } from "node:path"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"

import { copyBinaryToSidecarFolder, getCurrentSidecar, windowsify } from "./utils"
import pkg from "../package.json"

function detectRustTarget(): string {
  const platform = process.platform
  const arch = process.arch
  if (platform === "darwin") return arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin"
  if (platform === "win32") return "x86_64-pc-windows-msvc"
  if (platform === "linux") return arch === "arm64" ? "aarch64-unknown-linux-gnu" : "x86_64-unknown-linux-gnu"
  throw new Error(`Unsupported platform: ${platform}/${arch}`)
}

const RUST_TARGET = Bun.env.TAURI_ENV_TARGET_TRIPLE ?? detectRustTarget()

const sidecarConfig = getCurrentSidecar(RUST_TARGET)
const version = pkg.version

const sidecarDest = windowsify(`src-tauri/sidecars/opencode-cli-${RUST_TARGET}`)

if (await Bun.file(sidecarDest).exists()) {
  console.log(`Sidecar already exists: ${sidecarDest}, skipping download`)
  process.exit(0)
}

const assetName = `${sidecarConfig.ocBinary}.${sidecarConfig.assetExt}`
const downloadUrl = `https://github.com/anomalyco/opencode/releases/download/v${version}/${assetName}`

const tmpDir = await mkdtemp(join(tmpdir(), "opencode-sidecar-"))
try {
  const archivePath = join(tmpDir, assetName)

  console.log(`Downloading ${downloadUrl}...`)
  await $`curl -fL -o ${archivePath} ${downloadUrl}`

  const binaryName = windowsify("opencode")
  const binaryPath = join(tmpDir, binaryName)

  if (sidecarConfig.assetExt === "zip") {
    await $`unzip -j ${archivePath} ${binaryName} -d ${tmpDir}`
  } else {
    await $`tar xzf ${archivePath} -C ${tmpDir} ${binaryName}`
  }

  await copyBinaryToSidecarFolder(binaryPath, RUST_TARGET)
} finally {
  await rm(tmpDir, { recursive: true, force: true })
}
