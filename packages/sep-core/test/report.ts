/** Dev helper: `npx vite-node test/report.ts [name-prefix [count]]` prints the first differences per program. */
import { replay } from "./parity.js";
import { goldenCases } from "./trace.js";

const prefix = process.argv[2] ?? "";
let ok = 0;
const cases = goldenCases("accumulator").filter((c) => c.name.startsWith(prefix));
for (const c of cases) {
  const r = replay(c);
  const haltOk = r.halt.got === r.halt.want;
  if (r.mismatches.length === 0 && haltOk) {
    ok++;
    continue;
  }
  console.log(`${c.name}: ${r.mismatches.length} signals differ${haltOk ? "" : `, halt got ${r.halt.got} want ${r.halt.want}`}`);
  for (const x of r.mismatches.slice(0, Number(process.argv[3] ?? 6))) {
    console.log(`  ${x.t} ${x.signal}: got ${x.got.slice(0, 60)} want ${x.want.slice(0, 60)}`);
  }
}
console.log(`${ok}/${cases.length} match`);
