import { createMemo, createSignal, For, Show } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@opencode-ai/util/encode"
import { showToast } from "@opencode-ai/ui/toast"
import { Icon, type IconProps } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Button } from "@opencode-ai/ui/button"
import { Tag } from "@opencode-ai/ui/tag"
import { Dialog } from "@opencode-ai/ui/dialog"
import { List } from "@opencode-ai/ui/list"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useModels, type ModelKey } from "@/context/models"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { popularProviders } from "@/hooks/use-providers"
import { DialogSelectProvider } from "@/components/dialog-select-provider"
import { ModelTooltip } from "@/components/model-tooltip"
import { WorkspaceSelector } from "@/components/workspace-selector"
import { AddMenu, type AddMenuFile } from "@/components/add-menu"
import { useServer } from "@/context/server"

const isFree = (provider: string, cost: { input: number } | undefined) =>
  provider === "opencode" && (!cost || cost.input === 0)

/**
 * Standalone model selector dialog that uses global useModels() context
 * instead of useLocal() (which requires SDKProvider/directory context).
 */
function GlobalModelSelector(props: {
  current: ModelKey | undefined
  onSelect: (model: ModelKey) => void
}) {
  const models = useModels()
  const dialog = useDialog()
  const language = useLanguage()

  const visibleModels = createMemo(() =>
    models
      .list()
      .filter((m) => models.visible({ modelID: m.id, providerID: m.provider.id }))
      .map((m) => ({
        ...m,
        name: m.name.replace("(latest)", "").trim(),
        latest: m.name.includes("(latest)"),
      })),
  )

  return (
    <Dialog
      title={language.t("dialog.model.select.title")}
      action={
        <Button
          class="h-7 -my-1 text-14-medium"
          icon="plus-small"
          tabIndex={-1}
          onClick={() => dialog.show(() => <DialogSelectProvider />)}
        >
          {language.t("command.provider.connect")}
        </Button>
      }
    >
      <List
        class="flex-1 min-h-0 [&_[data-slot=list-scroll]]:flex-1 [&_[data-slot=list-scroll]]:min-h-0"
        search={{ placeholder: language.t("dialog.model.search.placeholder"), autofocus: true }}
        emptyMessage={language.t("dialog.model.empty")}
        key={(x) => `${x.provider.id}:${x.id}`}
        items={visibleModels}
        current={
          props.current
            ? visibleModels().find(
                (m) => m.id === props.current!.modelID && m.provider.id === props.current!.providerID,
              )
            : undefined
        }
        filterKeys={["provider.name", "name", "id"]}
        sortBy={(a, b) => a.name.localeCompare(b.name)}
        groupBy={(x) => x.provider.name}
        sortGroupsBy={(a, b) => {
          const aProvider = a.items[0].provider.id
          const bProvider = b.items[0].provider.id
          if (popularProviders.includes(aProvider) && !popularProviders.includes(bProvider)) return -1
          if (!popularProviders.includes(aProvider) && popularProviders.includes(bProvider)) return 1
          return popularProviders.indexOf(aProvider) - popularProviders.indexOf(bProvider)
        }}
        itemWrapper={(item, node) => (
          <Tooltip
            class="w-full"
            placement="right-start"
            gutter={12}
            value={<ModelTooltip model={item} latest={item.latest} free={isFree(item.provider.id, item.cost)} />}
          >
            {node}
          </Tooltip>
        )}
        onSelect={(x) => {
          if (x) {
            props.onSelect({ modelID: x.id, providerID: x.provider.id })
            models.recent.push({ modelID: x.id, providerID: x.provider.id })
          }
          dialog.close()
        }}
      >
        {(i) => (
          <div class="w-full flex items-center gap-x-2 text-13-regular">
            <span class="truncate">{i.name}</span>
            <Show when={isFree(i.provider.id, i.cost)}>
              <Tag>{language.t("model.tag.free")}</Tag>
            </Show>
            <Show when={i.latest}>
              <Tag>{language.t("model.tag.latest")}</Tag>
            </Show>
          </div>
        )}
      </List>
    </Dialog>
  )
}

type CapabilityCard = {
  icon: IconProps["name"]
  titleKey: string
  descriptionKey: string
  promptKeys: string[]
}

