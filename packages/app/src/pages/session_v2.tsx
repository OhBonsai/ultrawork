import type { UserMessage } from "@opencode-ai/sdk/v2"
import {
  Show,
  createMemo,
  createEffect,
  createComputed,
  on,
  onMount,
  onCleanup,
  untrack,
} from "solid-js"
import { createStore } from "solid-js/store"
import { createMediaQuery } from "@solid-primitives/media"
import { createResizeObserver } from "@solid-primitives/resize-observer"
import { createAutoScroll } from "@opencode-ai/ui/hooks"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useParams } from "@solidjs/router"
import { useLocal } from "@/context/local"
import { useComments } from "@/context/comments"
import { useLanguage } from "@/context/language"
import { usePrompt } from "@/context/prompt"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { ArtifactProvider } from "@/context/artifact"
import { createSessionComposerState, SessionComposerRegion } from "@/pages/session/composer"
import { MessageTimeline } from "@/pages/session/message-timeline"
import { resetSessionModel, syncSessionModel } from "@/pages/session/session-model-helpers"
import { createScrollSpy } from "@/pages/session/scroll-spy"
import { useSessionHashScroll } from "@/pages/session/use-session-hash-scroll"
import { same } from "@/utils/same"
import { SessionSidePanel } from "@/pages/session/session-side-panel_v2"

const emptyUserMessages: UserMessage[] = []

/**
 * Windowed history rendering for the message timeline.
 * Shows only recent turns initially, reveals older turns in batches on scroll.
 */
function createSessionHistoryWindow(input: {
  sessionID: () => string | undefined
  messagesReady: () => boolean
  visibleUserMessages: () => UserMessage[]
  historyMore: () => boolean
  historyLoading: () => boolean
  loadMore: (sessionID: string) => Promise<void>
  userScrolled: () => boolean
  scroller: () => HTMLDivElement | undefined
}) {
  const turnInit = 10
  const turnBatch = 8
  const turnScrollThreshold = 200
  const turnPrefetchBuffer = 16
  const prefetchCooldownMs = 400
  const prefetchNoGrowthLimit = 2

  const [state, setState] = createStore({
    turnID: undefined as string | undefined,
    turnStart: 0,
    prefetchUntil: 0,
    prefetchNoGrowth: 0,
  })

  const initialTurnStart = (len: number) => (len > turnInit ? len - turnInit : 0)

  const turnStart = createMemo(() => {
    const id = input.sessionID()
    const len = input.visibleUserMessages().length
    if (!id || len <= 0) return 0
    if (state.turnID !== id) return initialTurnStart(len)
    if (state.turnStart <= 0) return 0
    if (state.turnStart >= len) return initialTurnStart(len)
    return state.turnStart
  })

  const setTurnStart = (start: number) => {
    const id = input.sessionID()
    const next = start > 0 ? start : 0
    if (!id) {
      setState({ turnID: undefined, turnStart: next })
      return
    }
    setState({ turnID: id, turnStart: next })
  }

  const renderedUserMessages = createMemo(
    () => {
      const msgs = input.visibleUserMessages()
      const start = turnStart()
      if (start <= 0) return msgs
      return msgs.slice(start)
    },
    emptyUserMessages,
    { equals: same },
  )

  const preserveScroll = (fn: () => void) => {
    const el = input.scroller()
    if (!el) {
      fn()
      return
    }
    const beforeTop = el.scrollTop
    fn()
    void el.scrollHeight
    el.scrollTop = beforeTop
  }

  const backfillTurns = () => {
    const start = turnStart()
    if (start <= 0) return
    const next = start - turnBatch
    preserveScroll(() => setTurnStart(next > 0 ? next : 0))
  }

  const loadAndReveal = async () => {
    const id = input.sessionID()
    if (!id) return

    const start = turnStart()
    const beforeVisible = input.visibleUserMessages().length

    if (start > 0) setTurnStart(0)
    if (!input.historyMore() || input.historyLoading()) return

    await input.loadMore(id)
    if (input.sessionID() !== id) return

    const afterVisible = input.visibleUserMessages().length
    const growth = afterVisible - beforeVisible
    if (state.prefetchNoGrowth) setState("prefetchNoGrowth", 0)
    if (growth <= 0) return
    if (turnStart() !== 0) return

    const target = Math.min(afterVisible, Math.max(beforeVisible, renderedUserMessages().length) + turnBatch)
    const nextStart = Math.max(0, afterVisible - target)
    preserveScroll(() => setTurnStart(nextStart))
  }

  const fetchOlderMessages = async (opts?: { prefetch?: boolean }) => {
    const id = input.sessionID()
    if (!id) return
    if (!input.historyMore() || input.historyLoading()) return

    if (opts?.prefetch) {
      const now = Date.now()
      if (state.prefetchUntil > now) return
      if (state.prefetchNoGrowth >= prefetchNoGrowthLimit) return
      setState("prefetchUntil", now + prefetchCooldownMs)
    }

    const start = turnStart()
    const beforeVisible = input.visibleUserMessages().length
    const beforeRendered = start <= 0 ? beforeVisible : renderedUserMessages().length

    await input.loadMore(id)
    if (input.sessionID() !== id) return

    const afterVisible = input.visibleUserMessages().length
    const growth = afterVisible - beforeVisible

    if (opts?.prefetch) {
      setState("prefetchNoGrowth", growth > 0 ? 0 : state.prefetchNoGrowth + 1)
    } else if (growth > 0 && state.prefetchNoGrowth) {
      setState("prefetchNoGrowth", 0)
    }

    if (growth <= 0) return
    if (turnStart() !== start) return

    const reveal = !opts?.prefetch
    const currentRendered = renderedUserMessages().length
    const base = Math.max(beforeRendered, currentRendered)
    const target = reveal ? Math.min(afterVisible, base + turnBatch) : base
    const nextStart = Math.max(0, afterVisible - target)
    preserveScroll(() => setTurnStart(nextStart))
  }

  const onScrollerScroll = () => {
    if (!input.userScrolled()) return
    const el = input.scroller()
    if (!el) return
    if (el.scrollHeight - el.clientHeight + el.scrollTop >= turnScrollThreshold) return

    const start = turnStart()
    if (start > 0) {
      if (start <= turnPrefetchBuffer) {
        void fetchOlderMessages({ prefetch: true })
      }
      backfillTurns()
      return
    }
    void fetchOlderMessages()
  }

  createEffect(
    on(input.sessionID, () => {
      setState({ prefetchUntil: 0, prefetchNoGrowth: 0 })
    }, { defer: true }),
  )

  createEffect(
    on(
      () => [input.sessionID(), input.messagesReady()] as const,
      ([id, ready]) => {
        if (!id || !ready) return
        setTurnStart(initialTurnStart(input.visibleUserMessages().length))
      },
      { defer: true },
    ),
  )

  return {
    turnStart,
    setTurnStart,
    renderedUserMessages,
    loadAndReveal,
    onScrollerScroll,
  }
}

