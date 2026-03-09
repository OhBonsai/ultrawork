import { For, Show, createMemo } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { useLanguage } from "@/context/language"
import { useArtifact, type Artifact } from "@/context/artifact"

function ArtifactItem(props: { artifact: Artifact; active: boolean }) {
  const artifact = useArtifact()
  const filename = createMemo(() => {
    const parts = props.artifact.filePath.split("/")
    return parts[parts.length - 1] || props.artifact.filePath
  })

  return (
    <button
      class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-12 transition-colors hover:bg-color-bg-hover"
      classList={{
        "bg-color-bg-hover text-color-text-primary-base": props.active,
        "text-color-text-dimmed": !props.active,
      }}
      onClick={() => artifact.select(props.artifact.id)}
      title={props.artifact.filePath}
    >
      <Icon name="code" class="shrink-0 opacity-50" size="small" />
      <span class="min-w-0 truncate">{filename()}</span>
      <span class="ml-auto shrink-0 rounded bg-color-bg-base px-1 text-10 text-color-text-dimmed-extra">
        {props.artifact.type}
      </span>
    </button>
  )
}

function ArtifactSection(props: { title: string; artifacts: Artifact[]; defaultOpen?: boolean }) {
  const artifact = useArtifact()

  return (
    <Show when={props.artifacts.length > 0}>
      <div class="flex flex-col">
        <div class="flex items-center px-2 py-1.5">
          <span class="text-11-medium text-color-text-dimmed uppercase">{props.title}</span>
          <span class="ml-1.5 text-11 text-color-text-dimmed-extra">({props.artifacts.length})</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <For each={props.artifacts}>
            {(item) => <ArtifactItem artifact={item} active={artifact.selectedId === item.id} />}
          </For>
        </div>
      </div>
    </Show>
  )
}

export function ArtifactList() {
  const language = useLanguage()
  const artifact = useArtifact()

  const hasArtifacts = createMemo(() => artifact.artifacts.length > 0)

  return (
    <div class="flex h-full flex-col overflow-hidden">
      <div class="flex-1 overflow-y-auto px-1 py-1">
        <Show
          when={hasArtifacts()}
          fallback={
            <div class="flex items-center justify-center px-4 py-8 text-center">
              <span class="text-12 text-color-text-dimmed">
                {language.t("v2.artifact.empty")}
              </span>
            </div>
          }
        >
          <ArtifactSection
            title={language.t("v2.artifact.final")}
            artifacts={artifact.final()}
            defaultOpen
          />
          <ArtifactSection
            title={language.t("v2.artifact.process")}
            artifacts={artifact.process()}
          />
        </Show>
      </div>
    </div>
  )
}
