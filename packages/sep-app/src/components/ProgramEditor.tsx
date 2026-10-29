import Editor, { type OnMount } from "@monaco-editor/react";
import { ACCUMULATOR_ISA, type Diagnostic, MEM_HEADER, assemble, buildSummary, formatMem } from "@sepsim/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SEP_LANGUAGE, monaco, setInstructionSet } from "../monaco";
import { openFile, saveFile } from "../platform";
import { ACCUMULATOR_INSTRUCTIONS } from "../sim/isa";
import { session } from "../sim/session";
import { instructionSet, settings } from "../sim/settings";
import { useStore } from "../sim/store";

type EditorInstance = Parameters<OnMount>[0];

const NEW_PROGRAM = "// New program for the Accumulator architecture\n";

/** .prg files are saved like the old editor saves them: its header line first, CRLF ends. */
function toPrg(source: string): string {
  const body = source.replace(/\r\n/g, "\n");
  const withHeader = body.startsWith(MEM_HEADER) ? body : `${MEM_HEADER}\n${body}`;
  return withHeader.replace(/\n/g, "\r\n");
}

/** What the default mode symbols mean on the Accumulator architecture. */
const MODE_NAMES: Record<string, string> = { "#": "immediate", "&": "indirect", $: "(not valid on Accumulator)", "!": "(not implemented)", "@": "(not implemented)" };

const baseName = (name: string) => name.replace(/\.[^.]*$/, "");

