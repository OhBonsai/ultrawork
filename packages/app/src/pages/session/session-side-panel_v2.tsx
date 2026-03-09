import { Show, Switch, Match, createMemo, createEffect, createSignal, on } from "solid-js"
import { createMediaQuery } from "@solid-primitives/media"
import { useParams } from "@solidjs/router"
import { Tabs } from "@opencode-ai/ui/tabs"
import { useLanguage } from "@/context/language"
import { useSync } from "@/context/sync"
import { useFile } from "@/context/file"
import { useArtifact, extractArtifacts } from "@/context/artifact"
import { ArtifactList } from "@/components/artifact-list"
import { ArtifactPreview } from "@/components/artifact-preview"
import FileTree from "@/components/file-tree"

const PANEL_WIDTH = 320

type PanelTab = "artifacts" | "files"

/**
 * Simple file preview panel for the v2 side panel.
 * Loads and displays file content when a file is selected from the tree.
 */
function FilePreview(props: { filePath: string; onClose: () => void }) {
  const file = useFile()
  const language = useLanguage()

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

  return (
    <div class="flex h-full flex-col overflow-hidden border-r border-border-weaker-base bg-background-base">
      <div class="flex shrink-0 items-center justify-between border-b border-border-weaker-base px-3 py-2">
        <span class="min-w-0 truncate text-12-medium text-text-primary">{filename()}</span>
        <button
          class="shrink-0 rounded p-0.5 text-text-weak hover:bg-background-hover"
          onClick={props.onClose}
          aria-label={language.t("common.close")}
        >
          ✕
        </button>
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
  const panelWidth = createMemo(() => (open() ? `${PANEL_WIDTH}px` : "0px"))

  return (
    <Show when={isDesktop()}>
      <aside
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
        style={{ width: hasPreview() ? `${PANEL_WIDTH * 2}px` : panelWidth() }}
        data-component="v2-side-panel"
      >
        <div
          class="flex h-full border-l border-border-weaker-base"
          style={{ width: hasPreview() ? `${PANEL_WIDTH * 2}px` : `${PANEL_WIDTH}px` }}
        >
          {/* Preview section - left side, between chat and list */}
          <Show when={hasPreview()}>
            <div class="h-full shrink-0 overflow-hidden" style={{ width: `${PANEL_WIDTH}px` }}>
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
            </div>
          </Show>

          {/* Main panel section - right side */}
          <div class="flex h-full shrink-0 flex-col overflow-hidden border-l border-border-weaker-base" style={{ width: `${PANEL_WIDTH}px` }}>
            {/* Tab headers */}
            <Tabs
              variant="pill"
              value={activeTab()}
              onChange={(v) => {
                if (v === "artifacts" || v === "files") setActiveTab(v)
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
            </Tabs>
          </div>
        </div>
      </aside>
    </Show>
  )
}
