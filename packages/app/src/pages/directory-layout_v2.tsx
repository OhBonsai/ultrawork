import { createEffect, createMemo, Show, type ParentProps } from "solid-js"
import { createStore } from "solid-js/store"
import { useParams } from "@solidjs/router"
import { SDKProvider } from "@/context/sdk"
import { SyncProvider } from "@/context/sync"
import { useGlobalSDK } from "@/context/global-sdk"
import { decode64 } from "@/utils/base64"

export default function DirectoryLayoutV2(props: ParentProps) {
  const params = useParams()
  const globalSDK = useGlobalSDK()
  const directory = createMemo(() => decode64(params.dir) ?? "")
  const [state, setState] = createStore({ resolved: "" })

  createEffect(() => {
    if (!params.dir) return
    const raw = directory()
    if (!raw) return

    const current = params.dir
    globalSDK
      .createClient({
        directory: raw,
        throwOnError: true,
      })
      .path.get()
      .then((x) => {
        if (params.dir !== current) return
        const next = x.data?.directory ?? raw
        setState("resolved", next)
      })
      .catch(() => {
        if (params.dir !== current) return
        setState("resolved", raw)
      })
  })

  return (
    <Show when={state.resolved}>
      {(resolved) => (
        <SDKProvider directory={resolved}>
          <SyncProvider>{props.children}</SyncProvider>
        </SDKProvider>
      )}
    </Show>
  )
}
