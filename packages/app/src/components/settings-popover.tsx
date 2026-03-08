import { Component, createSignal, For, JSXElement, Show } from "solid-js"
import { Popover } from "@opencode-ai/ui/popover"
import { Icon } from "@opencode-ai/ui/icon"
import { useLanguage } from "@/context/language"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DialogSettings } from "./dialog-settings_v2"
import { DialogComingSoon } from "./dialog-coming-soon"
import { DialogWorkspace } from "./dialog-workspace"

interface SettingsPopoverProps {
  trigger: JSXElement
  open: boolean
  onOpenChange: (open: boolean) => void
}

type IconName = "settings-gear" | "models" | "folder" | "speech-bubble" | "link" | "help" | "circle-check"

interface MenuItem {
  id: string
  icon: IconName
  labelKey: string
  hasChevron: boolean
  action: () => void
}

export const SettingsPopover: Component<SettingsPopoverProps> = (props) => {
  const language = useLanguage()
  const dialog = useDialog()

  const [langSubmenuOpen, setLangSubmenuOpen] = createSignal(false)

  const openSettings = () => {
    props.onOpenChange(false)
    dialog.show(() => <DialogSettings />)
  }

  const openWorkspace = () => {
    props.onOpenChange(false)
    dialog.show(() => <DialogWorkspace />)
  }

  const showComingSoon = (titleKey: string) => () => {
    props.onOpenChange(false)
    dialog.show(() => <DialogComingSoon title={language.t(titleKey as any)} />)
  }

  const menuItems: MenuItem[] = [
    {
      id: "settings",
      icon: "settings-gear",
      labelKey: "settingsV2.popover.settings",
      hasChevron: false,
      action: openSettings,
    },
    {
      id: "language",
      icon: "settings-gear",
      labelKey: "settingsV2.popover.language",
      hasChevron: true,
      action: () => {},
    },
    {
      id: "workspace",
      icon: "folder",
      labelKey: "settingsV2.popover.workspace",
      hasChevron: true,
      action: openWorkspace,
    },
    {
      id: "providers",
      icon: "models",
      labelKey: "settingsV2.popover.providers",
      hasChevron: true,
      action: showComingSoon("settingsV2.popover.providers"),
    },
    {
      id: "channels",
      icon: "speech-bubble",
      labelKey: "settingsV2.popover.channels",
      hasChevron: true,
      action: showComingSoon("settingsV2.popover.channels"),
    },
    {
      id: "remote",
      icon: "link",
      labelKey: "settingsV2.popover.remote",
      hasChevron: true,
      action: showComingSoon("settingsV2.popover.remote"),
    },
    {
      id: "help",
      icon: "help",
      labelKey: "settingsV2.popover.help",
      hasChevron: true,
      action: showComingSoon("settingsV2.popover.help"),
    },
    {
      id: "about",
      icon: "circle-check",
      labelKey: "settingsV2.popover.about",
      hasChevron: true,
      action: showComingSoon("settingsV2.popover.about"),
    },
  ]

  return (
    <Popover
      trigger={props.trigger}
      open={props.open}
      onOpenChange={(open) => {
        if (!open) setLangSubmenuOpen(false)
        props.onOpenChange(open)
      }}
      portal={true}
      placement="top-start"
      class="overflow-hidden rounded-lg border border-color-border-base bg-color-bg-base shadow-lg"
    >
      <div class="flex" data-component="settings-popover-menu">
        {/* Left: menu */}
        <div class="flex min-w-[200px] flex-col">
          {/* Header */}
          <div class="flex items-center justify-between px-3 py-2 border-b border-color-border-base">
            <span class="text-12-medium text-color-text-dimmed">
              {language.t("settingsV2.popover.title")}
            </span>
            <button
              class="text-color-text-dimmed transition-colors hover:text-color-text-primary-base"
              onClick={() => props.onOpenChange(false)}
              data-action="settings-popover-close"
            >
              <Icon name="close-small" size="small" />
            </button>
          </div>

          {/* Menu items */}
          <div class="flex flex-col p-1">
            <For each={menuItems}>
              {(item) => (
                <Show
                  when={item.id !== "language"}
                  fallback={
                    <button
                      class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-12-medium text-color-text-primary-base transition-colors hover:bg-color-bg-hover"
                      classList={{ "bg-color-bg-hover": langSubmenuOpen() }}
                      onClick={() => setLangSubmenuOpen(!langSubmenuOpen())}
                      data-action="settings-popover-language"
                    >
                      <div class="w-4 shrink-0 text-color-text-dimmed">
                        <Icon name="settings-gear" size="small" />
                      </div>
                      <span class="flex-1">{language.t("settingsV2.popover.language")}</span>
                      <div class="shrink-0 text-color-text-dimmed">
                        <Icon name="chevron-right" size="small" />
                      </div>
                    </button>
                  }
                >
                  <button
                    class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-12-medium text-color-text-primary-base transition-colors hover:bg-color-bg-hover"
                    onClick={item.action}
                    data-action={`settings-popover-${item.id}`}
                  >
                    <div class="w-4 shrink-0 text-color-text-dimmed">
                      <Icon name={item.icon} size="small" />
                    </div>
                    <span class="flex-1">{language.t(item.labelKey as any)}</span>
                    {item.hasChevron && (
                      <div class="shrink-0 text-color-text-dimmed">
                        <Icon name="chevron-right" size="small" />
                      </div>
                    )}
                  </button>
                </Show>
              )}
            </For>
          </div>
        </div>

        {/* Right: language submenu */}
        <Show when={langSubmenuOpen()}>
          <div
            class="max-h-[280px] min-w-[160px] overflow-y-auto border-l border-color-border-base p-1"
            data-component="language-submenu"
          >
            <div>
              <For each={[...language.locales]}>
                {(locale) => (
                  <button
                    class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-12-medium text-color-text-primary-base transition-colors hover:bg-color-bg-hover"
                    classList={{ "bg-color-bg-hover": locale === language.locale() }}
                    onClick={() => {
                      language.setLocale(locale)
                      setLangSubmenuOpen(false)
                      props.onOpenChange(false)
                    }}
                    data-action={`settings-popover-language-${locale}`}
                  >
                    {locale === language.locale() && (
                      <div class="w-4 shrink-0">
                        <Icon name="check" size="small" />
                      </div>
                    )}
                    <span classList={{ "pl-6": locale !== language.locale() }}>
                      {language.label(locale)}
                    </span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </Popover>
  )
}

