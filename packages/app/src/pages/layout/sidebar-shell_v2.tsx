import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { showToast } from "@opencode-ai/ui/toast"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@opencode-ai/util/encode"
import { createMemo, createSignal, type Accessor, type JSX, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "@/context/global-sync"
import { Persist, persisted } from "@/utils/persist"
import { createStore } from "solid-js/store"
import { SidebarUserProfile } from "./sidebar-user-profile"
import { TaskList } from "./sidebar-task-list"

const SIDEBAR_EXPANDED_WIDTH = 210
const SIDEBAR_COLLAPSED_WIDTH = 48

/**
 * V2 Sidebar: single-layer collapsible sidebar.
 * Expanded ~210px shows task list + labels.
 * Collapsed ~48px shows icons only.
 */
export function SidebarShell() {
  const language = useLanguage()
  const layout = useLayout()

  const [state, setState] = persisted(
    Persist.global("sidebar.v2", ["sidebar.v2"]),
    createStore({ expanded: true }),
  )

  const expanded = createMemo(() => state.expanded)
  const width = createMemo(() => (expanded() ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH))

  const toggle = () => setState("expanded", (v) => !v)

  // Use the first project as current directory (V1 scope: single directory)
  const currentProject = createMemo(() => {
    const projects = layout.projects.list()
    return projects[0]
  })

  const directory = createMemo(() => currentProject()?.worktree ?? "")

  return (
    <div
      class="flex h-full shrink-0 flex-col border-r border-color-border-base bg-color-bg-base transition-[width] duration-200"
      style={{ width: `${width()}px` }}
      data-component="v2-sidebar"
      data-expanded={expanded() ? "" : undefined}
    >
      {/* Top section: toggle + new task */}
      <div
        class="flex shrink-0 items-center border-b border-color-border-base"
        classList={{
          "justify-between px-3 h-12": expanded(),
          "justify-center h-12": !expanded(),
        }}
      >
        <Show when={expanded()}>
          <span class="text-14-medium text-text-strong">UltraWork</span>
        </Show>
        <Tooltip placement="right" value={language.t("command.sidebar.toggle")}>
          <IconButton
            icon={expanded() ? "layout-left-full" : "layout-left-partial"}
            variant="ghost"
            class="size-7"
            aria-label={language.t("command.sidebar.toggle")}
            aria-expanded={expanded()}
            onClick={toggle}
          />
        </Tooltip>
      </div>

      {/* New task button */}
      <div class="shrink-0 px-2 py-2">
        <NewTaskButton expanded={expanded} directory={directory} language={language} />
      </div>

      {/* Task list */}
      <div class="min-h-0 flex-1 overflow-y-auto no-scrollbar" data-component="v2-task-list">
        <Show when={directory()}>
          <TaskList directory={directory()} collapsed={createMemo(() => !expanded())} />
        </Show>
      </div>

      {/* Bottom: User profile + settings popover */}
      <SidebarUserProfile />
    </div>
  )
}

function NewTaskButton(props: {
  expanded: Accessor<boolean>
  directory: Accessor<string>
  language: ReturnType<typeof useLanguage>
}) {
  const navigate = useNavigate()
  const globalSDK = useGlobalSDK()
  const sync = useGlobalSync()
  const label = () => props.language.t("command.session.new")
  const [creating, setCreating] = createSignal(false)

  const handleClick = async () => {
    const dir = props.directory()
    if (!dir || creating()) {
      navigate("/", { replace: false })
      return
    }

    setCreating(true)
    try {
      const client = globalSDK.createClient({
        directory: dir,
        throwOnError: true,
      })
      sync.child(dir)

      const session = await client.session.create()
      const sessionData = session.data
      if (!sessionData) {
        showToast({
          variant: "error",
          title: props.language.t("prompt.toast.sessionCreateFailed.title"),
        })
        return
      }

      const dirSlug = base64Encode(dir)
      navigate(`/task/${dirSlug}/${sessionData.id}`)
    } catch {
      navigate("/", { replace: false })
    } finally {
      setCreating(false)
    }
  }

  return (
    <Show
      when={props.expanded()}
      fallback={
        <Tooltip placement="right" value={label()} gutter={10}>
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-center rounded-md p-2 text-text-strong hover:bg-surface-raised-base-hover focus:outline-none"
            aria-label={label()}
            disabled={creating()}
            onClick={handleClick}
          >
            <Icon name="plus" size="small" />
          </button>
        </Tooltip>
      }
    >
      <button
        type="button"
        class="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-text-strong hover:bg-surface-raised-base-hover focus:outline-none"
        disabled={creating()}
        onClick={handleClick}
      >
        <Icon name="plus" size="small" />
        <span class="text-13">{label()}</span>
      </button>
    </Show>
  )
}
