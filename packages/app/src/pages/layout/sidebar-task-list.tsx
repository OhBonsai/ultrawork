import type { Session } from "@opencode-ai/sdk/v2/client"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Spinner } from "@opencode-ai/ui/spinner"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { base64Encode } from "@opencode-ai/util/encode"
import { A, useNavigate, useParams } from "@solidjs/router"
import { createMemo, For, Show, type Accessor } from "solid-js"
import { produce } from "solid-js/store"
import { Binary } from "@opencode-ai/util/binary"
import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useNotification } from "@/context/notification"
import { usePermission } from "@/context/permission"
import { sessionPermissionRequest } from "../session/composer/session-request-tree"

const MAX_TASKS = 10

type SessionWithDir = Session & { _directory: string; _slug: string }

/**
 * Global task list: aggregates sessions from ALL workspaces,
 * sorted by updated time (desc), max 10.
 */
export function TaskList(props: { collapsed: Accessor<boolean> }) {
  const globalSync = useGlobalSync()
  const globalSDK = useGlobalSDK()
  const layout = useLayout()
  const language = useLanguage()
  const notification = useNotification()
  const permission = usePermission()
  const navigate = useNavigate()
  const params = useParams()

  const allDirectories = createMemo(() =>
    layout.projects.list().map((p) => p.worktree),
  )

  const sorted = createMemo(() => {
    const dirs = allDirectories()
    const seen = new Set<string>()
    const all: SessionWithDir[] = []

    for (const dir of dirs) {
      const [store] = globalSync.child(dir, { bootstrap: false })
      const sessions = store.session ?? []
      const slug = base64Encode(dir)
      for (const s of sessions) {
        if (seen.has(s.id)) continue
        seen.add(s.id)
        all.push({ ...s, _directory: dir, _slug: slug })
      }
    }

    // Sort: running first, then by updated time desc
    all.sort((a, b) => {
      const aStore = globalSync.child(a._directory, { bootstrap: false })[0]
      const bStore = globalSync.child(b._directory, { bootstrap: false })[0]
      const aStatus = aStore.session_status[a.id]
      const bStatus = bStore.session_status[b.id]
      const aRunning = aStatus?.type === "busy" || aStatus?.type === "retry"
      const bRunning = bStatus?.type === "busy" || bStatus?.type === "retry"

      if (aRunning && !bRunning) return -1
      if (!aRunning && bRunning) return 1
      return (b.time?.updated ?? 0) - (a.time?.updated ?? 0)
    })

    return all.slice(0, MAX_TASKS)
  })

  async function archiveSession(session: SessionWithDir) {
    await globalSDK.client.session.update({
      directory: session._directory,
      sessionID: session.id,
      time: { archived: Date.now() },
    })

    const [, setStore] = globalSync.child(session._directory)
    setStore(
      produce((draft) => {
        const match = Binary.search(draft.session, session.id, (s) => s.id)
        if (match.found) draft.session.splice(match.index, 1)
      }),
    )

    if (session.id === params.id) {
      navigate("/")
    }
  }

  return (
    <div class="flex flex-col gap-0.5 px-2" data-component="v2-task-list-inner">
      <Show when={!props.collapsed()}>
        <div class="px-2 py-1">
          <span class="text-11 font-medium uppercase tracking-wider text-text-dimmed">
            {language.t("v2.sidebar.tasks")}
          </span>
        </div>
      </Show>

      <For each={sorted()}>
        {(session) => (
          <TaskItem
            session={session}
            collapsed={props.collapsed}
            globalSync={globalSync}
            notification={notification}
            permission={permission}
            language={language}
            archiveSession={archiveSession}
          />
        )}
      </For>

      <Show when={sorted().length === 0 && !props.collapsed()}>
        <div class="px-2 py-3 text-center">
          <span class="text-12 text-text-dimmed-extra">—</span>
        </div>
      </Show>
    </div>
  )
}

function TaskItem(props: {
  session: SessionWithDir
  collapsed: Accessor<boolean>
  globalSync: ReturnType<typeof useGlobalSync>
  notification: ReturnType<typeof useNotification>
  permission: ReturnType<typeof usePermission>
  language: ReturnType<typeof useLanguage>
  archiveSession: (session: SessionWithDir) => Promise<void>
}) {
  const params = useParams()

  const isActive = createMemo(() => props.session.id === params.id)

  const store = createMemo(
    () => props.globalSync.child(props.session._directory, { bootstrap: false })[0],
  )

  const hasPermissions = createMemo(() => {
    const s = store()
    return !!sessionPermissionRequest(
      s.session,
      s.permission,
      props.session.id,
      (item) => !props.permission.autoResponds(item, props.session._directory),
    )
  })

  const isWorking = createMemo(() => {
    if (hasPermissions()) return false
    const status = store().session_status[props.session.id]
    return status?.type === "busy" || status?.type === "retry"
  })

  const hasError = createMemo(() => props.notification.session.unseenHasError(props.session.id))
  const unseenCount = createMemo(() => props.notification.session.unseenCount(props.session.id))

  const statusIcon = createMemo(() => {
    if (isWorking()) return "working" as const
    if (hasPermissions()) return "permission" as const
    if (hasError()) return "error" as const
    if (unseenCount() > 0) return "unseen" as const
    return "none" as const
  })

  const href = createMemo(() => `/task/${props.session._slug}/${props.session.id}`)

  return (
    <div
      data-session-id={props.session.id}
      class="group/task relative rounded-md transition-colors"
      classList={{
        "bg-surface-base-active": isActive(),
        "hover:bg-surface-raised-base-hover": !isActive(),
      }}
    >
      <Show
        when={props.collapsed()}
        fallback={
          <A
            href={href()}
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left focus:outline-none"
          >
            <StatusIndicator status={statusIcon()} />
            <span class="min-w-0 flex-1 truncate text-13 text-text-strong">
              {props.session.title}
            </span>
          </A>
        }
      >
        <Tooltip placement="right" value={props.session.title} gutter={10}>
          <A
            href={href()}
            class="flex w-full items-center justify-center rounded-md p-2 focus:outline-none"
          >
            <StatusIndicator status={statusIcon()} />
          </A>
        </Tooltip>
      </Show>

      <Show when={!props.collapsed()}>
        <div class="absolute right-1 top-1 flex items-center opacity-0 transition-opacity group-hover/task:opacity-100 group-focus-within/task:opacity-100">
          <Tooltip value={props.language.t("common.archive")} placement="top">
            <IconButton
              icon="archive"
              variant="ghost"
              class="size-6 rounded-md"
              aria-label={props.language.t("common.archive")}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void props.archiveSession(props.session)
              }}
            />
          </Tooltip>
        </div>
      </Show>
    </div>
  )
}

function StatusIndicator(props: { status: "working" | "permission" | "error" | "unseen" | "none" }) {
  return (
    <div class="flex size-5 shrink-0 items-center justify-center">
      <Show when={props.status === "working"}>
        <Spinner class="size-3.5" />
      </Show>
      <Show when={props.status === "permission"}>
        <div class="size-1.5 rounded-full bg-surface-warning-strong" />
      </Show>
      <Show when={props.status === "error"}>
        <div class="size-1.5 rounded-full bg-text-diff-delete-base" />
      </Show>
      <Show when={props.status === "unseen"}>
        <div class="size-1.5 rounded-full bg-text-interactive-base" />
      </Show>
      <Show when={props.status === "none"}>
        <Icon name="dash" size="small" class="text-icon-weak" />
      </Show>
    </div>
  )
}
