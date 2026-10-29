/**
 * The advanced settings (Edit > Settings in the old SEPSim): which signals each category
 * shows, clock control, and the instruction set the assembler uses. Saved in the browser
 * storage of the app, and can be exported to and imported from a file.
 */
import { ACCUMULATOR_ISA, type InstructionSet } from "@sepsim/core";
import { DEFAULT_ENTITIES, type Entity } from "./entities";
import { Store } from "./store";

export type ListCategory = "registers" | "buses" | "custom";

export interface OpcodeRow {
  mnemonic: string;
  /** 5 bits, as 0s and 1s. */
  bits: string;
}

export interface ModeRow {
  /** One character typed before the operand, or "def" for no symbol (direct). */
  symbol: string;
  /** 3 bits, as 0s and 1s. */
  bits: string;
}

export interface Settings {
  version: 1;
  entities: Record<ListCategory, Entity[]>;
  /** Clock period in ns. The model is clocked, so this only scales the times shown. */
  periodNs: number;
  /** Clock duty cycle, percent: when in the period the falling edge comes. */
  dutyCycle: number;
  /** How far one RTL single step runs, in half clocks (2 = one clock). */
  stepHalfClocks: number;
  opcodes: OpcodeRow[];
  modes: ModeRow[];
}

const bin = (v: number, w: number) => v.toString(2).padStart(w, "0");

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  entities: DEFAULT_ENTITIES,
  periodNs: 50,
  dutyCycle: 50,
  stepHalfClocks: 2,
  opcodes: Object.entries(ACCUMULATOR_ISA.opcodes).map(([mnemonic, v]) => ({ mnemonic, bits: bin(v, 5) })),
  modes: [
    ...Object.entries(ACCUMULATOR_ISA.modes).map(([symbol, v]) => ({ symbol, bits: bin(v, 3) })),
    { symbol: "def", bits: bin(ACCUMULATOR_ISA.direct, 3) },
  ],
};

/** Accept a saved or imported settings object, filling anything missing with defaults. */
export function reviveSettings(saved: unknown): Settings | null {
  if (!saved || typeof saved !== "object" || (saved as { version?: unknown }).version !== 1) return null;
  const s = saved as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    entities: { ...DEFAULT_SETTINGS.entities, ...(s.entities ?? {}) },
    version: 1,
  };
}

export const settings = new Store<Settings>(DEFAULT_SETTINGS, "sepsim.settings", reviveSettings);

/** The instruction set described by the settings, for the assembler. */
export function instructionSet(s: Settings): InstructionSet {
  const opcodes: Record<string, number> = {};
  for (const o of s.opcodes) if (o.mnemonic && /^[01]{5}$/.test(o.bits)) opcodes[o.mnemonic.toLowerCase()] = parseInt(o.bits, 2);
  const modes: Record<string, number> = {};
  let direct = ACCUMULATOR_ISA.direct;
  for (const m of s.modes) {
    if (!/^[01]{3}$/.test(m.bits)) continue;
    if (m.symbol === "def") direct = parseInt(m.bits, 2);
    else if (m.symbol.length === 1) modes[m.symbol] = parseInt(m.bits, 2);
  }
  return { opcodes, modes, direct };
}

/** A time on the model's 25 ns half-clock grid, shown with the configured period and duty cycle. */
export function displayTime(timeNs: number, s: Settings): number {
  const half = Math.round(timeNs / 25);
  const cycles = Math.floor(half / 2);
  const t = cycles * s.periodNs + (half % 2 ? (s.periodNs * s.dutyCycle) / 100 : 0);
  return Math.round(t * 1000) / 1000;
}
