import { Component, createMemo, type JSX } from "solid-js"
import { Select } from "@/ui/components/select"
import { Switch } from "@/ui/components/switch"
import { useTheme, type ColorScheme } from "@/ui/theme"
import { useLanguage } from "@/context/language"
import { useSettings, monoFontFamily } from "@/context/settings"
import { useUserProfile } from "@/context/user-profile"

export const SettingsGeneral: Component = () => {
  const theme = useTheme()
  const language = useLanguage()
  const settings = useSettings()
  const profile = useUserProfile()

  const colorSchemeOptions = createMemo((): { value: ColorScheme; label: string }[] => [
    { value: "system", label: language.t("theme.scheme.system") },
    { value: "light", label: language.t("theme.scheme.light") },
    { value: "dark", label: language.t("theme.scheme.dark") },
  ])

  const languageOptions = createMemo(() =>
    language.locales.map((locale) => ({
      value: locale,
      label: language.label(locale),
    })),
  )

  const themeOptions = createMemo(() =>
    Object.entries(theme.themes()).map(([id, def]) => ({ id, name: def.name ?? id })),
  )

  const fontOptions = [
    { value: "ibm-plex-mono", label: "font.option.ibmPlexMono" },
    { value: "cascadia-code", label: "font.option.cascadiaCode" },
    { value: "fira-code", label: "font.option.firaCode" },
    { value: "hack", label: "font.option.hack" },
    { value: "inconsolata", label: "font.option.inconsolata" },
    { value: "intel-one-mono", label: "font.option.intelOneMono" },
    { value: "iosevka", label: "font.option.iosevka" },
    { value: "jetbrains-mono", label: "font.option.jetbrainsMono" },
    { value: "meslo-lgs", label: "font.option.mesloLgs" },
    { value: "roboto-mono", label: "font.option.robotoMono" },
    { value: "source-code-pro", label: "font.option.sourceCodePro" },
    { value: "ubuntu-mono", label: "font.option.ubuntuMono" },
    { value: "geist-mono", label: "font.option.geistMono" },
  ] as const
  const fontOptionsList = [...fontOptions]

  const workSceneOptions = [
    { value: "", label: "settingsV2.general.workScene.none" },
    { value: "development", label: "settingsV2.general.workScene.development" },
    { value: "writing", label: "settingsV2.general.workScene.writing" },
    { value: "research", label: "settingsV2.general.workScene.research" },
    { value: "design", label: "settingsV2.general.workScene.design" },
    { value: "other", label: "settingsV2.general.workScene.other" },
  ] as const
  const workSceneOptionsList = [...workSceneOptions]

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-1 pt-6 pb-8">
          <h2 class="text-16-medium text-text-strong">{language.t("settingsV2.general.title")}</h2>
        </div>
      </div>

      <div class="flex flex-col gap-8 w-full">
        {/* Profile Section */}
        <div class="flex flex-col gap-1">
          <h3 class="text-14-medium text-text-strong pb-2">{language.t("settingsV2.general.section.profile")}</h3>

          <div class="bg-surface-raised-base px-4 rounded-lg">
            <SettingsRow
              title={language.t("settingsV2.general.row.fullName.title")}
              description={language.t("settingsV2.general.row.fullName.description")}
            >
              <input
                type="text"
                class="w-[180px] rounded-md border border-color-border-base bg-color-bg-base px-2 py-1 text-12 text-color-text-primary-base outline-none focus:border-color-border-focus"
                value={profile.fullName()}
                onInput={(e) => profile.setFullName(e.currentTarget.value)}
                placeholder={language.t("settingsV2.general.row.fullName.placeholder")}
                data-action="settings-profile-fullname"
              />
            </SettingsRow>

            <SettingsRow
              title={language.t("settingsV2.general.row.nickname.title")}
              description={language.t("settingsV2.general.row.nickname.description")}
            >
              <input
                type="text"
                class="w-[180px] rounded-md border border-color-border-base bg-color-bg-base px-2 py-1 text-12 text-color-text-primary-base outline-none focus:border-color-border-focus"
                value={profile.nickname()}
                onInput={(e) => profile.setNickname(e.currentTarget.value)}
                placeholder={language.t("settingsV2.general.row.nickname.placeholder")}
                data-action="settings-profile-nickname"
              />
            </SettingsRow>

            <SettingsRow
              title={language.t("settingsV2.general.row.workScene.title")}
              description={language.t("settingsV2.general.row.workScene.description")}
            >
              <Select
                data-action="settings-profile-workscene"
                options={workSceneOptionsList}
                current={workSceneOptionsList.find((o) => o.value === profile.workScene())}
                value={(o) => o.value}
                label={(o) => language.t(o.label as any)}
                onSelect={(option) => option && profile.setWorkScene(option.value)}
                variant="secondary"
                size="small"
                triggerVariant="settings"
              />
            </SettingsRow>
          </div>
        </div>

        {/* Appearance Section */}
        <div class="flex flex-col gap-1">
          <h3 class="text-14-medium text-text-strong pb-2">{language.t("settings.general.section.appearance")}</h3>

          <div class="bg-surface-raised-base px-4 rounded-lg">
            <SettingsRow
              title={language.t("settings.general.row.language.title")}
              description={language.t("settings.general.row.language.description")}
            >
              <Select
                data-action="settings-language"
                options={languageOptions()}
                current={languageOptions().find((o) => o.value === language.locale())}
                value={(o) => o.value}
                label={(o) => o.label}
                onSelect={(option) => option && language.setLocale(option.value)}
                variant="secondary"
                size="small"
                triggerVariant="settings"
              />
            </SettingsRow>

            <SettingsRow
              title={language.t("settings.general.row.appearance.title")}
              description={language.t("settings.general.row.appearance.description")}
            >
              <Select
                data-action="settings-color-scheme"
                options={colorSchemeOptions()}
                current={colorSchemeOptions().find((o) => o.value === theme.colorScheme())}
                value={(o) => o.value}
                label={(o) => o.label}
                onSelect={(option) => option && theme.setColorScheme(option.value)}
                onHighlight={(option) => {
                  if (!option) return
                  theme.previewColorScheme(option.value)
                  return () => theme.cancelPreview()
                }}
                variant="secondary"
                size="small"
                triggerVariant="settings"
              />
            </SettingsRow>

            <SettingsRow
              title={language.t("settings.general.row.theme.title")}
              description={language.t("settings.general.row.theme.description")}
            >
              <Select
                data-action="settings-theme"
                options={themeOptions()}
                current={themeOptions().find((o) => o.id === theme.themeId())}
                value={(o) => o.id}
                label={(o) => o.name}
                onSelect={(option) => {
                  if (!option) return
                  theme.setTheme(option.id)
                }}
                onHighlight={(option) => {
                  if (!option) return
                  theme.previewTheme(option.id)
                  return () => theme.cancelPreview()
                }}
                variant="secondary"
                size="small"
                triggerVariant="settings"
              />
            </SettingsRow>

            <SettingsRow
              title={language.t("settings.general.row.font.title")}
              description={language.t("settings.general.row.font.description")}
            >
              <Select
                data-action="settings-font"
                options={fontOptionsList}
                current={fontOptionsList.find((o) => o.value === settings.appearance.font())}
                value={(o) => o.value}
                label={(o) => language.t(o.label)}
                onSelect={(option) => option && settings.appearance.setFont(option.value)}
                variant="secondary"
                size="small"
                triggerVariant="settings"
                triggerStyle={{ "font-family": monoFontFamily(settings.appearance.font()), "min-width": "180px" }}
              >
                {(option) => (
                  <span style={{ "font-family": monoFontFamily(option?.value) }}>
                    {option ? language.t(option.label) : ""}
                  </span>
                )}
              </Select>
            </SettingsRow>
          </div>
        </div>

        {/* Notifications Section */}
        <div class="flex flex-col gap-1">
          <h3 class="text-14-medium text-text-strong pb-2">{language.t("settings.general.section.notifications")}</h3>

          <div class="bg-surface-raised-base px-4 rounded-lg">
            <SettingsRow
              title={language.t("settings.general.notifications.agent.title")}
              description={language.t("settings.general.notifications.agent.description")}
            >
              <div data-action="settings-notifications-agent">
                <Switch
                  checked={settings.notifications.agent()}
                  onChange={(checked) => settings.notifications.setAgent(checked)}
                />
              </div>
            </SettingsRow>

            <SettingsRow
              title={language.t("settings.general.notifications.permissions.title")}
              description={language.t("settings.general.notifications.permissions.description")}
            >
              <div data-action="settings-notifications-permissions">
                <Switch
                  checked={settings.notifications.permissions()}
                  onChange={(checked) => settings.notifications.setPermissions(checked)}
                />
              </div>
            </SettingsRow>

            <SettingsRow
              title={language.t("settings.general.notifications.errors.title")}
              description={language.t("settings.general.notifications.errors.description")}
            >
              <div data-action="settings-notifications-errors">
                <Switch
                  checked={settings.notifications.errors()}
                  onChange={(checked) => settings.notifications.setErrors(checked)}
                />
              </div>
            </SettingsRow>
          </div>
        </div>
      </div>
    </div>
  )
}

interface SettingsRowProps {
  title: string | JSX.Element
  description: string | JSX.Element
  children: JSX.Element
}

const SettingsRow: Component<SettingsRowProps> = (props) => {
  return (
    <div class="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-border-weak-base last:border-none">
      <div class="flex flex-col gap-0.5 min-w-0">
        <span class="text-14-medium text-text-strong">{props.title}</span>
        <span class="text-12-regular text-text-weak">{props.description}</span>
      </div>
      <div class="flex-shrink-0">{props.children}</div>
    </div>
  )
}
