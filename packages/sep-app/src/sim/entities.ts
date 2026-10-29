/**
 * What each category of the main window lists. The old SEPSim kept this in SelSigs.ini and
 * let advanced users change it (Edit > Settings > Signal List); these are the defaults.
 */
export type Category = "registers" | "memories" | "buses" | "custom";

export interface Entity {
  label: string;
  path: string;
}

export interface MemoryView {
  label: string;
  path: string;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  registers: "Registers",
  memories: "Memories",
  buses: "Buses",
  custom: "Custom",
};

const P = "/processor/";

export const DEFAULT_ENTITIES: Record<Exclude<Category, "memories">, Entity[]> = {
  registers: [
    { label: "Program Counter (PC)", path: `${P}sig_pc_out` },
    { label: "Memory Address Register (MAR)", path: `${P}sig_mar_out` },
    { label: "Memory Data Register (MDR)", path: `${P}sig_mdr_out` },
    { label: "Instruction Register (IR)", path: `${P}instruction_reg/op` },
    { label: "Accumulator", path: "{/processor/cache/storage[0]}" },
    { label: "Status Register (P S O C Z)", path: `${P}sig_sr_out` },
    { label: "Control unit state", path: `${P}control_unit/cu_state` },
    { label: "Next control unit state", path: `${P}control_unit/next_cu_state` },
  ],
  buses: [
    { label: "Memory address", path: `${P}as_ram/addr` },
    { label: "Memory data", path: `${P}sig_mem_out` },
    { label: "ALU input 1", path: `${P}sig_alu_1` },
    { label: "ALU input 2", path: `${P}sig_alu_2` },
    { label: "ALU output", path: `${P}sig_alu_out` },
    { label: "ALU flags (to SR)", path: `${P}sig_sr_in` },
    { label: "Operand 2 (IR 39:21)", path: `${P}sig_ir_op2` },
    { label: "Operand 1 (IR 19:1)", path: `${P}sig_ir_op1` },
    { label: "Mux 3 out (to accumulator)", path: `${P}sig_mux3_out` },
    { label: "Mux 4 out (to PC)", path: `${P}sig_mux4_pc` },
    { label: "Mux 5 out (to MAR)", path: `${P}sig_mux5_mar` },
    { label: "Mux 6 out (to MDR)", path: `${P}sig_mux6_mdr` },
    { label: "Mux 9 out (operand)", path: `${P}sig_mux9_out` },
    { label: "Accumulator out", path: `${P}sig_acc_stack_rb_out` },
  ],
  custom: [
    { label: "Architecture", path: `${P}machine` },
    { label: "System Clock", path: `${P}clk` },
    { label: "Opcode (IR 47:43)", path: "{/processor/instruction_reg/op[47:43]}" },
    { label: "Addressing mode (IR 42:40)", path: "{/processor/instruction_reg/op[42:40]}" },
    { label: "ALU operation", path: `${P}sig_cu_alu` },
    { label: "ALU reset", path: `${P}sig_alu_rst` },
    { label: "Memory write enable (we, active low)", path: `${P}sig_we` },
    { label: "Memory output enable (oe, active low)", path: `${P}sig_oe` },
    { label: "Memory chip enable (ce)", path: `${P}sig_ce` },
    { label: "MDR to memory buffer", path: `${P}sig_cu_buff` },
    { label: "Write enable PC", path: `${P}sig_cu_pc` },
    { label: "Write enable MAR", path: `${P}sig_cu_mar` },
    { label: "Write enable MDR", path: `${P}sig_cu_mdr` },
    { label: "Write enable IR", path: `${P}sig_cu_ir` },
    { label: "Write enable SR", path: `${P}sig_cu_sr` },
    { label: "Write enable accumulator", path: `${P}sig_cu_acc` },
    { label: "Mux 1 select", path: `${P}sig_cu_mux1` },
    { label: "Mux 2 select", path: `${P}sig_cu_mux2` },
    { label: "Mux 3 select", path: `${P}sig_cu_mux3` },
    { label: "Mux 4 select", path: `${P}sig_cu_mux4` },
    { label: "Mux 5 select", path: `${P}sig_cu_mux5` },
    { label: "Mux 6 select", path: `${P}sig_cu_mux6` },
    { label: "Mux 9 select", path: `${P}sig_cu_mux9` },
  ],
};

export const DEFAULT_MEMORIES: MemoryView[] = [
  { label: "Program Memory", path: `${P}as_ram/asram` },
  { label: "Register Bank", path: `${P}cache/storage` },
];
