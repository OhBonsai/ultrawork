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

/**
 * Flat session list for a single directory.
 * Running sessions are pinned to the top.
 */
export function TaskList(props: {
  directory: string
  collapsed: Accessor<boolean>
}) {
  const globalSync = useGlobalSync()
  const globalSDK = useGlobalSDK()
  const language = useLanguage()
  const notification = useNotification()
  const permission = usePermission()
  const navigate = useNavigate()
  const params = useParams()

  const [store, setStore] = globalSync.child(props.directory)
  const slug = createMemo(() => base64Encode(props.directory))

  const sorted = createMemo(() => {
    const sessions = store.session ?? []
    const limited = sessions.slice(0, MAX_TASKS)

    return [...limited].sort((a, b) => {
      const aStatus = store.session_status[a.id]
      const bStatus = store.session_status[b.id]
      const aRunning = aStatus?.type === "busy" || aStatus?.type === "retry"
      const bRunning = bStatus?.type === "busy" || bStatus?.type === "retry"

      if (aRunning && !bRunning) return -1
      if (!aRunning && bRunning) return 1
      return 0
    })
  })

  async function archiveSession(session: Session) {
    const sessions = store.session ?? []
    const index = sessions.findIndex((s) => s.id === session.id)
    const nextSession = sessions[index + 1] ?? sessions[index - 1]

    await globalSDK.client.session.update({
      directory: session.directory,
      sessionID: session.id,
      time: { archived: Date.now() },
    })
    setStore(
      produce((draft) => {
        const match = Binary.search(draft.session, session.id, (s) => s.id)
        if (match.found) draft.session.splice(match.index, 1)
      }),
    )
    if (session.id === params.id) {
      if (nextSession) {
        navigate(`/task/${slug()}/${nextSession.id}`)
      } else {
        navigate("/")
      }
    }
  }

  return (
    <div class="flex flex-col gap-0.5 px-2" data-component="v2-task-list-inner">
      <Show when={!props.collapsed()}>
        <div class="px-2 py-1">
          <span class="text-11 font-medium uppercase tracking-wider text-text-dimmed">
            {language.t("command.category.session")}
          </span>
        </div>
      </Show>

      <For each={sorted()}>
        {(session) => (
          <TaskItem
            session={session}
            slug={slug()}
            collapsed={props.collapsed}
            store={store}
            notification={notification}
            permission={permission}
            language={language}
            archiveSession={archiveSession}
          />
        )}
      </For>

      <Show when={sorted().length === 0 && !props.collapsed()}>
        <div class="px-2 py-3 text-center">
          <Show
            when={store.status !== "loading"}
            fallback={<span class="text-12 text-text-dimmed">{language.t("session.messages.loading")}</span>}
          >
            <span class="text-12 text-text-dimmed-extra">—</span>
          </Show>
        </div>
      </Show>
    </div>
  )
}

function TaskItem(props: {
  session: Session
  slug: string
  collapsed: Accessor<boolean>
  store: ReturnType<ReturnType<typeof useGlobalSync>["child"]>[0]
  notification: ReturnType<typeof useNotification>
  permission: ReturnType<typeof usePermission>
  language: ReturnType<typeof useLanguage>
  archiveSession: (session: Session) => Promise<void>
}) {
  const params = useParams()

  const isActive = createMemo(() => props.session.id === params.id)

  const hasPermissions = createMemo(() => {
    return !!sessionPermissionRequest(
      props.store.session,
      props.store.permission,
      props.session.id,
      (item) => !props.permission.autoResponds(item, props.session.directory),
    )
  })

  const isWorking = createMemo(() => {
    if (hasPermissions()) return false
    const status = props.store.session_status[props.session.id]
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

  const href = createMemo(() => `/task/${props.slug}/${props.session.id}`)

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
