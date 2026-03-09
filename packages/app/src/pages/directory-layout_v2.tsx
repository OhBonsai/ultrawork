import { createEffect, createMemo, Show, type ParentProps } from "solid-js"
import { createStore } from "solid-js/store"
import { useNavigate, useParams } from "@solidjs/router"
import { base64Encode } from "@opencode-ai/util/encode"
import { DataProvider } from "@opencode-ai/ui/context"
import { SDKProvider } from "@/context/sdk"
import { SyncProvider, useSync } from "@/context/sync"
import { LocalProvider } from "@/context/local"
import { useGlobalSDK } from "@/context/global-sdk"
import { decode64 } from "@/utils/base64"

function DirectoryDataProviderV2(props: ParentProps<{ directory: string }>) {
  const navigate = useNavigate()
  const sync = useSync()
  const slug = createMemo(() => base64Encode(props.directory))

  return (
    <DataProvider
      data={sync.data}
      directory={props.directory}
      onNavigateToSession={(sessionID: string) => navigate(`/task/${slug()}/${sessionID}`)}
      onSessionHref={(sessionID: string) => `/task/${slug()}/${sessionID}`}
    >
      <LocalProvider>{props.children}</LocalProvider>
    </DataProvider>
  )
}

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
          <SyncProvider>
            <DirectoryDataProviderV2 directory={resolved()}>
              {props.children}
            </DirectoryDataProviderV2>
          </SyncProvider>
        </SDKProvider>
      )}
    </Show>
  )
}