export function ProgramEditor({ onClose, dark }: { onClose: () => void; dark: boolean }) {
  const [source, setSource] = useState(NEW_PROGRAM);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [output, setOutput] = useState<{ text: string; line?: number; error?: boolean }[]>([]);
  const editorRef = useRef<EditorInstance | null>(null);
  const conf = useStore(settings);
  const isa = useMemo(() => instructionSet(conf), [conf]);
  useEffect(() => setInstructionSet(isa), [isa]);
  const instructions = useMemo(() => {
    // Describe each opcode by what SEP does with its code, so a renamed instruction keeps its description.
    const known = (code: number) => ACCUMULATOR_INSTRUCTIONS.findIndex((i) => ACCUMULATOR_ISA.opcodes[i.mnemonic] === code);
    return Object.entries(isa.opcodes)
      .map(([mnemonic, code]) => ({ mnemonic, order: known(code) }))
      .sort((x, y) => (x.order < 0 ? 99 : x.order) - (y.order < 0 ? 99 : y.order))
      .map(({ mnemonic, order }) => ({ mnemonic, text: order < 0 ? "no Accumulator instruction has this code" : ACCUMULATOR_INSTRUCTIONS[order]!.text }));
  }, [isa]);
  const modeSymbols = Object.keys(isa.modes);

  const showErrors = useCallback((errors: Diagnostic[]) => {
    const model = editorRef.current?.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(model, "sep", errors.map((e) => ({
      severity: monaco.MarkerSeverity.Error,
      message: e.message,
      startLineNumber: e.line,
      endLineNumber: e.line,
      startColumn: 1,
      endColumn: model.getLineMaxColumn(e.line),
    })));
  }, []);

  const check = () => {
    const p = assemble(source, isa);
    showErrors(p.errors);
    setOutput([...p.errors.map((e) => ({ text: `Line ${e.line}: ${e.message}`, line: e.line, error: true })), { text: buildSummary(p) }]);
    return p;
  };

  const save = async (): Promise<string | null> => {
    const name = await saveFile(fileName ?? "program.prg", toPrg(source), "SEP program");
    if (!name) return null;
    setFileName(name);
    setDirty(false);
    return name;
  };

  const build = async () => {
    const p = check();
    if (p.errors.length) return;
    const prg = await save();
    if (!prg) return setOutput((o) => [...o, { text: "Build cancelled: the program was not saved." }]);
    const memName = `${baseName(prg)}.mem`;
    const saved = await saveFile(memName, formatMem(p.words), "SEP machine code");
    session.loadProgram(p.words, saved ?? memName);
    setOutput((o) => [...o, { text: `${saved ?? memName} written (${p.words.length} words) and loaded into the simulator.` }]);
  };

  const open = async () => {
    const f = await openFile(".prg,.txt");
    if (!f) return;
    const text = (await f.text()).replace(/\r\n/g, "\n");
    setSource(text);
    setFileName(f.name);
    setDirty(false);
    setOutput([]);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const btn = "rounded border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600";
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-label="Program Editor">
      <div className="flex h-full max-h-[52rem] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-300 bg-slate-50 shadow-2xl dark:border-slate-600 dark:bg-slate-800">
        <div className="flex items-center gap-2 border-b border-slate-300 px-3 py-2 dark:border-slate-600">
          <span className="font-semibold">Program Editor</span>
          <span className="text-sm text-slate-500">{fileName ?? "untitled.prg"}{dirty ? " *" : ""}</span>
          <span className="ml-4 text-sm">Target: <b>Accumulator</b></span>
          <div className="flex-1" />
          <button className={btn} onClick={() => { setSource(NEW_PROGRAM); setFileName(null); setDirty(false); setOutput([]); }}>New</button>
          <button className={btn} onClick={open}>Open…</button>
          <button className={btn} onClick={() => save()}>Save…</button>
          <button className={btn} onClick={check}>Check</button>
          <button className={`${btn} !border-sky-600 !bg-sky-600 text-white hover:!bg-sky-700`} onClick={build}>Build</button>
          <button className={btn} onClick={onClose} aria-label="Close the program editor">Close</button>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">
            <Editor
              language={SEP_LANGUAGE}
              theme={dark ? "vs-dark" : "vs"}
              value={source}
              onChange={(v) => {
                setSource(v ?? "");
                setDirty(true);
              }}
              onMount={(ed) => {
                editorRef.current = ed;
              }}
              options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true }}
            />
          </div>
          <aside className="w-72 overflow-auto border-l border-slate-300 p-2 text-sm dark:border-slate-600">
            <div className="mb-1 font-semibold">Instructions</div>
            <p className="mb-2 text-xs text-slate-500">
              Modes: none for direct{modeSymbols.map((m) => <span key={m}>, <code>{m}</code>{MODE_NAMES[m] ? ` ${MODE_NAMES[m]}` : ""}</span>)}.
              An instruction with no operand reuses the previous line's mode and operand.
            </p>
            {instructions.map((i) => (
              <button
                key={i.mnemonic}
                className="block w-full rounded px-1 py-0.5 text-left hover:bg-sky-100 dark:hover:bg-sky-900"
                title="Insert at the cursor"
                onClick={() => {
                  const ed = editorRef.current;
                  const pos = ed?.getPosition();
                  if (!ed || !pos) return;
                  ed.executeEdits("insert", [{ range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column), text: `${i.mnemonic} ` }]);
                  ed.focus();
                }}
              >
                <span className="font-mono font-semibold">{i.mnemonic}</span>
                <span className="ml-2 text-xs text-slate-500">{i.text}</span>
              </button>
            ))}
          </aside>
        </div>
        <div className="h-28 overflow-auto border-t border-slate-300 bg-white p-2 font-mono text-xs dark:border-slate-600 dark:bg-slate-900" aria-label="Build output">
          {output.length === 0 && <span className="text-slate-400">Check finds syntax errors. Build checks, saves the .prg and .mem and loads the program into the simulator.</span>}
          {output.map((o, i) => (
            <div
              key={i}
              className={o.error ? "cursor-pointer text-red-600 hover:underline dark:text-red-400" : ""}
              onClick={() => {
                if (!o.line) return;
                editorRef.current?.revealLineInCenter(o.line);
                editorRef.current?.setPosition({ lineNumber: o.line, column: 1 });
                editorRef.current?.focus();
              }}
            >
              {o.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
