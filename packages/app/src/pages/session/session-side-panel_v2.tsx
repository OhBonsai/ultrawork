import { Show, Switch, Match, For, createMemo, createEffect, createSignal, on } from "solid-js"
import { createMediaQuery } from "@solid-primitives/media"
import { useParams } from "@solidjs/router"
import { Tabs } from "@opencode-ai/ui/tabs"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import { useLanguage } from "@/context/language"
import { useSync } from "@/context/sync"
import { useFile } from "@/context/file"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { useArtifact, extractArtifacts } from "@/context/artifact"
import { ArtifactList } from "@/components/artifact-list"
import { ArtifactPreview } from "@/components/artifact-preview"
import FileTree from "@/components/file-tree"

const DEFAULT_LIST_WIDTH = 320
const DEFAULT_PREVIEW_WIDTH = 420
const MIN_LIST_WIDTH = 200
const MAX_LIST_WIDTH = 600
const MIN_PREVIEW_WIDTH = 280
const MAX_PREVIEW_WIDTH = 900

type PanelTab = "artifacts" | "files" | "context"

/**
 * Simple file preview panel for the v2 side panel.
 * Loads and displays file content when a file is selected from the tree.
 */
function FilePreview(props: { filePath: string; onClose: () => void }) {
  const file = useFile()
  const language = useLanguage()
  const platform = usePlatform()
  const server = useServer()

  createEffect(
    on(
      () => props.filePath,
      (path) => {
        if (path) file.load(path)
      },
    ),
  )

  const state = createMemo(() => file.get(props.filePath))
  const content = createMemo(() => state()?.content?.content ?? "")
  const filename = createMemo(() => {
    const parts = props.filePath.split("/")
    return parts[parts.length - 1] || props.filePath
  })

  const canOpenFolder = createMemo(() => platform.platform === "desktop" && !!platform.openPath && server.isLocal())

  const openFolder = () => {
    if (!platform.openPath) return
    const dir = props.filePath.split("/").slice(0, -1).join("/")
    if (dir) platform.openPath(dir)
  }

  return (
    <div class="flex h-full flex-col overflow-hidden bg-background-base">
      <div class="flex shrink-0 items-center justify-between border-b border-border-weaker-base px-3 py-2">
        <span class="min-w-0 truncate text-12-medium text-text-primary">{filename()}</span>
        <div class="flex shrink-0 items-center gap-0.5">
          <Show when={canOpenFolder()}>
            <IconButton
              icon="open-file"
              variant="ghost"
              class="h-6 w-6"
              onClick={openFolder}
              aria-label={language.t("common.openFolder")}
            />
          </Show>
          <IconButton
            icon="close-small"
            variant="ghost"
            class="h-6 w-6"
            onClick={props.onClose}
            aria-label={language.t("common.close")}
          />
        </div>
      </div>
      <div class="min-h-0 flex-1 overflow-auto">
        <Switch>
          <Match when={state()?.loaded}>
            <pre class="p-4 text-12 leading-relaxed">
              <code>{content()}</code>
            </pre>
          </Match>
          <Match when={state()?.loading}>
            <div class="flex h-full items-center justify-center">
              <span class="text-12 text-text-weak">{language.t("common.loading")}</span>
            </div>
          </Match>
          <Match when={state()?.error}>
            {(err) => (
              <div class="flex h-full items-center justify-center">
                <span class="text-12 text-text-weak">{err()}</span>
              </div>
            )}
          </Match>
        </Switch>
      </div>
    </div>
  )
}

