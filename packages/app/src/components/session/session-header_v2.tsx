import { useParams } from "@solidjs/router"
import { createMemo, Show } from "solid-js"
import { useGlobalSync } from "@/context/global-sync"
import { decode64 } from "@/utils/base64"

/**
 * V2 Top Bar: sidebar toggle (left), task title (center), right panel toggle (right).
 * The sidebar toggle is handled by the sidebar itself via the shared persisted state.
 * This component renders the task title and right panel controls.
 */
export function SessionHeader() {
  const params = useParams()
  const globalSync = useGlobalSync()

  const directory = createMemo(() => (params.dir ? decode64(params.dir) ?? "" : ""))
  const sessionId = createMemo(() => params.id)

  const sessionTitle = createMemo(() => {
    const dir = directory()
    const id = sessionId()
    if (!dir || !id) return ""

    const [store] = globalSync.child(dir, { bootstrap: false })
    const session = store.session?.find((s) => s.id === id)
    return session?.title ?? ""
  })

  const isSessionView = createMemo(() => !!params.dir && !!params.id)

  return (
    <div
      class="flex h-12 shrink-0 items-center border-b border-color-border-base px-4"
      data-component="v2-topbar"
    >
      {/* Center: task title */}
      <div class="flex min-w-0 flex-1 items-center justify-center">
        <Show when={isSessionView()}>
          <span class="max-w-md truncate text-13 text-text-strong">
            {sessionTitle()}
          </span>
        </Show>
        <Show when={!isSessionView()}>
          <span class="text-13 text-text-dimmed">
            UltraWork
          </span>
        </Show>
      </div>

      {/* Right: placeholder for right panel toggle (Phase 1C) */}
      <div class="flex shrink-0 items-center gap-1" data-component="v2-topbar-right">
        {/* Right panel toggle will be added in Phase 1C */}
      </div>
    </div>
  )
}
