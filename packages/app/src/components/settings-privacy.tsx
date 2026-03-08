import { Component } from "solid-js"
import { useLanguage } from "@/context/language"

export const SettingsPrivacy: Component = () => {
  const language = useLanguage()

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-1 pt-6 pb-8">
          <h2 class="text-16-medium text-text-strong">{language.t("settingsV2.privacy.title")}</h2>
        </div>
      </div>

      <div class="flex items-center justify-center py-20">
        <div class="flex flex-col items-center gap-2 text-center">
          <div class="text-14-medium text-color-text-dimmed">
            {language.t("settingsV2.comingSoon")}
          </div>
          <div class="text-12 text-color-text-dimmed-extra">
            {language.t("settingsV2.privacy.placeholder")}
          </div>
        </div>
      </div>
    </div>
  )
}
