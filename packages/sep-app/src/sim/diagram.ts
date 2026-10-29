/**
 * The animated schematic: a list of drawn elements, each tied to a signal. Elements whose
 * value changed in the last step turn red (control lines turn green), like the old SEPSim.
 * Diagrams from the old SEPSim (.dia files, Schematic > Load) can be opened too.
 */
export type ElementKind = "bus" | "control" | "register" | "memory" | "control-unit" | "alu" | "mux";

export interface DiagramElement {
  kind: ElementKind;
  name: string;
  signal?: string;
  /** Bus path, or the top-left and bottom-right corners of a box. */
  points: [number, number][];
  /** Line width of a bus, in pixels. */
  width?: number;
}

export interface Diagram {
  name: string;
  elements: DiagramElement[];
}

const P = "/processor/";

const box = (kind: ElementKind, name: string, x1: number, y1: number, x2: number, y2: number, signal?: string): DiagramElement =>
  signal ? { kind, name, signal, points: [[x1, y1], [x2, y2]] } : { kind, name, points: [[x1, y1], [x2, y2]] };
const bus = (name: string, signal: string, ...points: [number, number][]): DiagramElement =>
  ({ kind: "bus", name, signal: P + signal, points, width: 4 });
const control = (name: string, signal: string, ...points: [number, number][]): DiagramElement =>
  ({ kind: "control", name, signal: P + signal, points, width: 1 });

/** The Accumulator datapath, drawn for the new app. */
export const ACCUMULATOR_DIAGRAM: Diagram = {
  name: "Accumulator",
  elements: [
    box("control-unit", "Control Unit", 20, 90, 150, 470, `${P}control_unit/cu_state`),
    box("mux", "Mux 4", 220, 190, 290, 220),
    box("register", "Program Counter", 200, 250, 300, 330, `${P}sig_pc_out`),
    box("register", "Instruction Register", 340, 230, 450, 430, `${P}instruction_reg/op`),
    box("mux", "Mux 9", 480, 330, 540, 360),
    box("mux", "Mux 3", 590, 190, 660, 220),
    box("register", "Accumulator", 575, 250, 675, 330, "{/processor/cache/storage[0]}"),
    box("mux", "Mux 1", 700, 180, 770, 210),
    box("mux", "Mux 2", 700, 390, 770, 420),
    box("alu", "ALU", 760, 230, 850, 370),
    box("register", "Status Register", 770, 440, 870, 490, `${P}sig_sr_out`),
    box("mux", "Mux 5", 910, 150, 980, 175),
    box("register", "Memory Address Register", 895, 200, 995, 280, `${P}sig_mar_out`),
    box("register", "Memory Data Register", 895, 320, 995, 400, `${P}sig_mdr_out`),
    box("mux", "Mux 6", 910, 420, 980, 445),
    box("memory", "Memory", 1080, 150, 1240, 450, `${P}as_ram/asram`),

    bus("ALU out", "sig_alu_out", [850, 300], [875, 300]),
    bus("PC out", "sig_pc_out", [300, 290], [320, 290], [320, 140], [945, 140], [945, 150]),
    bus("mem address", "as_ram/addr", [995, 240], [1080, 240]),
    bus("mem data", "sig_mem_out", [1080, 380], [995, 380]),
    bus("MDR out", "sig_mdr_out", [895, 390], [885, 390], [885, 510], [395, 510], [395, 430]),
    bus("operand", "sig_ir_op2", [450, 345], [480, 345]),
    bus("mux 9 out", "sig_mux9_out", [540, 345], [560, 345], [560, 160], [625, 160], [625, 190]),
    bus("to accumulator", "sig_mux3_out", [625, 220], [625, 250]),
    bus("accumulator out", "sig_acc_stack_rb_out", [675, 290], [690, 290], [690, 195], [700, 195]),
    bus("ALU in 1", "sig_alu_1", [770, 195], [790, 195], [790, 230]),
    bus("ALU in 2", "sig_alu_2", [770, 405], [790, 405], [790, 370]),
    bus("flags", "sig_sr_in", [820, 370], [820, 440]),
    bus("to PC", "sig_mux4_pc", [255, 220], [255, 250]),
    bus("to MAR", "sig_mux5_mar", [945, 175], [945, 200]),
    bus("to MDR", "sig_mux6_mdr", [945, 420], [945, 400]),

    control("write enable PC", "sig_cu_pc", [40, 90], [40, 30], [296, 30], [296, 250]),
    control("write enable IR", "sig_cu_ir", [55, 90], [55, 40], [440, 40], [440, 230]),
    control("write enable Acc", "sig_cu_acc", [70, 90], [70, 50], [668, 50], [668, 250]),
    control("write enable MAR", "sig_cu_mar", [85, 90], [85, 60], [988, 60], [988, 200]),
    control("write enable MDR", "sig_cu_mdr", [100, 90], [100, 70], [1005, 70], [1005, 340], [995, 340]),
    { kind: "control", name: "ALU opcode", signal: `${P}sig_cu_alu`, points: [[115, 90], [115, 80], [835, 80], [835, 245]], width: 3 },
    control("mem we", "sig_we", [130, 90], [130, 10], [1150, 10], [1150, 150]),
    control("mem oe", "sig_oe", [140, 90], [140, 20], [1190, 20], [1190, 150]),
    control("write enable SR", "sig_cu_sr", [150, 465], [770, 465]),
  ],
};

/** Element kinds as numbered in the old .dia files. */
const DIA_KINDS: Record<number, ElementKind> = {
  0: "bus", 1: "register", 2: "memory", 3: "control-unit", 4: "alu", 5: "control", 6: "mux",
};

/**
 * Read a diagram saved by the old SEPSim. Each element is: id, kind, bus width (u16), the
 * marker "#" (u16), name length, point count, 2 unused bytes, signal length, 6 unused
 * bytes, fill colour, then the points (x, y as int32), the signal path and the name.
 */
export function parseDia(data: ArrayBuffer, name: string): Diagram {
  const view = new DataView(data);
  const bytes = new Uint8Array(data);
  const text = (at: number, n: number) => String.fromCharCode(...bytes.subarray(at, at + n));
  const elements: DiagramElement[] = [];
  let o = 0;
  while (o + 36 <= bytes.length) {
    const kind = view.getUint32(o + 4, true);
    const width = view.getUint16(o + 8, true);
    if (view.getUint16(o + 10, true) !== 0x23) throw new Error("This is not a SEPSim diagram file.");
    const nameLen = view.getUint32(o + 12, true);
    const count = view.getUint32(o + 16, true);
    const sigLen = view.getUint32(o + 22, true);
    o += 36;
    const points: [number, number][] = [];
    for (let i = 0; i < count; i++, o += 8) points.push([view.getInt32(o, true), view.getInt32(o + 4, true)]);
    const signal = text(o, sigLen);
    o += sigLen;
    const label = text(o, nameLen);
    o += nameLen;
    const el: DiagramElement = { kind: DIA_KINDS[kind] ?? "register", name: label, points };
    if (signal) el.signal = signal;
    if (el.kind === "bus" || el.kind === "control") el.width = Math.max(1, width);
    elements.push(el);
  }
  return { name, elements };
}
