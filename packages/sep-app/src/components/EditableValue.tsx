import { useState } from "react";
import { type Radix, parseValue } from "../sim/format";

/**
 * A value cell. Click to edit when the entity can be changed; Enter applies, Escape cancels.
 * The new value is fed to SEP at the next single step, as in the old SEPSim.
 */
export function EditableValue({ text, width, radix, editable, changed, onCommit }: {
  text: string;
  width: number;
  radix: Radix;
  editable: boolean;
  changed: boolean;
  onCommit: (v: NonNullable<ReturnType<typeof parseValue>>) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  const cls = `font-mono ${changed ? "font-semibold text-red-600 dark:text-red-400" : ""}`;
  if (draft === null) {
    return (
      <span
        className={`${cls} ${editable ? "cursor-text rounded px-1 hover:bg-sky-100 dark:hover:bg-sky-900" : "px-1"}`}
        title={editable ? "Click to change this value" : undefined}
        onClick={() => editable && setDraft(text)}
      >
        {text}
      </span>
    );
  }
  return (
    <input
      autoFocus
      aria-label="New value"
      className={`w-full rounded border px-1 font-mono outline-none ${bad ? "border-red-500" : "border-sky-500"} bg-white dark:bg-slate-900`}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        setBad(false);
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setDraft(null);
        if (e.key === "Enter") {
          const v = parseValue(draft, width, radix);
          if (!v) return setBad(true);
          onCommit(v);
          setDraft(null);
        }
      }}
      onFocus={(e) => e.target.select()}
    />
  );
}
