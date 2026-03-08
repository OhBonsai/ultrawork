import { Show, createMemo, createEffect, on } from "solid-js"
import { createMediaQuery } from "@solid-primitives/media"
import { useParams } from "@solidjs/router"
import { useLanguage } from "@/context/language"
import { useSync } from "@/context/sync"
import { useArtifact, extractArtifacts } from "@/context/artifact"
import { ArtifactList } from "@/components/artifact-list"
import { ArtifactPreview } from "@/components/artifact-preview"

const PANEL_WIDTH = 320

export function SessionSidePanel() {
  const params = useParams()
  const sync = useSync()
  const language = useLanguage()
  const artifact = useArtifact()
  const isDesktop = createMediaQuery("(min-width: 768px)")

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

  const open = createMemo(() => isDesktop() && artifact.panelOpen)
  const panelWidth = createMemo(() => (open() ? `${PANEL_WIDTH}px` : "0px"))
  const hasPreview = createMemo(() => !!artifact.selected)

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
          {/* Artifact list section */}
          <div class="h-full shrink-0 overflow-hidden" style={{ width: `${PANEL_WIDTH}px` }}>
            <ArtifactList />
          </div>

          {/* Preview section - slides in when artifact selected */}
          <Show when={hasPreview()}>
            <div class="h-full shrink-0 overflow-hidden" style={{ width: `${PANEL_WIDTH}px` }}>
              <ArtifactPreview />
            </div>
          </Show>
        </div>
      </aside>
    </Show>
  )
}