export function SessionSidePanel() {
  const params = useParams()
  const sync = useSync()
  const language = useLanguage()
  const artifact = useArtifact()
  const file = useFile()
  const isDesktop = createMediaQuery("(min-width: 768px)")

  const [activeTab, setActiveTab] = createSignal<PanelTab>("artifacts")
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null)
  const [listWidth, setListWidth] = createSignal(DEFAULT_LIST_WIDTH)
  const [previewWidth, setPreviewWidth] = createSignal(DEFAULT_PREVIEW_WIDTH)
  let asideRef: HTMLElement | undefined

  // When preview opens, set width to half of session container
  const initPreviewWidth = () => {
    const session = asideRef?.closest('[data-component="v2-session"]')
    if (!session) return
    const half = Math.round(session.clientWidth / 2)
    setPreviewWidth(Math.max(MIN_PREVIEW_WIDTH, Math.min(MAX_PREVIEW_WIDTH, half)))
  }

  const messages = createMemo(() => {
    if (!params.id) return []
    return sync.data.message[params.id] ?? []
  })

  const diffs = createMemo(() => {
    if (!params.id) return []
    return sync.data.session_diff[params.id] ?? []
  })

  // Sync artifacts when messages or diffs change
  createEffect(
    on([messages, diffs], () => {
      if (!params.id) return
      const extracted = extractArtifacts({
        sessionId: params.id,
        messages: messages(),
        parts: sync.data.part,
        diffs: diffs(),
      })
      artifact.sync(extracted)
    }),
  )

  // File tree data
  const diffFiles = createMemo(() => diffs().map((d) => d.file))
  const kinds = createMemo(() => {
    const merge = (a: "add" | "del" | "mix" | undefined, b: "add" | "del" | "mix") => {
      if (!a) return b
      if (a === b) return a
      return "mix" as const
    }
    const normalize = (p: string) => p.replaceAll("\\\\", "/").replace(/\/+$/, "")
    const out = new Map<string, "add" | "del" | "mix">()
    for (const diff of diffs()) {
      const f = normalize(diff.file)
      const kind = diff.status === "added" ? "add" : diff.status === "deleted" ? "del" : "mix"
      out.set(f, kind)
      const parts = f.split("/")
      for (const [idx] of parts.slice(0, -1).entries()) {
        const dir = parts.slice(0, idx + 1).join("/")
        if (!dir) continue
        out.set(dir, merge(out.get(dir), kind))
      }
    }
    return out
  })

  const reviewCount = createMemo(() => {
    const info = params.id ? sync.session.get(params.id) : undefined
    return Math.max(info?.summary?.files ?? 0, diffs().length)
  })
  const hasReview = createMemo(() => reviewCount() > 0)

  const nofiles = createMemo(() => {
    const state = file.tree.state("")
    if (!state?.loaded) return false
    return file.tree.children("").length === 0
  })

  const [fileTreeTab, setFileTreeTab] = createSignal<"changes" | "all">(hasReview() ? "changes" : "all")

  // When clicking a file in the tree, show preview
  const handleFileClick = (node: { path: string }) => {
    setSelectedFile(node.path)
    file.load(node.path)
  }

  const open = createMemo(() => isDesktop() && artifact.panelOpen)
  const hasArtifactPreview = createMemo(() => activeTab() === "artifacts" && !!artifact.selected)
  const hasFilePreview = createMemo(() => activeTab() === "files" && !!selectedFile())
  const hasPreview = createMemo(() => hasArtifactPreview() || hasFilePreview())

  // Re-init preview width each time preview opens
  createEffect(
    on(hasPreview, (open) => {
      if (open) initPreviewWidth()
    }, { defer: true }),
  )

  const totalWidth = createMemo(() => {
    if (!open()) return 0
    if (hasPreview()) return previewWidth()
    return listWidth()
  })

  return (
    <Show when={isDesktop()}>
      <aside
        ref={asideRef}
        aria-label={language.t("v2.panel.title")}
        aria-hidden={!open()}
        inert={!open()}
        class="relative flex h-full shrink-0 overflow-hidden bg-background-base"
        classList={{
          "opacity-100": open(),
          "opacity-0 pointer-events-none": !open(),
          "transition-[width,opacity] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none":
            true,
        }}
        style={{ width: `${totalWidth()}px` }}
        data-component="v2-side-panel"
      >
        <div
          class="flex h-full border-l border-border-weaker-base"
          style={{ width: `${totalWidth()}px` }}
        >
          {/* Preview section - left side, between chat and list */}
          <Show when={hasPreview()}>
            <div class="relative h-full shrink-0 overflow-hidden" style={{ width: `${previewWidth()}px` }}>
              <Switch>
                <Match when={hasArtifactPreview()}>
                  <ArtifactPreview />
                </Match>
                <Match when={hasFilePreview() && selectedFile()}>
                  {(path) => (
                    <FilePreview
                      filePath={path()}
                      onClose={() => setSelectedFile(null)}
                    />
                  )}
                </Match>
              </Switch>
              {/* Resize handle on left edge of preview (drag to resize preview) */}
              <ResizeHandle
                direction="horizontal"
                edge="start"
                size={previewWidth()}
                min={MIN_PREVIEW_WIDTH}
                max={MAX_PREVIEW_WIDTH}
                onResize={setPreviewWidth}
              />
            </div>
          </Show>

          {/* Main panel section - right side (hidden when preview is open) */}
          <div
            class="relative flex h-full shrink-0 flex-col overflow-hidden border-l border-border-weaker-base"
            classList={{ "hidden": hasPreview() }}
            style={{ width: `${listWidth()}px` }}
          >
            {/* Resize handle on left edge of list panel */}
            <Show when={!hasPreview()}>
              <ResizeHandle
                direction="horizontal"
                edge="start"
                size={listWidth()}
                min={MIN_LIST_WIDTH}
                max={MAX_LIST_WIDTH}
                onResize={setListWidth}
              />
            </Show>

            {/* Tab headers */}
            <Tabs
              variant="pill"
              value={activeTab()}
              onChange={(v) => {
                if (v === "artifacts" || v === "files" || v === "context") setActiveTab(v)
              }}
              class="h-full flex flex-col"
            >
              <Tabs.List class="px-2">
                <Tabs.Trigger value="artifacts" class="flex-1" classes={{ button: "w-full" }}>
                  {language.t("v2.artifact.title")}
                  <Show when={artifact.artifacts.length > 0}>
                    <span class="ml-1 text-11 text-text-weak">{artifact.artifacts.length}</span>
                  </Show>
                </Tabs.Trigger>
                <Tabs.Trigger value="files" class="flex-1" classes={{ button: "w-full" }}>
                  {language.t("session.files.all")}
                </Tabs.Trigger>
                <Tabs.Trigger value="context" class="flex-1" classes={{ button: "w-full" }}>
                  {language.t("v2.context.title")}
                </Tabs.Trigger>
              </Tabs.List>

              {/* Artifacts tab content */}
              <Tabs.Content value="artifacts" class="flex-1 min-h-0 overflow-hidden">
                <ArtifactList />
              </Tabs.Content>

              {/* Files tab content */}
              <Tabs.Content value="files" class="flex-1 min-h-0 overflow-hidden flex flex-col">
                {/* Sub-tabs: Changes / All */}
                <Show when={hasReview()}>
                  <div class="flex items-center gap-1 px-3 py-1.5 border-b border-border-weaker-base">
                    <button
                      class="rounded-md px-2 py-0.5 text-12-regular transition-colors"
                      classList={{
                        "bg-background-hover text-text-primary": fileTreeTab() === "changes",
                        "text-text-weak hover:text-text-primary": fileTreeTab() !== "changes",
                      }}
                      onClick={() => setFileTreeTab("changes")}
                    >
                      {reviewCount()}{" "}
                      {language.t(reviewCount() === 1 ? "session.review.change.one" : "session.review.change.other")}
                    </button>
                    <button
                      class="rounded-md px-2 py-0.5 text-12-regular transition-colors"
                      classList={{
                        "bg-background-hover text-text-primary": fileTreeTab() === "all",
                        "text-text-weak hover:text-text-primary": fileTreeTab() !== "all",
                      }}
                      onClick={() => setFileTreeTab("all")}
                    >
                      {language.t("session.files.all")}
                    </button>
                  </div>
                </Show>

                <div class="flex-1 min-h-0 overflow-y-auto bg-background-stronger px-3 py-0">
                  <Switch>
                    <Match when={fileTreeTab() === "changes" && hasReview()}>
                      <FileTree
                        path=""
                        class="pt-3"
                        allowed={diffFiles()}
                        kinds={kinds()}
                        draggable={false}
                        active={selectedFile() ?? undefined}
                        onFileClick={handleFileClick}
                      />
                    </Match>
                    <Match when={fileTreeTab() === "all" || !hasReview()}>
                      <Switch>
                        <Match when={nofiles()}>
                          <div class="flex items-center justify-center py-8 text-center">
                            <span class="text-12 text-text-weak">{language.t("session.files.empty")}</span>
                          </div>
                        </Match>
                        <Match when={true}>
                          <FileTree
                            path=""
                            class="pt-3"
                            modified={diffFiles()}
                            kinds={kinds()}
                            active={selectedFile() ?? undefined}
                            onFileClick={handleFileClick}
                          />
                        </Match>
                      </Switch>
                    </Match>
                  </Switch>
                </div>
              </Tabs.Content>

              {/* Context tab content */}
              <Tabs.Content value="context" class="flex-1 min-h-0 overflow-y-auto no-scrollbar">
                <ContextPanel />
              </Tabs.Content>
            </Tabs>
          </div>
        </div>
      </aside>
    </Show>
  )
}

