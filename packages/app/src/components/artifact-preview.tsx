import { Show, Switch, Match, createMemo, createResource, Suspense } from "solid-js"
import { Markdown } from "@opencode-ai/ui/markdown"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { useLanguage } from "@/context/language"
import { useArtifact, type Artifact } from "@/context/artifact"
import { useSDK } from "@/context/sdk"

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
  const sdk = useSDK()
  const language = useLanguage()

  const [content] = createResource(
    () => props.artifact.filePath,
    async (filePath) => {
      try {
        const result = await sdk.client.file.read({ path: filePath })
        return result.data?.content ?? ""
      } catch {
        return null
      }
    },
  )

  return (
    <Suspense
      fallback={
        <div class="flex h-full items-center justify-center">
          <span class="text-12 text-color-text-dimmed">{language.t("common.loading")}</span>
        </div>
      }
    >
      <Show
        when={content() !== null}
        fallback={
          <div class="flex h-full items-center justify-center">
            <span class="text-12 text-color-text-dimmed">{language.t("v2.artifact.loadError")}</span>
          </div>
        }
      >
        <Switch
          fallback={<CodePreview content={content() ?? ""} filePath={props.artifact.filePath} />}
        >
          <Match when={props.artifact.type === "markdown"}>
            <MarkdownPreview content={content() ?? ""} />
          </Match>
          <Match when={props.artifact.type === "html"}>
            <HtmlPreview content={content() ?? ""} />
          </Match>
          <Match when={props.artifact.type === "image"}>
            <ImagePreview src={`file://${props.artifact.filePath}`} />
          </Match>
        </Switch>
      </Show>
    </Suspense>
  )
}

export function ArtifactPreview() {
  const language = useLanguage()
  const artifact = useArtifact()

  const selected = createMemo(() => artifact.selected)

  const filename = createMemo(() => {
    const a = selected()
    if (!a) return ""
    const parts = a.filePath.split("/")
    return parts[parts.length - 1] || a.filePath
  })

  return (
    <Show when={selected()}>
      {(current) => (
        <div class="flex h-full flex-col overflow-hidden border-l border-color-border-base bg-color-bg-base">
          <div class="flex shrink-0 items-center justify-between border-b border-color-border-base px-3 py-2">
            <div class="flex min-w-0 items-center gap-2">
              <Icon name="eye" size="small" class="text-color-text-dimmed" />
              <span class="min-w-0 truncate text-12-medium text-color-text-primary-base">
                {filename()}
              </span>
            </div>
            <IconButton
              icon="close-small"
              variant="ghost"
              class="h-6 w-6"
              onClick={() => artifact.select(null)}
              aria-label={language.t("v2.artifact.closePreview")}
            />
          </div>
          <div class="min-h-0 flex-1">
            <FileContent artifact={current()} />
          </div>
        </div>
      )}
    </Show>
  )
}
