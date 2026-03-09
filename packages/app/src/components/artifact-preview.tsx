import { Show, Switch, Match, createMemo, createEffect, on } from "solid-js"
import { Markdown } from "@/ui/components/markdown"
import { Icon } from "@/ui/components/icon"
import { IconButton } from "@/ui/components/icon-button"
import { useLanguage } from "@/context/language"
import { useArtifact, type Artifact } from "@/context/artifact"
import { useFile } from "@/context/file"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"

function CodePreview(props: { content: string; filePath: string }) {
  const ext = createMemo(() => {
    const parts = props.filePath.split(".")
    return parts.length > 1 ? parts[parts.length - 1] : ""
  })

  return (
    <div class="h-full overflow-auto">
      <pre class="p-4 text-12 leading-relaxed">
        <code class={`language-${ext()}`}>{props.content}</code>
      </pre>
    </div>
  )
}

function MarkdownPreview(props: { content: string }) {
  return (
    <div class="h-full overflow-auto p-4">
      <Markdown class="prose max-w-none" text={props.content} />
    </div>
  )
}

function HtmlPreview(props: { content: string }) {
  return (
    <div class="h-full overflow-hidden">
      <iframe
        sandbox="allow-scripts"
        srcdoc={props.content}
        class="size-full border-0"
        title="HTML Preview"
      />
    </div>
  )
}

function ImagePreview(props: { src: string }) {
  return (
    <div class="flex h-full items-center justify-center overflow-auto p-4">
      <img
        src={props.src}
        alt="Preview"
        class="max-h-full max-w-full object-contain"
      />
    </div>
  )
}

function FileContent(props: { artifact: Artifact }) {
  const file = useFile()
  const language = useLanguage()

  // Load file content via FileProvider (same as v1)
  createEffect(
    on(
      () => props.artifact.filePath,
      (filePath) => {
        if (filePath) file.load(filePath)
      },
    ),
  )

  const state = createMemo(() => file.get(props.artifact.filePath))
  const content = createMemo(() => state()?.content?.content ?? "")

  return (
    <Show
      when={state()?.loaded}
      fallback={
        <Show
          when={state()?.error}
          fallback={
            <div class="flex h-full items-center justify-center">
              <span class="text-12 text-color-text-dimmed">{language.t("common.loading")}</span>
            </div>
          }
        >
          {(err) => (
            <div class="flex h-full items-center justify-center">
              <span class="text-12 text-color-text-dimmed">{err()}</span>
            </div>
          )}
        </Show>
      }
    >
      <Switch
        fallback={<CodePreview content={content()} filePath={props.artifact.filePath} />}
      >
        <Match when={props.artifact.type === "markdown"}>
          <MarkdownPreview content={content()} />
        </Match>
        <Match when={props.artifact.type === "html"}>
          <HtmlPreview content={content()} />
        </Match>
        <Match when={props.artifact.type === "image"}>
          <ImagePreview src={`file://${props.artifact.filePath}`} />
        </Match>
      </Switch>
    </Show>
  )
}

export function ArtifactPreview() {
  const language = useLanguage()
  const artifact = useArtifact()
  const platform = usePlatform()
  const server = useServer()

  const selected = createMemo(() => artifact.selected)

  const filename = createMemo(() => {
    const a = selected()
    if (!a) return ""
    const parts = a.filePath.split("/")
    return parts[parts.length - 1] || a.filePath
  })

  const canOpenFolder = createMemo(() => platform.platform === "desktop" && !!platform.openPath && server.isLocal())

  const openFolder = () => {
    const a = selected()
    if (!a || !platform.openPath) return
    const dir = a.filePath.split("/").slice(0, -1).join("/")
    if (dir) platform.openPath(dir)
  }

  return (
    <Show when={selected()}>
      {(current) => (
        <div class="flex h-full flex-col overflow-hidden border-r border-color-border-base bg-color-bg-base">
          <div class="flex shrink-0 items-center justify-between border-b border-color-border-base px-3 py-2">
            <div class="flex min-w-0 items-center gap-2">
              <Icon name="eye" size="small" class="text-color-text-dimmed" />
              <span class="min-w-0 truncate text-12-medium text-color-text-primary-base">
                {filename()}
              </span>
            </div>
            <div class="flex shrink-0 items-center gap-0.5">
              <Show when={canOpenFolder()}>
                <IconButton
                  icon="open-file"
                  variant="ghost"
                  class="h-6 w-6"
                  onClick={openFolder}
                  aria-label={language.t("common.openFolder")}
                />
              </Show>
              <IconButton
                icon="close-small"
                variant="ghost"
                class="h-6 w-6"
                onClick={() => artifact.select(null)}
                aria-label={language.t("v2.artifact.closePreview")}
              />
            </div>
          </div>
          <div class="min-h-0 flex-1">
            <FileContent artifact={current()} />
          </div>
        </div>
      )}
    </Show>
  )
}
