import { Component } from "solid-js"
import { Dialog } from "@/ui/components/dialog"
import { Tabs } from "@/ui/components/tabs"
import { Icon } from "@/ui/components/icon"
import { useLanguage } from "@/context/language"
import { SettingsProviders } from "./settings-providers"
import { SettingsModels } from "./settings-models"

export const DialogProviderModels: Component = () => {
  const language = useLanguage()

  return (
    <Dialog size="x-large" transition>
      <Tabs orientation="vertical" variant="settings" defaultValue="providers" class="h-full settings-dialog">
        <Tabs.List>
          <div class="flex flex-col gap-3 w-full pt-3">
            <div class="flex flex-col gap-1.5">
              <div class="flex flex-col gap-1.5 w-full">
                <Tabs.Trigger value="providers">
                  <Icon name="providers" />
                  {language.t("settings.providers.title")}
                </Tabs.Trigger>
                <Tabs.Trigger value="models">
                  <Icon name="models" />
                  {language.t("settings.models.title")}
                </Tabs.Trigger>
              </div>
            </div>
          </div>
        </Tabs.List>
        <Tabs.Content value="providers" class="no-scrollbar">
          <SettingsProviders />
        </Tabs.Content>
        <Tabs.Content value="models" class="no-scrollbar">
          <SettingsModels />
        </Tabs.Content>
      </Tabs>
    </Dialog>
  )
}
