import { createContext, useContext } from "react";

export const SidebarContext = createContext({ expanded: true });

export function useSidebar() {
  return useContext(SidebarContext);
}
