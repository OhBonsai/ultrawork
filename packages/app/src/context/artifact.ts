import { createStore, produce } from "solid-js/store"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { createMemo } from "solid-js"
import type { Part, Message, FileDiff } from "@opencode-ai/sdk/v2/client"

export type ArtifactType = "markdown" | "html" | "code" | "pdf" | "image" | "other"

export type Artifact = {
  id: string
  sessionId: string
  messageId: string
  filePath: string
  type: ArtifactType
  stage: "process" | "final"
  createdAt: number
}

export type ArtifactStore = {
  artifacts: Artifact[]
  selected: string | null
  panelOpen: boolean
}

const EXT_TYPE_MAP: Record<string, ArtifactType> = {
  md: "markdown",
  mdx: "markdown",
  html: "html",
  htm: "html",
  pdf: "pdf",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  svg: "image",
  webp: "image",
}

function inferType(filePath: string): ArtifactType {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? ""
  return EXT_TYPE_MAP[ext] ?? "code"
}

function extractFilePath(input: Record<string, unknown>): string | undefined {
  if (typeof input.filePath === "string") return input.filePath
  if (typeof input.file_path === "string") return input.file_path
  if (typeof input.path === "string") return input.path
  return undefined
}

const FILE_TOOLS = new Set(["write", "edit", "apply_patch"])

export function extractArtifacts(input: {
  sessionId: string
  messages: Message[]
  parts: Record<string, Part[] | undefined>
  diffs: FileDiff[]
}): Artifact[] {
  const diffFiles = new Set(input.diffs.map((d) => d.file))
  const artifacts: Artifact[] = []
  const seen = new Set<string>()

  for (const message of input.messages) {
    if (message.role !== "assistant") continue
    const messageParts = input.parts[message.id] ?? []
    for (const part of messageParts) {
      if (part.type !== "tool") continue
      if (!FILE_TOOLS.has(part.tool)) continue

      const state = part.state as { input?: Record<string, unknown>; status?: string }
      if (!state?.input) continue

      // apply_patch may have multiple files in metadata
      if (part.tool === "apply_patch") {
        const metadata = (state as { metadata?: { files?: Array<{ path: string }> } }).metadata
        if (metadata?.files) {
          for (const f of metadata.files) {
            if (!f.path || seen.has(f.path)) continue
            seen.add(f.path)
            artifacts.push({
              id: `${message.id}:${part.id}:${f.path}`,
              sessionId: input.sessionId,
              messageId: message.id,
              filePath: f.path,
              type: inferType(f.path),
              stage: diffFiles.has(f.path) ? "process" : "final",
              createdAt: message.time.created,
            })
          }
          continue
        }
      }

      const filePath = extractFilePath(state.input)
      if (!filePath || seen.has(filePath)) continue
      seen.add(filePath)

      artifacts.push({
        id: `${message.id}:${part.id}`,
        sessionId: input.sessionId,
        messageId: message.id,
        filePath,
        type: inferType(filePath),
        stage: diffFiles.has(filePath) ? "process" : "final",
        createdAt: message.time.created,
      })
    }
  }

  return artifacts
}

export const { use: useArtifact, provider: ArtifactProvider } = createSimpleContext({
  name: "Artifact",
  init: () => {
    const [store, setStore] = createStore<ArtifactStore>({
      artifacts: [],
      selected: null,
      panelOpen: true,
    })

    const selected = createMemo(() => {
      if (!store.selected) return undefined
      return store.artifacts.find((a) => a.id === store.selected)
    })

    const processArtifacts = createMemo(() => store.artifacts.filter((a) => a.stage === "process"))
    const finalArtifacts = createMemo(() => store.artifacts.filter((a) => a.stage === "final"))

    return {
      get artifacts() {
        return store.artifacts
      },
      get selected() {
        return selected()
      },
      get selectedId() {
        return store.selected
      },
      get panelOpen() {
        return store.panelOpen
      },
      process: processArtifacts,
      final: finalArtifacts,
      select(id: string | null) {
        setStore("selected", id)
      },
      togglePanel() {
        setStore("panelOpen", (v) => !v)
      },
      setOpen(open: boolean) {
        setStore("panelOpen", open)
      },
      sync(artifacts: Artifact[]) {
        setStore(
          produce((draft) => {
            draft.artifacts = artifacts
            if (draft.selected && !artifacts.find((a) => a.id === draft.selected)) {
              draft.selected = null
            }
          }),
        )
      },
    }
  },
})
