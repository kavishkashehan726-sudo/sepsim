/**
 * One simulation session: the machine, the program loaded into it and the stepping modes
 * of the old SEPSim (RTL = one clock, IL = one instruction, IL-Slow Motion = one
 * instruction, a clock about every second). React components subscribe to it.
 */
import {
  type Bits, Machine, MEMORIES, RAM_WORDS, SIGNAL_BY_PATH, SIGNALS, assemble, toBinary,
} from "@sepsim/core";
import { displayTime, settings } from "./settings";

export type StepMode = "RTL" | "IL" | "IL-Slow";
export const STEP_MODES: { value: StepMode; label: string }[] = [
  { value: "RTL", label: "RTL" },
  { value: "IL", label: "IL" },
  { value: "IL-Slow", label: "IL-Slow Motion" },
];

/** Clocks after which an instruction that has not finished is reported as stuck. */
export const INSTRUCTION_LIMIT = 1000;
export const SLOW_MOTION_MS = 1000;

export interface LogLine {
  time: number;
  text: string;
  kind: "info" | "warning" | "error";
}

/** Shown in program memory when the simulator is initialized, like the old power-on program. */
const SAMPLE_PROGRAM = `// Sample program: SEP runs this after Initialize.
// Load your own with Simulation > Load Program, or write one in the Program Editor.
loadacc #10      // acc = 10
add #5           // acc = 15
storeacc 0x90    // memory[0x90] = 15
shl #1           // acc = 30
storeacc 0x91    // memory[0x91] = 30
`;

const show = (v: Bits | string) => (typeof v === "string" ? v : toBinary(v));

export class Session {
  machine: Machine | null = null;
  mode: StepMode = "RTL";
  program: Uint16Array;
  programName = "sample program";
  /** True while IL-Slow Motion is running an instruction. */
  running = false;
  log: LogLine[] = [];

