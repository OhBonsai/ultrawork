import { createContext, useContext } from "solid-js"

const RoutePrefixContext = createContext("")

export const RoutePrefixProvider = RoutePrefixContext.Provider

export function useRoutePrefix() {
  return useContext(RoutePrefixContext)
}
