import { Component } from "solid-js"
import { Dialog } from "@opencode-ai/ui/dialog"
import { useLanguage } from "@/context/language"

interface DialogComingSoonProps {
  title: string
}

export const DialogComingSoon: Component<DialogComingSoonProps> = (props) => {
  const language = useLanguage()

  return (
    <Dialog size="normal" transition>
      <div class="flex flex-col items-center justify-center gap-4 p-10">
        <h2 class="text-16-medium text-text-strong">{props.title}</h2>
        <div class="text-14 text-color-text-dimmed">
          {language.t("settingsV2.popover.comingSoon")}
        </div>
      </div>
    </Dialog>
  )
}
