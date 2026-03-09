import { Popover as Kobalte } from "@kobalte/core/popover"
import { createMemo, createSignal, For, Show } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { DialogSelectDirectory } from "@/components/dialog-select-directory"
import { getFilename } from "@opencode-ai/util/path"

interface WorkspaceSelectorProps {
  selected: string | undefined
  onSelect: (directory: string) => void
}

export function WorkspaceSelector(props: WorkspaceSelectorProps) {
  const sync = useGlobalSync()
  const layout = useLayout()
  const language = useLanguage()
  const dialog = useDialog()
  const platform = usePlatform()
  const server = useServer()

  const [open, setOpen] = createSignal(false)

  const homedir = createMemo(() => sync.data.path.home)

  const recentProjects = createMemo(() => {
    return sync.data.project
      .slice()
      .sort((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
      .slice(0, 10)
  })

  const displayName = createMemo(() => {
    const dir = props.selected
    if (!dir) return language.t("home.v2.workspace.select")
    return dir.replace(homedir(), "~")
  })

  function selectDirectory(directory: string) {
    props.onSelect(directory)
    setOpen(false)
  }

  async function browseDirectory() {
    setOpen(false)

    function resolve(result: string | string[] | null) {
      if (Array.isArray(result)) {
        if (result[0]) {
          layout.projects.open(result[0])
          props.onSelect(result[0])
        }
      } else if (result) {
        layout.projects.open(result)
        props.onSelect(result)
      }
    }

    if (platform.openDirectoryPickerDialog && server.isLocal()) {
      const result = await platform.openDirectoryPickerDialog?.({
        title: language.t("command.project.open"),
        multiple: false,
      })
      resolve(result)
    } else {
      dialog.show(
        () => <DialogSelectDirectory onSelect={resolve} />,
        () => resolve(null),
      )
    }
  }

  return (
    <Kobalte
      open={open()}
      onOpenChange={setOpen}
      modal={false}
      placement="top-start"
      gutter={4}
    >
      <Kobalte.Trigger
        as="button"
        class="flex items-center gap-1.5 rounded-md px-2 py-1 text-12-regular text-color-text-dimmed hover:bg-color-bg-hover transition-colors"
        data-testid="workspace-selector"
      >
        <Icon name="folder" size="small" />
        <span class="max-w-48 truncate">{displayName()}</span>
        <Icon name="chevron-down" size="small" />
      </Kobalte.Trigger>
      <Kobalte.Portal>
        <Kobalte.Content
          class="w-72 max-h-80 flex flex-col rounded-md border border-color-border-base bg-color-bg-raised shadow-md z-50 outline-none overflow-hidden"
          onEscapeKeyDown={(e) => {
            e.preventDefault()
            setOpen(false)
          }}
          onPointerDownOutside={() => setOpen(false)}
          onFocusOutside={() => setOpen(false)}
        >
          <div class="flex flex-col overflow-y-auto p-1">
            <Show when={recentProjects().length > 0}>
              <div class="px-2 py-1.5 text-10 text-color-text-dimmed-extra uppercase tracking-wider">
                {language.t("home.recentProjects")}
              </div>
              <For each={recentProjects()}>
                {(project) => (
                  <button
                    class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-13-regular text-color-text-primary-base hover:bg-color-bg-hover transition-colors"
                    classList={{
                      "bg-color-bg-selected": props.selected === project.worktree,
                    }}
                    onClick={() => selectDirectory(project.worktree)}
                  >
                    <Icon name="folder" size="small" class="shrink-0 text-color-text-dimmed" />
                    <span class="truncate">{project.worktree.replace(homedir(), "~")}</span>
                  </button>
                )}
              </For>
            </Show>
          </div>
          <div class="border-t border-color-border-base p-1">
            <Button
              variant="ghost"
              size="small"
              class="w-full justify-start text-13-regular"
              icon="folder-add-left"
              onClick={browseDirectory}
            >
              {language.t("command.project.open")}
            </Button>
          </div>
        </Kobalte.Content>
      </Kobalte.Portal>
    </Kobalte>
  )
}
