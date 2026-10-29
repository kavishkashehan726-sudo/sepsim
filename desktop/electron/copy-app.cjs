// Copies the built user interface (packages/sep-app/dist) into this shell as app/.
const fs = require("fs");
const path = require("path");

const from = path.join(__dirname, "..", "..", "packages", "sep-app", "dist");
const to = path.join(__dirname, "app");
if (!fs.existsSync(path.join(from, "index.html"))) {
  console.error(`No build found in ${from}. Run "npm run build" in the repository root first.`);
  process.exit(1);
}
fs.rmSync(to, { recursive: true, force: true });
fs.cpSync(from, to, { recursive: true });
console.log(`Copied ${from} to ${to}`);
