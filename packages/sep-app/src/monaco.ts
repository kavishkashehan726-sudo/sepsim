/**
 * Monaco is bundled with the app (no CDN), so the editor works with no internet. Only the
 * base editor worker is needed: SEP assembly has no language service.
 */
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { MODES, OPCODES } from "@sepsim/core";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

export const SEP_LANGUAGE = "sep-asm";

monaco.languages.register({ id: SEP_LANGUAGE, extensions: [".prg"] });
monaco.languages.setMonarchTokensProvider(SEP_LANGUAGE, {
  ignoreCase: true,
  mnemonics: Object.keys(OPCODES),
  tokenizer: {
    root: [
      [/\/\/.*$/, "comment"],
      [/[a-z][a-z0-9]*/, { cases: { "@mnemonics": "keyword", "@default": "invalid" } }],
      [new RegExp(`[${Object.keys(MODES).map((m) => `\\${m}`).join("")}]`), "operator"],
      [/-?0x[0-9a-f]+/, "number.hex"],
      [/-?\d+/, "number"],
      [/,/, "delimiter"],
    ],
  },
});
monaco.languages.setLanguageConfiguration(SEP_LANGUAGE, { comments: { lineComment: "//" } });
monaco.languages.registerCompletionItemProvider(SEP_LANGUAGE, {
  provideCompletionItems: (model, position) => {
    const word = model.getWordUntilPosition(position);
    const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
    return {
      suggestions: Object.keys(OPCODES).map((m) => ({ label: m, kind: monaco.languages.CompletionItemKind.Keyword, insertText: m, range })),
    };
  },
});

export { monaco };
