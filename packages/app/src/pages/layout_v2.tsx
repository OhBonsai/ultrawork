import { ErrorBoundary, type ParentProps, Suspense } from "solid-js"
import { A } from "@solidjs/router"
import { SidebarUserProfile } from "./layout/sidebar-user-profile"

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

// Slot placeholders for Phase 1 to fill in
function SidebarSlot() {
  return (
    <div
      class="flex h-full w-[210px] shrink-0 flex-col border-r border-color-border-base bg-color-bg-base"
      data-component="v2-sidebar-slot"
    >
      <div class="flex flex-1 flex-col items-center py-3">
        <div class="text-color-text-dimmed text-10">Sidebar</div>
      </div>
      <SidebarUserProfile />
    </div>
  )
}

function TopBarSlot() {
  return (
    <div
      class="flex h-12 shrink-0 items-center border-b border-color-border-base px-4"
      data-component="v2-topbar-slot"
    >
      <div class="text-color-text-dimmed text-12">Top Bar</div>
    </div>
  )
}

function PanelSlot() {
  return null
}

export default function LayoutV2(props: ParentProps) {
  return (
    <ErrorBoundary fallback={(error) => <V2ErrorFallback error={error} />}>
      <div class="flex size-full" data-component="v2-layout">
        <SidebarSlot />
        <div class="flex min-w-0 flex-1 flex-col">
          <TopBarSlot />
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