  /** Signal values and memory words before the last step, to show what changed. */
  private before = new Map<string, string>();
  private ramBefore: Uint16Array | null = null;
  private storageBefore: string[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private version = 0;

  constructor() {
    this.program = Uint16Array.from(assemble(SAMPLE_PROGRAM).words);
  }

  // --- subscription (useSyncExternalStore) ---
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = (): number => this.version;
  private changed(): void {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  private say(text: string, kind: LogLine["kind"] = "info"): void {
    this.log = [...this.log.slice(-199), { time: displayTime(this.machine?.timeNs ?? 0, settings.get()), text, kind }];
  }

  // --- simulation control ---
  get initialized(): boolean {
    return this.machine !== null;
  }

  initialize(): void {
    this.stopSlowMotion();
    this.machine = new Machine(this.program);
    this.remember();
    this.say(`Simulator initialized (Accumulator) with ${this.programName}.`);
    this.changed();
  }

  end(): void {
    this.stopSlowMotion();
    this.machine = null;
    this.before.clear();
    this.ramBefore = null;
    this.say("Simulation ended.");
    this.changed();
  }

  restart(): void {
    if (!this.machine) return this.initialize();
    this.stopSlowMotion();
    this.machine = new Machine(this.program);
    this.remember();
    this.say(`Simulation restarted with ${this.programName}.`);
    this.changed();
  }

  setMode(mode: StepMode): void {
    this.mode = mode;
    this.changed();
  }

  loadProgram(words: ArrayLike<number>, name: string): void {
    this.program = Uint16Array.from({ length: Math.min(words.length, RAM_WORDS) }, (_, i) => words[i] ?? 0);
    this.programName = name;
    if (this.machine) {
      this.stopSlowMotion();
      this.machine = new Machine(this.program);
      this.remember();
    }
    this.say(`Loaded ${name} (${this.program.length} words)${this.machine ? "" : "; it runs after Initialize"}.`);
    this.changed();
  }

  /** Single step (F10): one clock, one instruction or a slow-motion instruction. */
  singleStep(): void {
    const m = this.machine;
    if (!m) {
      this.say("Initialize the simulator first (Simulation > Initialize).", "warning");
      return this.changed();
    }
    if (this.running) return this.stopSlowMotion();
    if (m.halted) {
      this.reportHalt();
      return this.changed();
    }
    if (this.mode === "RTL") {
      this.remember();
      for (let i = 0; i < settings.get().stepHalfClocks && m.halfStep(); i++);
    } else if (this.mode === "IL") {
      this.remember();
      const n = m.stepInstruction(INSTRUCTION_LIMIT);
      if (n >= INSTRUCTION_LIMIT && m.state !== "ifetch1") this.reportStuck();
    } else {
      this.startSlowMotion();
      return;
    }
    if (m.halted) this.reportHalt();
    this.changed();
  }

  private startSlowMotion(): void {
    const m = this.machine;
    if (!m) return;
    this.running = true;
    let clocks = 0;
    const tick = () => {
      this.remember();
      const ok = m.step();
      clocks++;
      const done = !ok || m.state === "ifetch1" || clocks >= INSTRUCTION_LIMIT;
      if (m.halted) this.reportHalt();
      else if (clocks >= INSTRUCTION_LIMIT && m.state !== "ifetch1") this.reportStuck();
      if (done) {
        this.running = false;
        this.timer = null;
      } else {
        this.timer = setTimeout(tick, SLOW_MOTION_MS);
      }
      this.changed();
    };
    tick();
  }

  stopSlowMotion(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.running) {
      this.running = false;
      this.changed();
    }
  }

  private reportHalt(): void {
    const h = this.machine?.halted;
    if (!h) return;
    const where = h.address === null ? "an unknown address" : `address 0x${h.address.toString(16)}`;
    this.say(
      `Simulation stopped at ${displayTime(h.timeNs, settings.get())} ns: the program used ${where}, outside program memory ` +
        `(0x0 to 0x${(RAM_WORDS - 1).toString(16)}). Restart to run again.`,
      "error",
    );
  }

  private reportStuck(): void {
    this.say(
      `The instruction did not finish after ${INSTRUCTION_LIMIT} clocks (control unit stuck in ` +
        `${this.machine?.state}). The original SEP does the same for this instruction and mode.`,
      "warning",
    );
  }

  // --- values ---
  read(path: string): Bits | string | null {
    const m = this.machine;
    const s = SIGNAL_BY_PATH.get(path);
    return m && s ? s.read(m) : null;
  }

  /** Did the value change in the last step? */
  didChange(path: string): boolean {
    const v = this.read(path);
    if (v === null) return false;
    const old = this.before.get(path);
    return old !== undefined && old !== show(v);
  }

  readMemory(path: string, address: number): Bits | null {
    const m = this.machine;
    const mem = MEMORIES.find((x) => x.path === path);
    return m && mem ? mem.read(m, address) : null;
  }

  memoryWords(path: string): number {
    return MEMORIES.find((x) => x.path === path)?.words ?? 0;
  }

  /** Memory addresses whose contents changed in the last step. */
  changedAddresses(path: string): number[] {
    const m = this.machine;
    if (!m) return [];
    if (path.endsWith("as_ram/asram")) {
      const old = this.ramBefore;
      if (!old) return [];
      return Array.from(m.ram.keys()).filter((a) => m.ram[a] !== old[a]);
    }
    return m.storage.flatMap((b, a) => (this.storageBefore[a] !== undefined && this.storageBefore[a] !== toBinary(b) ? [a] : []));
  }

  canWrite(path: string): boolean {
    return this.machine !== null && SIGNAL_BY_PATH.get(path)?.write !== undefined;
  }

  deposit(path: string, value: Bits): void {
    const m = this.machine;
    const s = SIGNAL_BY_PATH.get(path);
    if (!m || !s?.write) return;
    s.write(m, value);
    this.say(`${path} set to ${toBinary(value)}; it is used from the next clock.`);
    this.changed();
  }

  depositMemory(path: string, address: number, value: Bits): void {
    const m = this.machine;
    const mem = MEMORIES.find((x) => x.path === path);
    if (!m || !mem) return;
    mem.write(m, address, value);
    this.say(`${path}[0x${address.toString(16)}] set to ${toBinary(value)}.`);
    this.changed();
  }

  private remember(): void {
    const m = this.machine;
    if (!m) return;
    this.before = new Map(SIGNALS.map((s) => [s.path, show(s.read(m))]));
    this.ramBefore = m.ram.slice();
    this.storageBefore = m.storage.map(toBinary);
  }
}

export const session = new Session();
