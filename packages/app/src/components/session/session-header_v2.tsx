import { useLocation, useNavigate, useParams } from "@solidjs/router"
import { createEffect, createMemo, Show, untrack } from "solid-js"
import { createStore } from "solid-js/store"
import { Button } from "@opencode-ai/ui/button"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { useCommand } from "@/context/command"
import { decode64 } from "@/utils/base64"
import { applyPath, backPath, forwardPath } from "@/components/titlebar-history"

/**
 * V2 Top Bar: back/forward nav (left), task title (center), right panel controls (right).
 */
export function SessionHeader() {
  const params = useParams()
  const globalSync = useGlobalSync()
  const language = useLanguage()
  const command = useCommand()
  const navigate = useNavigate()
  const location = useLocation()

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

  // Route history for back/forward navigation
  const [history, setHistory] = createStore({
    stack: [] as string[],
    index: 0,
    action: undefined as "back" | "forward" | undefined,
  })

  const path = () => `${location.pathname}${location.search}${location.hash}`

  createEffect(() => {
    const current = path()
    untrack(() => {
      const next = applyPath(history, current)
      if (next === history) return
      setHistory(next)
    })
  })

  const canBack = createMemo(() => history.index > 0)
  const canForward = createMemo(() => history.index < history.stack.length - 1)

  const back = () => {
    const next = backPath(history)
    if (!next) return
    setHistory(next.state)
    navigate(next.to)
  }

  const forward = () => {
    const next = forwardPath(history)
    if (!next) return
    setHistory(next.state)
    navigate(next.to)
  }

  command.register(() => [
    {
      id: "common.goBack",
      title: language.t("common.goBack"),
      category: language.t("command.category.view"),
      keybind: "mod+[",
      onSelect: back,
    },
    {
      id: "common.goForward",
      title: language.t("common.goForward"),
      category: language.t("command.category.view"),
      keybind: "mod+]",
      onSelect: forward,
    },
  ])

  return (
    <div
      class="flex h-12 shrink-0 items-center border-b border-color-border-base px-4"
      data-component="v2-topbar"
      data-tauri-drag-region
    >
      {/* Left: back/forward */}
      <div class="flex shrink-0 items-center gap-0">
        <Tooltip placement="bottom" value={language.t("common.goBack")} openDelay={2000}>
          <Button
            variant="ghost"
            icon="chevron-left"
            class="w-6 h-6 p-0 box-border"
            disabled={!canBack()}
            onClick={back}
            aria-label={language.t("common.goBack")}
          />
        </Tooltip>
        <Tooltip placement="bottom" value={language.t("common.goForward")} openDelay={2000}>
          <Button
            variant="ghost"
            icon="chevron-right"
            class="w-6 h-6 p-0 box-border"
            disabled={!canForward()}
            onClick={forward}
            aria-label={language.t("common.goForward")}
          />
        </Tooltip>
      </div>

      {/* Center + Right: title centered, panel toggle pinned right with separator */}
      <div class="flex min-w-0 flex-1 items-center">
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

        {/* Right: portal slot for session-level controls (panel toggle etc.) */}
        <div class="flex shrink-0 items-center gap-1" id="v2-topbar-right" data-component="v2-topbar-right">
        </div>
      </div>
    </div>
  )
}
