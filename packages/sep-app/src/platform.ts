/**
 * File access. In a browser (and as the fallback in the desktop shells) files are opened
 * with the file picker and saved as downloads; where the File System Access API exists
 * (Chromium, so Electron and WebView2) a real save dialog is used.
 */
export interface OpenedFile {
  name: string;
  text(): Promise<string>;
  bytes(): Promise<ArrayBuffer>;
}

export function openFile(accept: string): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      const f = input.files?.[0];
      resolve(f ? { name: f.name, text: () => f.text(), bytes: () => f.arrayBuffer() } : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

interface TauriWindow {
  __TAURI_INTERNALS__?: { invoke(cmd: string, args: Record<string, unknown>): Promise<unknown> };
}

/**
 * Open a web or mailto link in the system's browser or mail app. In Electron a new window is
 * refused and passed to the system (desktop/electron/main.cjs); Tauri needs its opener plugin.
 */
export function openExternal(url: string): void {
  const tauri = (window as unknown as TauriWindow).__TAURI_INTERNALS__;
  if (tauri) void tauri.invoke("plugin:opener|open_url", { url });
  else window.open(url, "_blank", "noopener");
}

interface SavePicker {
  showSaveFilePicker?: (o: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) =>
    Promise<{ name: string; createWritable(): Promise<{ write(d: string | Uint8Array): Promise<void>; close(): Promise<void> }> }>;
}

/** Save a file; returns the chosen file name, or null if the user cancelled. */
export async function saveFile(suggestedName: string, content: string | Uint8Array, description: string): Promise<string | null> {
  const ext = suggestedName.slice(suggestedName.lastIndexOf("."));
  const picker = (window as unknown as SavePicker).showSaveFilePicker;
  if (picker) {
    try {
      const mime = typeof content === "string" ? "text/plain" : "application/octet-stream";
      const handle = await picker({ suggestedName, types: [{ description, accept: { [mime]: [ext] } }] });
      const w = await handle.createWritable();
      await w.write(content);
      await w.close();
      return handle.name;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return null;
      // Fall through to a download if the picker is not allowed here.
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content as BlobPart], { type: typeof content === "string" ? "text/plain" : "application/octet-stream" }));
  a.download = suggestedName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return suggestedName;
}
