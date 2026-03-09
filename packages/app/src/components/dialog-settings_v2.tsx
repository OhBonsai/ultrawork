import { Component } from "solid-js"
import { Dialog } from "@/ui/components/dialog"
import { Tabs } from "@/ui/components/tabs"
import { Icon } from "@/ui/components/icon"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { SettingsGeneral } from "./settings-general_v2"
import { SettingsPrivacy } from "./settings-privacy"
import { SettingsCapabilities } from "./settings-capabilities"

export const DialogSettings: Component = () => {
  const language = useLanguage()
  const platform = usePlatform()

  return (
    <Dialog size="x-large" transition>
      <Tabs orientation="vertical" variant="settings" defaultValue="general" class="h-full settings-dialog">
        <Tabs.List>
          <div class="flex flex-col justify-between h-full w-full">
            <div class="flex flex-col gap-3 w-full pt-3">
              <div class="flex flex-col gap-1.5">
                <div class="flex flex-col gap-1.5 w-full">
                  <Tabs.Trigger value="general">
                    <Icon name="sliders" />
                    {language.t("settingsV2.tab.general")}
                  </Tabs.Trigger>
                  <Tabs.Trigger value="privacy">
                    <Icon name="eye" />
                    {language.t("settingsV2.tab.privacy")}
                  </Tabs.Trigger>
                  <Tabs.Trigger value="capabilities">
                    <Icon name="brain" />
                    {language.t("settingsV2.tab.capabilities")}
                  </Tabs.Trigger>
                </div>
              </div>
            </div>
            <div class="flex flex-col gap-1 pl-1 py-1 text-12-medium text-text-weak">
              <span>{language.t("app.name.desktop")}</span>
              <span class="text-11-regular">v{platform.version}</span>
            </div>
          </div>
        </Tabs.List>
        <Tabs.Content value="general" class="no-scrollbar">
          <SettingsGeneral />
        </Tabs.Content>
        <Tabs.Content value="privacy" class="no-scrollbar">
          <SettingsPrivacy />
        </Tabs.Content>
        <Tabs.Content value="capabilities" class="no-scrollbar">
          <SettingsCapabilities />
        </Tabs.Content>
      </Tabs>
    </Dialog>
  )
}
