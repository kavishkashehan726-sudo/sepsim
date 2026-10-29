import { useSyncExternalStore } from "react";
import { session } from "./session";

/** Re-render whenever the simulation changes. */
export function useSession() {
  useSyncExternalStore(session.subscribe, session.getVersion);
  return session;
}
