import { ErrorBoundary, type ParentProps, Suspense } from "solid-js"
import { A } from "@solidjs/router"
import { SidebarShell } from "./layout/sidebar-shell_v2"
import { SessionHeader } from "@/components/session/session-header_v2"

function V2ErrorFallback(props: { error: Error }) {
  return (
    <div class="flex size-full items-center justify-center">
      <div class="flex flex-col items-center gap-4 text-center">
        <div class="text-color-text-dimmed-extra text-14-medium">
          Something went wrong
        </div>
        <div class="text-color-text-dimmed text-12">
          {props.error.message}
        </div>
        <A href="/v1" class="text-color-text-primary-base text-12 underline">
          Switch to v1
        </A>
      </div>
    </div>
  )
}

// Phase 1C will fill this slot
function PanelSlot() {
  return null
}

export default function LayoutV2(props: ParentProps) {
  return (
    <ErrorBoundary fallback={(error) => <V2ErrorFallback error={error} />}>
      <div class="flex size-full" data-component="v2-layout">
        <SidebarShell />
        <div class="flex min-w-0 flex-1 flex-col">
          <SessionHeader />
          <div class="relative flex min-h-0 flex-1">
            <div class="flex min-w-0 flex-1 flex-col" data-component="v2-content">
              <Suspense>{props.children}</Suspense>
            </div>
            <PanelSlot />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
