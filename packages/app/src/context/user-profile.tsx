import { createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { Persist, persisted } from "@/utils/persist"

export interface UserProfile {
  fullName: string
  nickname: string
  avatar: string
  workScene: string
}

const defaultProfile: UserProfile = {
  fullName: "",
  nickname: "",
  avatar: "",
  workScene: "",
}

function withFallback<T>(read: () => T | undefined, fallback: T) {
  return createMemo(() => read() ?? fallback)
}

export const { use: useUserProfile, provider: UserProfileProvider } = createSimpleContext({
  name: "UserProfile",
  init: () => {
    const [store, setStore, _, ready] = persisted(
      Persist.global("user-profile"),
      createStore<UserProfile>(defaultProfile),
    )

    return {
      ready,
      fullName: withFallback(() => store.fullName, defaultProfile.fullName),
      setFullName(value: string) {
        setStore("fullName", value)
      },
      nickname: withFallback(() => store.nickname, defaultProfile.nickname),
      setNickname(value: string) {
        setStore("nickname", value)
      },
      avatar: withFallback(() => store.avatar, defaultProfile.avatar),
      setAvatar(value: string) {
        setStore("avatar", value)
      },
      workScene: withFallback(() => store.workScene, defaultProfile.workScene),
      setWorkScene(value: string) {
        setStore("workScene", value)
      },
      displayName: createMemo(() => store.nickname || store.fullName || "User"),
    }
  },
})
