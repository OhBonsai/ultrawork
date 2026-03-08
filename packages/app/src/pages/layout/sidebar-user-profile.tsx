import { Component, createSignal } from "solid-js"
import { useUserProfile } from "@/context/user-profile"
import { useLanguage } from "@/context/language"
import { SettingsPopover } from "@/components/settings-popover"

export const SidebarUserProfile: Component = () => {
  const profile = useUserProfile()
  const language = useLanguage()
  const [popoverOpen, setPopoverOpen] = createSignal(false)

  const initials = () => {
    const name = profile.displayName()
    if (!name) return "U"
    const parts = name.split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name[0].toUpperCase()
  }

  return (
    <div
      class="flex shrink-0 items-center gap-2 border-t border-color-border-base px-3 py-2"
      data-component="v2-user-profile"
    >
      <SettingsPopover
        open={popoverOpen()}
        onOpenChange={setPopoverOpen}
        trigger={
          <button
            class="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-color-bg-hover"
            data-action="open-settings-popover"
          >
            <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-color-bg-brand text-11-medium text-white">
              {initials()}
            </div>
            <span class="min-w-0 flex-1 truncate text-12-medium text-color-text-primary-base">
              {profile.displayName()}
            </span>
            <div class="shrink-0 text-color-text-dimmed">
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M7.62516 4.46094L5.05225 3.86719L3.86475 5.05469L4.4585 7.6276L2.0835 9.21094V10.7943L4.4585 12.3776L3.86475 14.9505L5.05225 16.138L7.62516 15.5443L9.2085 17.9193H10.7918L12.3752 15.5443L14.9481 16.138L16.1356 14.9505L15.5418 12.3776L17.9168 10.7943V9.21094L15.5418 7.6276L16.1356 5.05469L14.9481 3.86719L12.3752 4.46094L10.7918 2.08594H9.2085L7.62516 4.46094Z"
                  stroke="currentColor"
                />
                <path
                  d="M12.5002 10.0026C12.5002 11.3833 11.3809 12.5026 10.0002 12.5026C8.61945 12.5026 7.50016 11.3833 7.50016 10.0026C7.50016 8.62189 8.61945 7.5026 10.0002 7.5026C11.3809 7.5026 12.5002 8.62189 12.5002 10.0026Z"
                  stroke="currentColor"
                />
              </svg>
            </div>
          </button>
        }
      />
    </div>
  )
}