/**
 * Context panel: shows MCP connectors and skills, similar to Claude Cowork.
 */
function ContextPanel() {
  const sync = useSync()
  const language = useLanguage()

  const mcpItems = createMemo(() =>
    Object.entries(sync.data.mcp ?? {})
      .map(([name, status]) => ({ name, status: status.status }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  )

  const skills = createMemo(() =>
    (sync.data.command ?? []).filter((c) => c.source === "skill").sort((a, b) => a.name.localeCompare(b.name)),
  )

  const mcpCommands = createMemo(() =>
    (sync.data.command ?? []).filter((c) => c.source === "mcp").sort((a, b) => a.name.localeCompare(b.name)),
  )

  return (
    <div class="flex flex-col gap-4 px-3 py-3">
      {/* Connectors (MCP servers) */}
      <div class="flex flex-col gap-1.5">
        <span class="text-11 font-medium uppercase tracking-wider text-text-dimmed px-1">
          {language.t("v2.context.connectors")}
        </span>
        <Show
          when={mcpItems().length > 0}
          fallback={
            <div class="px-1 py-2 text-12 text-text-weak">
              {language.t("v2.context.noConnectors")}
            </div>
          }
        >
          <div class="flex flex-col gap-0.5">
            <For each={mcpItems()}>
              {(item) => (
                <div class="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-raised-base-hover">
                  <div
                    classList={{
                      "size-1.5 rounded-full shrink-0": true,
                      "bg-icon-success-base": item.status === "connected",
                      "bg-icon-critical-base": item.status === "failed",
                      "bg-border-weak-base": item.status === "disabled",
                      "bg-icon-warning-base": item.status === "needs_auth" || item.status === "needs_client_registration",
                    }}
                  />
                  <span class="text-13 text-text-strong truncate flex-1">{item.name}</span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Skills */}
      <div class="flex flex-col gap-1.5">
        <span class="text-11 font-medium uppercase tracking-wider text-text-dimmed px-1">
          {language.t("v2.context.skills")}
        </span>
        <Show
          when={skills().length > 0}
          fallback={
            <div class="px-1 py-2 text-12 text-text-weak">
              {language.t("v2.context.noSkills")}
            </div>
          }
        >
          <div class="flex flex-col gap-0.5">
            <For each={skills()}>
              {(cmd) => (
                <div class="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-raised-base-hover">
                  <Icon name="task" size="small" class="shrink-0 text-icon-base" />
                  <span class="text-13 text-text-strong truncate flex-1">{cmd.name}</span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* MCP Commands (if any) */}
      <Show when={mcpCommands().length > 0}>
        <div class="flex flex-col gap-1.5">
          <span class="text-11 font-medium uppercase tracking-wider text-text-dimmed px-1">
            {language.t("v2.context.mcpCommands")}
          </span>
          <div class="flex flex-col gap-0.5">
            <For each={mcpCommands()}>
              {(cmd) => (
                <div class="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-raised-base-hover">
                  <Icon name="mcp" size="small" class="shrink-0 text-icon-base" />
                  <div class="flex flex-col min-w-0 flex-1">
                    <span class="text-13 text-text-strong truncate">{cmd.name}</span>
                    <Show when={cmd.description}>
                      <span class="text-11 text-text-weak truncate">{cmd.description}</span>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}
