import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataFile = path.join(root, "data", "exercises.json");
const browserFile = path.join(root, "data", "exercises.js");
const checksumFile = path.join(root, "SHA256SUMS.txt");
const excludedNames = new Set([".git", "node_modules"]);

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
  const files = [];
  for (const entry of entries) {
    if (excludedNames.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (absolute !== checksumFile) files.push(absolute);
  }
  return files;
}

const raw = await fs.readFile(dataFile, "utf8");
const dataset = JSON.parse(raw);
await fs.writeFile(browserFile, "window.KEYOUDU_EXERCISE_DATASET = " + JSON.stringify(dataset, null, 2) + ";\n");

const files = await walk(root);
const lines = [];
for (const file of files) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  lines.push(hash(await fs.readFile(file)) + "  " + relative);
}
await fs.writeFile(checksumFile, lines.join("\n") + "\n");

console.log("Synced browser data and " + lines.length + " checksums.");
