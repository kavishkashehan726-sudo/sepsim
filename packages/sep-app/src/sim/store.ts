/** A tiny observable value for React (useSyncExternalStore), optionally saved in localStorage. */
import { useSyncExternalStore } from "react";

export class Store<T> {
  private value: T;
  private listeners = new Set<() => void>();

  constructor(initial: T, private readonly key?: string, revive?: (saved: unknown) => T | null) {
    this.value = initial;
    if (key) {
      try {
        const raw = localStorage.getItem(key);
        const saved = raw === null ? null : revive ? revive(JSON.parse(raw)) : (JSON.parse(raw) as T);
        if (saved !== null) this.value = saved;
      } catch {
        // Storage can be missing or blocked; the defaults are used.
      }
    }
  }

  get = (): T => this.value;

  set(value: T): void {
    this.value = value;
    if (this.key) {
      try {
        localStorage.setItem(this.key, JSON.stringify(value));
      } catch {
        // Not saved; it still applies for this session.
      }
    }
    for (const fn of this.listeners) fn();
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}