const CAPABILITIES: CapabilityCard[] = [
  {
    icon: "code",
    titleKey: "home.v2.capability.coding.title",
    descriptionKey: "home.v2.capability.coding.description",
    promptKeys: [
      "home.v2.capability.coding.prompt.1",
      "home.v2.capability.coding.prompt.2",
      "home.v2.capability.coding.prompt.3",
    ],
  },
  {
    icon: "pencil-line",
    titleKey: "home.v2.capability.writing.title",
    descriptionKey: "home.v2.capability.writing.description",
    promptKeys: [
      "home.v2.capability.writing.prompt.1",
      "home.v2.capability.writing.prompt.2",
      "home.v2.capability.writing.prompt.3",
    ],
  },
  {
    icon: "magnifying-glass",
    titleKey: "home.v2.capability.analysis.title",
    descriptionKey: "home.v2.capability.analysis.description",
    promptKeys: [
      "home.v2.capability.analysis.prompt.1",
      "home.v2.capability.analysis.prompt.2",
      "home.v2.capability.analysis.prompt.3",
    ],
  },
]

export default function HomeV2() {
  const language = useLanguage()
  const navigate = useNavigate()
  const globalSDK = useGlobalSDK()
  const sync = useGlobalSync()
  const layout = useLayout()
  const models = useModels()
  const dialog = useDialog()
  const server = useServer()

  const [text, setText] = createSignal("")
  const [selectedDir, setSelectedDir] = createSignal<string | undefined>(
    sync.data.project[0]?.worktree,
  )
  const [expandedCard, setExpandedCard] = createSignal<number | null>(null)
  const [attachments, setAttachments] = createSignal<AddMenuFile[]>([])
  const [submitting, setSubmitting] = createSignal(false)
  const [chosenModel, setChosenModel] = createSignal<ModelKey | undefined>()

  let textareaRef: HTMLTextAreaElement | undefined

  const selectedModel = createMemo(() => {
    // If user explicitly chose a model, use that
    const chosen = chosenModel()
    if (chosen) {
      const found = models.find(chosen)
      if (found) return found
    }
    // Fallback to most recent model
    const recent = models.recent.list()
    for (const key of recent) {
      const found = models.find(key)
      if (found) return found
    }
    // Fallback to first visible model
    const all = models.list()
    const visible = all.filter((m) => models.visible({ modelID: m.id, providerID: m.provider.id }))
    return visible[0]
  })

  const selectedModelKey = createMemo<ModelKey | undefined>(() => {
    const m = selectedModel()
    if (!m) return undefined
    return { modelID: m.id, providerID: m.provider.id }
  })

  const modelDisplay = createMemo(() => {
    const m = selectedModel()
    if (!m) return language.t("home.v2.model.select")
    return m.name
  })

  function fillPrompt(promptText: string) {
    setText(promptText)
    setExpandedCard(null)
    textareaRef?.focus()
  }

  function toggleCard(index: number) {
    setExpandedCard((prev) => (prev === index ? null : index))
  }

  function handleFileSelect(files: AddMenuFile[]) {
    setAttachments((prev) => [...prev, ...files])
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  function openModelSelector() {
    dialog.show(() => (
      <GlobalModelSelector
        current={selectedModelKey()}
        onSelect={(key) => setChosenModel(key)}
      />
    ))
  }

  async function handleSubmit(event?: Event) {
    event?.preventDefault()

    const prompt = text().trim()
    const dir = selectedDir()
    const model = selectedModel()

    if (!prompt && attachments().length === 0) return
    if (!dir) {
      showToast({
        variant: "error",
        title: language.t("home.v2.workspace.none"),
      })
      return
    }
    if (!model) {
      showToast({
        variant: "error",
        title: language.t("home.v2.model.select"),
      })
      return
    }

    setSubmitting(true)

    try {
      layout.projects.open(dir)
      server.projects.touch(dir)

      const client = globalSDK.createClient({
        directory: dir,
        throwOnError: true,
      })

      // Ensure child store exists for this directory
      sync.child(dir)

      const session = await client.session.create()
      const sessionData = session.data
      if (!sessionData) {
        showToast({
          variant: "error",
          title: language.t("prompt.toast.sessionCreateFailed.title"),
        })
        return
      }

      // Build message parts
      const textParts: Array<{ id: string; type: "text"; text: string }> = []
      const fileParts: Array<{ id: string; type: "file"; mime: string; url: string; filename: string }> = []

      if (prompt) {
        textParts.push({
          id: crypto.randomUUID(),
          type: "text" as const,
          text: prompt,
        })
      }

      for (const attachment of attachments()) {
        fileParts.push({
          id: crypto.randomUUID(),
          type: "file" as const,
          mime: attachment.file.type,
          url: attachment.dataUrl,
          filename: attachment.file.name,
        })
      }

      const messageID = crypto.randomUUID()

      // Send the prompt
      await client.session.promptAsync({
        sessionID: sessionData.id,
        messageID,
        parts: [...textParts, ...fileParts],
        model: {
          modelID: model.id,
          providerID: model.provider.id,
        },
      })

      // Navigate to the task view
      navigate(`/task/${base64Encode(dir)}/${sessionData.id}`)
    } catch (err) {
      showToast({
        variant: "error",
        title: language.t("prompt.toast.promptSendFailed.title"),
        description: err instanceof Error ? err.message : language.t("common.requestFailed"),
      })
    } finally {
      setSubmitting(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div class="flex size-full flex-col items-center overflow-y-auto" data-component="v2-home">
      <div class="flex w-full max-w-2xl flex-col items-center gap-8 px-4 pt-20 pb-8">
        {/* Welcome Section */}
        <div class="flex flex-col items-center gap-2 text-center">
          <h1 class="text-color-text-primary-base text-20-medium">
            {language.t("home.v2.welcome.title")}
          </h1>
          <p class="text-color-text-dimmed text-14-regular">
            {language.t("home.v2.welcome.subtitle")}
          </p>
        </div>

        {/* Capability Cards */}
        <div class="grid w-full grid-cols-3 gap-3" data-testid="capability-cards">
          <For each={CAPABILITIES}>
            {(card, index) => (
              <div class="flex flex-col">
                <button
                  class="flex flex-col items-start gap-2 rounded-lg border border-color-border-base p-4 text-left transition-colors hover:bg-color-bg-hover"
                  classList={{
                    "border-color-border-strong bg-color-bg-hover": expandedCard() === index(),
                  }}
                  onClick={() => toggleCard(index())}
                  data-testid={`capability-card-${index()}`}
                >
                  <Icon name={card.icon} size="normal" class="text-color-text-dimmed" />
                  <div class="text-14-medium text-color-text-primary-base">
                    {language.t(card.titleKey)}
                  </div>
                  <div class="text-12-regular text-color-text-dimmed">
                    {language.t(card.descriptionKey)}
                  </div>
                </button>
                <Show when={expandedCard() === index()}>
                  <div class="mt-1 flex flex-col gap-0.5 rounded-lg border border-color-border-base p-1">
                    <For each={card.promptKeys}>
                      {(promptKey) => (
                        <button
                          class="rounded-md px-3 py-2 text-left text-13-regular text-color-text-primary-base hover:bg-color-bg-hover transition-colors"
                          onClick={() => fillPrompt(language.t(promptKey))}
                          data-testid="prompt-suggestion"
                        >
                          {language.t(promptKey)}
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>

        {/* Composer */}
        <form
          class="flex w-full flex-col gap-2 rounded-lg border border-color-border-base bg-color-bg-base p-3"
          data-testid="home-composer"
          onSubmit={(e) => handleSubmit(e)}
        >
          {/* Attachments preview */}
          <Show when={attachments().length > 0}>
            <div class="flex flex-wrap gap-2">
              <For each={attachments()}>
                {(attachment, index) => (
                  <div class="flex items-center gap-1 rounded-md bg-color-bg-hover px-2 py-1 text-12-regular text-color-text-dimmed">
                    <Icon name="cloud-upload" size="small" />
                    <span class="max-w-32 truncate">{attachment.file.name}</span>
                    <button
                      type="button"
                      class="ml-1 hover:text-color-text-primary-base"
                      onClick={() => removeAttachment(index())}
                    >
                      <Icon name="close" size="small" />
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* Text input */}
          <textarea
            ref={textareaRef}
            class="min-h-20 w-full resize-none bg-transparent text-14-regular text-color-text-primary-base placeholder:text-color-text-dimmed outline-none"
            placeholder={language.t("home.v2.composer.placeholder")}
            value={text()}
            onInput={(e) => setText(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            data-testid="home-input"
          />

          {/* Bottom toolbar */}
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1">
              {/* Add menu (+) */}
              <AddMenu onFileSelect={handleFileSelect} />

              {/* Workspace selector */}
              <WorkspaceSelector
                selected={selectedDir()}
                onSelect={setSelectedDir}
              />

              {/* Model selector */}
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-md px-2 py-1 text-12-regular text-color-text-dimmed hover:bg-color-bg-hover transition-colors"
                onClick={openModelSelector}
                data-testid="model-selector"
              >
                <Icon name="models" size="small" />
                <span class="max-w-32 truncate">{modelDisplay()}</span>
              </button>
            </div>

            {/* Submit */}
            <IconButton
              type="submit"
              icon={submitting() ? "stop" : "arrow-up"}
              variant="primary"
              class="size-8"
              disabled={submitting() || (!text().trim() && attachments().length === 0)}
              aria-label={language.t("home.v2.composer.start")}
              data-action="prompt-submit"
            />
          </div>
        </form>
      </div>
    </div>
  )
}
