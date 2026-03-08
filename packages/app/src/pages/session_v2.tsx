import { useParams } from "@solidjs/router"

export default function SessionV2() {
  const params = useParams()
  return (
    <div class="flex size-full items-center justify-center" data-component="v2-session">
      <div class="flex flex-col items-center gap-4 text-center">
        <h2 class="text-color-text-primary-base text-16-medium">Task View</h2>
        <p class="text-color-text-dimmed text-12">V2 Session — Coming Soon</p>
        <p class="text-color-text-dimmed-extra font-mono text-10">
          dir: {params.dir} / id: {params.id}
        </p>
      </div>
    </div>
  )
}