export default function SessionV2() {
  const params = useParams()
  const sdk = useSDK()
  const sync = useSync()
  const local = useLocal()
  const language = useLanguage()
  const dialog = useDialog()
  const comments = useComments()
  const prompt = usePrompt()
  const isDesktop = createMediaQuery("(min-width: 768px)")

  const [ui, setUi] = createStore({
    pendingMessage: undefined as string | undefined,
    scrollGesture: 0,
    scroll: { overflow: false, bottom: true },
  })

  const composer = createSessionComposerState()
  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)

  // Trigger session data loading
  createEffect(
    on([() => sdk.directory, () => params.id] as const, ([, id]) => {
      if (!id) return
      untrack(() => {
        void sync.session.sync(id)
        void sync.session.todo(id)
      })
    }),
  )

  // Also load diffs for the artifact panel
  createEffect(() => {
    const id = params.id
    if (!id) return
    if (sync.data.session_diff[id] !== undefined) return
    if (sync.status === "loading") return
    void sync.session.diff(id)
  })

  // Message state
  const info = createMemo(() => (params.id ? sync.session.get(params.id) : undefined))
  const revertMessageID = createMemo(() => info()?.revert?.messageID)
  const messages = createMemo(() => (params.id ? (sync.data.message[params.id] ?? []) : []))
  const messagesReady = createMemo(() => {
    const id = params.id
    if (!id) return true
    return sync.data.message[id] !== undefined
  })
  const historyMore = createMemo(() => {
    const id = params.id
    if (!id) return false
    return sync.session.history.more(id)
  })
  const historyLoading = createMemo(() => {
    const id = params.id
    if (!id) return false
    return sync.session.history.loading(id)
  })

  const userMessages = createMemo(
    () => messages().filter((m) => m.role === "user") as UserMessage[],
    emptyUserMessages,
    { equals: same },
  )
  const visibleUserMessages = createMemo(
    () => {
      const revert = revertMessageID()
      if (!revert) return userMessages()
      return userMessages().filter((m) => m.id < revert)
    },
    emptyUserMessages,
    { equals: same },
  )
  const lastUserMessage = createMemo(() => visibleUserMessages().at(-1))

  // Sync session model
  createEffect(
    on(
      () => lastUserMessage()?.id,
      () => {
        const msg = lastUserMessage()
        if (!msg) return
        syncSessionModel(local, msg)
      },
    ),
  )

  createEffect(
    on(
      () => params.id,
      (id, prev) => {
        if (id || !prev) return
        resetSessionModel(local)
      },
      { defer: true },
    ),
  )

  // UI state
  const [store, setStore] = createStore({
    messageId: undefined as string | undefined,
    deferRender: false,
  })

  createComputed((prev) => {
    const key = sessionKey()
    if (key !== prev) {
      setStore("deferRender", true)
      requestAnimationFrame(() => {
        setTimeout(() => setStore("deferRender", false), 0)
      })
    }
    return key
  }, sessionKey())

  const activeMessage = createMemo(() => {
    if (!store.messageId) return lastUserMessage()
    const found = visibleUserMessages()?.find((m) => m.id === store.messageId)
    return found ?? lastUserMessage()
  })
  const setActiveMessage = (message: UserMessage | undefined) => {
    setStore("messageId", message?.id)
  }

  // Scroll & refs
  let inputRef!: HTMLDivElement
  let promptDock: HTMLDivElement | undefined
  let dockHeight = 0
  let scroller: HTMLDivElement | undefined
  let content: HTMLDivElement | undefined

  const scrollGestureWindowMs = 250
  const markScrollGesture = (target?: EventTarget | null) => {
    const root = scroller
    if (!root) return
    const el = target instanceof Element ? target : undefined
    const nested = el?.closest("[data-scrollable]")
    if (nested && nested !== root) return
    setUi("scrollGesture", Date.now())
  }
  const hasScrollGesture = () => Date.now() - ui.scrollGesture < scrollGestureWindowMs

  const autoScroll = createAutoScroll({
    working: () => true,
    overflowAnchor: "dynamic",
  })

  let scrollStateFrame: number | undefined
  let scrollStateTarget: HTMLDivElement | undefined
  const scrollSpy = createScrollSpy({
    onActive: (id) => {
      if (id === store.messageId) return
      setStore("messageId", id)
    },
  })

  const updateScrollState = (el: HTMLDivElement) => {
    const max = el.scrollHeight - el.clientHeight
    const overflow = max > 1
    const bottom = !overflow || Math.abs(el.scrollTop) <= 2 || !autoScroll.userScrolled()
    if (ui.scroll.overflow === overflow && ui.scroll.bottom === bottom) return
    setUi("scroll", { overflow, bottom })
  }

  const scheduleScrollState = (el: HTMLDivElement) => {
    scrollStateTarget = el
    if (scrollStateFrame !== undefined) return
    scrollStateFrame = requestAnimationFrame(() => {
      scrollStateFrame = undefined
      const target = scrollStateTarget
      scrollStateTarget = undefined
      if (!target) return
      updateScrollState(target)
    })
  }

  const resumeScroll = () => {
    setStore("messageId", undefined)
    autoScroll.smoothScrollToBottom()
    clearMessageHash()
    const el = scroller
    if (el) scheduleScrollState(el)
  }

  createEffect(
    on(autoScroll.userScrolled, (scrolled) => {
      if (scrolled) return
      setStore("messageId", undefined)
      clearMessageHash()
    }, { defer: true }),
  )

  createEffect(
    on(sessionKey, () => {
      scrollSpy.clear()
    }, { defer: true }),
  )

  const anchor = (id: string) => `message-${id}`

  const setScrollRef = (el: HTMLDivElement | undefined) => {
    scroller = el
    autoScroll.scrollRef(el)
    scrollSpy.setContainer(el)
    if (el) scheduleScrollState(el)
  }

  createResizeObserver(
    () => content,
    () => {
      const el = scroller
      if (el) scheduleScrollState(el)
      scrollSpy.markDirty()
    },
  )

  const historyWindow = createSessionHistoryWindow({
    sessionID: () => params.id,
    messagesReady,
    visibleUserMessages,
    historyMore,
    historyLoading,
    loadMore: (sessionID) => sync.session.history.loadMore(sessionID),
    userScrolled: autoScroll.userScrolled,
    scroller: () => scroller,
  })

  createResizeObserver(
    () => promptDock,
    ({ height }) => {
      const next = Math.ceil(height)
      if (next === dockHeight) return
      const el = scroller
      const delta = next - dockHeight
      const stick = el ? Math.abs(el.scrollTop) < 10 + Math.max(0, delta) : false
      dockHeight = next
      if (stick) autoScroll.smoothScrollToBottom()
      if (el) scheduleScrollState(el)
      scrollSpy.markDirty()
    },
  )

  const { clearMessageHash } = useSessionHashScroll({
    sessionKey,
    sessionID: () => params.id,
    messagesReady,
    visibleUserMessages,
    turnStart: historyWindow.turnStart,
    currentMessageId: () => store.messageId,
    pendingMessage: () => ui.pendingMessage,
    setPendingMessage: (value) => setUi("pendingMessage", value),
    setActiveMessage,
    setTurnStart: historyWindow.setTurnStart,
    autoScroll,
    scroller: () => scroller,
    anchor,
    scheduleScrollState,
    consumePendingMessage: () => undefined,
  })

  // Keyboard: auto-focus chat input on typing
  const isEditableTarget = (target: EventTarget | null | undefined) => {
    if (!(target instanceof HTMLElement)) return false
    return /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName) || target.isContentEditable
  }

  const deepActiveElement = () => {
    let current: Element | null = document.activeElement
    while (current instanceof HTMLElement && current.shadowRoot?.activeElement) {
      current = current.shadowRoot.activeElement
    }
    return current instanceof HTMLElement ? current : undefined
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    const path = event.composedPath()
    const target = path.find((item): item is HTMLElement => item instanceof HTMLElement)
    const activeElement = deepActiveElement()

    const protectedTarget = path.some(
      (item) => item instanceof HTMLElement && item.closest("[data-prevent-autofocus]") !== null,
    )
    if (protectedTarget || isEditableTarget(target)) return

    if (activeElement) {
      const isProtected = activeElement.closest("[data-prevent-autofocus]")
      const isInput = isEditableTarget(activeElement)
      if (isProtected || isInput) return
    }
    if (dialog.active) return

    if (activeElement === inputRef) {
      if (event.key === "Escape") inputRef?.blur()
      return
    }

    if (event.key === "PageUp" || event.key === "PageDown" || event.key === "Home" || event.key === "End") {
      markScrollGesture()
      return
    }

    if (event.key.length === 1 && event.key !== "Unidentified" && !(event.ctrlKey || event.metaKey)) {
      if (composer.blocked()) return
      inputRef?.focus()
    }
  }

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown)
  })

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown)
    scrollSpy.destroy()
    if (scrollStateFrame !== undefined) cancelAnimationFrame(scrollStateFrame)
  })

  return (
    <ArtifactProvider>
      <div class="flex size-full min-h-0" data-component="v2-session">
        {/* Chat area */}
        <div class="@container relative flex min-w-0 flex-1 flex-col min-h-0 bg-background-stronger">
          <div class="flex-1 min-h-0 overflow-hidden">
            <Show when={activeMessage()}>
              <MessageTimeline
                mobileChanges={false}
                mobileFallback={null}
                scroll={ui.scroll}
                onResumeScroll={resumeScroll}
                setScrollRef={setScrollRef}
                onScheduleScrollState={scheduleScrollState}
                onAutoScrollHandleScroll={autoScroll.handleScroll}
                onMarkScrollGesture={markScrollGesture}
                hasScrollGesture={hasScrollGesture}
                isDesktop={isDesktop()}
                onScrollSpyScroll={scrollSpy.onScroll}
                onTurnBackfillScroll={historyWindow.onScrollerScroll}
                onAutoScrollInteraction={autoScroll.handleInteraction}
                onPreserveScrollAnchor={autoScroll.preserve}
                centered={true}
                setContentRef={(el) => {
                  content = el
                  autoScroll.contentRef(el)
                  const root = scroller
                  if (root) scheduleScrollState(root)
                }}
                turnStart={historyWindow.turnStart()}
                historyMore={historyMore()}
                historyLoading={historyLoading()}
                onLoadEarlier={() => {
                  void historyWindow.loadAndReveal()
                }}
                renderedUserMessages={historyWindow.renderedUserMessages()}
                anchor={anchor}
                onRegisterMessage={scrollSpy.register}
                onUnregisterMessage={scrollSpy.unregister}
              />
            </Show>
          </div>

          <SessionComposerRegion
            state={composer}
            ready={!store.deferRender && messagesReady()}
            centered={true}
            inputRef={(el) => {
              inputRef = el
            }}
            newSessionWorktree="main"
            onNewSessionWorktreeReset={() => {}}
            onSubmit={() => {
              comments.clear()
              resumeScroll()
            }}
            onResponseSubmit={resumeScroll}
            setPromptDockRef={(el) => {
              promptDock = el
            }}
          />
        </div>

        {/* Right side panel - artifacts */}
        <SessionSidePanel />
      </div>
    </ArtifactProvider>
  )
}
