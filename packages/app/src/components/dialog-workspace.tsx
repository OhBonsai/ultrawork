import { Component, createMemo, For, Show } from "solid-js"
import { Dialog } from "@opencode-ai/ui/dialog"
import { Tabs } from "@opencode-ai/ui/tabs"
import { Icon } from "@opencode-ai/ui/icon"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { getFilename } from "@opencode-ai/util/path"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { DialogSelectDirectory } from "./dialog-select-directory"
import { DialogEditProject } from "./dialog-edit-project"

export const DialogWorkspace: Component = () => {
  const language = useLanguage()
  const layout = useLayout()
  const platform = usePlatform()
  const server = useServer()
  const dialog = useDialog()

  const projects = createMemo(() => layout.projects.list())

  function addDirectory(directory: string) {
    layout.projects.open(directory)
  }

  const handleAdd = async () => {
    function resolve(result: string | string[] | null) {
      if (Array.isArray(result)) {
        for (const directory of result) {
          addDirectory(directory)
        }
      } else if (result) {
        addDirectory(result)
      }
    }

    if (platform.openDirectoryPickerDialog && server.isLocal()) {
      const result = await platform.openDirectoryPickerDialog({
        title: language.t("settingsV2.workspace.addDirectory"),
        multiple: true,
      })
      resolve(result)
    } else {
      dialog.show(
        () => <DialogSelectDirectory multiple={true} onSelect={resolve} />,
        () => resolve(null),
      )
    }
  }

  const handleEdit = (project: ReturnType<typeof layout.projects.list>[number]) => {
    dialog.show(() => <DialogEditProject project={project} />)
  }

  const handleRemove = (directory: string) => {
    layout.projects.close(directory)
  }

  return (
    <Dialog size="large" transition>
      <div class="flex flex-col h-full min-h-[400px]" data-component="dialog-workspace">
        {/* Header */}
        <div class="px-6 pt-6 pb-4">
          <h2 class="text-16-medium text-text-strong">
            {language.t("settingsV2.workspace.title")}
          </h2>
        </div>

        {/* Tabs */}
        <div class="flex flex-col flex-1 overflow-hidden">
          <Tabs variant="pill" defaultValue="directories" class="flex flex-col h-full">
            <div class="px-6">
              <Tabs.List class="!h-auto !p-0 gap-0 bg-surface-raised-base rounded-lg w-fit">
                <Tabs.Trigger value="directories" class="!px-3 !py-1.5">
                  {language.t("settingsV2.workspace.tab.directories")}
                </Tabs.Trigger>
                <Tabs.Trigger value="environment" class="!px-3 !py-1.5">
                  {language.t("settingsV2.workspace.tab.environment")}
                </Tabs.Trigger>
              </Tabs.List>
            </div>

            <Tabs.Content value="directories" class="flex-1 overflow-y-auto no-scrollbar">
              <div class="flex flex-col gap-3 px-6 py-4">
                {/* Description + Add button */}
                <div class="flex items-center justify-between">
                  <span class="text-13-regular text-text-weak">
                    {language.t("settingsV2.workspace.description")}
                  </span>
                  <button
                    class="flex items-center gap-1.5 rounded-md bg-[var(--button-primary-base)] px-3 py-1.5 text-13-medium text-[var(--text-on-interactive-base)] transition-colors hover:bg-[var(--button-primary-hover)]"
                    onClick={handleAdd}
                    data-action="workspace-add"
                  >
                    <Icon name="plus-small" size="small" />
                    {language.t("settingsV2.workspace.addDirectory")}
                  </button>
                </div>

                {/* Directory list */}
                <div class="flex flex-col gap-2">
                  <For each={projects()}>
                    {(project) => (
                      <WorkspaceItem
                        name={project.name || getFilename(project.worktree)}
                        path={project.worktree}
                        onEdit={() => handleEdit(project)}
                        onRemove={() => handleRemove(project.worktree)}
                      />
                    )}
                  </For>
                  <Show when={projects().length === 0}>
                    <div class="flex items-center justify-center py-8 text-13-regular text-text-weak">
                      {language.t("settingsV2.workspace.empty")}
                    </div>
                  </Show>
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value="environment" class="flex-1 overflow-y-auto no-scrollbar">
              <div class="flex items-center justify-center py-16 text-13-regular text-text-weak">
                {language.t("settingsV2.popover.comingSoon")}
              </div>
            </Tabs.Content>
          </Tabs>
        </div>
      </div>
    </Dialog>
  )
}

interface WorkspaceItemProps {
  name: string
  path: string
  onEdit: () => void
  onRemove: () => void
}

const WorkspaceItem: Component<WorkspaceItemProps> = (props) => {
  return (
    <div
      class="flex items-center gap-3 rounded-lg border border-border-weak-base bg-surface-raised-base px-4 py-3"
      data-component="workspace-item"
      data-path={props.path}
    >
      <div class="flex items-center justify-center shrink-0 text-icon-base">
        <Icon name="folder" size="medium" />
      </div>
      <div class="flex flex-col gap-0.5 min-w-0 flex-1">
        <span class="text-14-medium text-text-strong truncate">{props.name}</span>
        <span class="text-12-regular text-text-weak truncate">{props.path}</span>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button
          class="flex items-center justify-center size-7 rounded-md text-icon-base transition-colors hover:bg-surface-base-hover hover:text-text-strong"
          onClick={props.onEdit}
          data-action="workspace-edit"
        >
          <Icon name="pencil-line" size="small" />
        </button>
        <button
          class="flex items-center justify-center size-7 rounded-md text-icon-base transition-colors hover:bg-surface-base-hover hover:text-text-strong"
          onClick={props.onRemove}
          data-action="workspace-remove"
        >
          <Icon name="trash" size="small" />
        </button>
      </div>
    </div>
  )
}
