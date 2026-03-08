import { useParams } from "@solidjs/router"
import { ArtifactProvider } from "@/context/artifact"
import { SessionSidePanel } from "@/pages/session/session-side-panel_v2"

export default function SessionV2() {
  const params = useParams()
  return (
    <ArtifactProvider>
      <div class="flex size-full min-h-0" data-component="v2-session">
        {/* Chat area - will be filled in Phase 2 */}
        <div class="flex min-w-0 flex-1 flex-col">
          <div class="flex flex-1 items-center justify-center">
            <div class="flex flex-col items-center gap-4 text-center">
              <h2 class="text-color-text-primary-base text-16-medium">Task View</h2>
              <p class="text-color-text-dimmed text-12">V2 Session</p>
              <p class="text-color-text-dimmed-extra font-mono text-10">
                dir: {params.dir} / id: {params.id}
              </p>
            </div>
          </div>
        </div>
        {/* Right side panel */}
        <SessionSidePanel />
      </div>
    </ArtifactProvider>
  )
}
