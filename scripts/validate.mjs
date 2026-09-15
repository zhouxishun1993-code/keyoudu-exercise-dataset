import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const excludedNames = new Set([".git", "node_modules"]);
const allowedStages = new Set([
  "production_2026_09_07",
  "style_sample",
  "historical_candidate",
  "user_selected_original",
  "repaired_candidate",
  "resumed_candidate",
  "continuation_candidate"
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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
    else if (entry.name !== "SHA256SUMS.txt") files.push(absolute);
  }
  return files;
}

function safeMediaPath(relative) {
  assert(typeof relative === "string" && /^images\/ex-\d{4}-(?:thumb|start|end)\.webp$/.test(relative), "Invalid media path: " + relative);
  const absolute = path.resolve(root, relative);
  const imagesRoot = path.resolve(root, "images") + path.sep;
  assert(absolute.startsWith(imagesRoot), "Media path escapes images/: " + relative);
  return absolute;
}

const dataPath = path.join(root, "data", "exercises.json");
const dataset = JSON.parse(await fs.readFile(dataPath, "utf8"));
JSON.parse(await fs.readFile(path.join(root, "data", "exercises.schema.json"), "utf8"));

assert(dataset.schema_version === "1.0.0", "Unexpected schema version");
assert(dataset.dataset_version === "0.1.0-rc.1", "Unexpected dataset version");
assert(dataset.counts.media_files === 2316, "Expected 2316 media files");
assert(dataset.counts.professional_reviewed === 0, "Professional review count must remain zero");
assert(Array.isArray(dataset.exercises) && dataset.exercises.length > 0, "Expected exercise records");

const ids = new Set();
const expectedMedia = new Set();

for (const exercise of dataset.exercises) {
  assert(/^ex-\d{4}$/.test(exercise.id), "Invalid exercise ID");
  assert(!ids.has(exercise.id), "Duplicate exercise ID: " + exercise.id);
  ids.add(exercise.id);
  assert(typeof exercise.name_zh === "string" && exercise.name_zh.length > 0, "Missing Chinese name: " + exercise.id);
  assert(Array.isArray(exercise.instructions_zh) && exercise.instructions_zh.length > 0, "Missing Chinese instructions: " + exercise.id);
  assert(["reps", "duration"].includes(exercise.measurement), "Invalid measurement: " + exercise.id);
  assert(allowedStages.has(exercise.review.stage), "Invalid review stage: " + exercise.id);
  assert(exercise.review.professional_review === "not_performed", "Unsupported professional review claim: " + exercise.id);
  assert(exercise.source.commit === "7455efae41b330c265e7cd4b78dfa848e7ce5ebd", "Source commit changed: " + exercise.id);
  assert(exercise.source.text_license === "MIT", "Source text license changed: " + exercise.id);
  assert(exercise.media.license === "CC BY 4.0", "Media license changed: " + exercise.id);
  assert(exercise.media.attribution === "课有度 Keyoudu", "Media attribution changed: " + exercise.id);
  assert(exercise.media.ai_generated === true, "Media must be marked AI-generated: " + exercise.id);

  for (const kind of ["thumbnail", "start", "end"]) {
    const relative = exercise.media[kind];
    const absolute = safeMediaPath(relative);
    expectedMedia.add(relative);
    const bytes = await fs.readFile(absolute);
    assert(bytes.length > 12, "Empty image: " + relative);
    assert(bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP", "Invalid WebP file: " + relative);
    assert(hash(bytes) === exercise.media.sha256[kind], "Image hash mismatch: " + relative);
    const dimensions = exercise.media.dimensions[kind];
    assert(Array.isArray(dimensions) && dimensions.length === 2 && dimensions.every(Number.isInteger), "Invalid dimensions: " + relative);
    const maximum = kind === "thumbnail" ? 256 : 768;
    assert(dimensions[0] > 0 && dimensions[1] > 0 && dimensions[0] <= maximum && dimensions[1] <= maximum, "Image dimensions exceed limit: " + relative);
  }
  assert(exercise.media.sha256.start !== exercise.media.sha256.end, "Start/end images are identical: " + exercise.id);
}

assert(expectedMedia.size === dataset.exercises.length * 3, "Expected three unique media references per exercise");

const actualMedia = (await fs.readdir(path.join(root, "images")))
  .filter((name) => name.endsWith(".webp"))
  .map((name) => "images/" + name);
assert(actualMedia.length === 2316, "Expected 2316 WebP files");
for (const relative of actualMedia) assert(expectedMedia.has(relative), "Unreferenced image: " + relative);

const browserPrefix = "window.KEYOUDU_EXERCISE_DATASET = ";
const browserRaw = await fs.readFile(path.join(root, "data", "exercises.js"), "utf8");
assert(browserRaw.startsWith(browserPrefix) && browserRaw.trimEnd().endsWith(";"), "Invalid browser data wrapper");
const browserDataset = JSON.parse(browserRaw.slice(browserPrefix.length).trim().replace(/;$/, ""));
assert(JSON.stringify(browserDataset) === JSON.stringify(dataset), "Browser data differs from canonical JSON");

const checksumLines = (await fs.readFile(path.join(root, "SHA256SUMS.txt"), "utf8")).trim().split(/\r?\n/);
const checksumMap = new Map();
for (const line of checksumLines) {
  const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
  assert(match, "Invalid checksum line: " + line);
  assert(!checksumMap.has(match[2]), "Duplicate checksum entry: " + match[2]);
  checksumMap.set(match[2], match[1]);
}

const files = await walk(root);
assert(checksumMap.size === files.length, "Checksum file count mismatch");
for (const file of files) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  assert(checksumMap.has(relative), "Missing checksum entry: " + relative);
  assert(hash(await fs.readFile(file)) === checksumMap.get(relative), "Repository checksum mismatch: " + relative);
}

const serialized = JSON.stringify(dataset);
assert(!/[A-Za-z]:\\\\/.test(serialized), "Dataset contains an absolute Windows path");
assert(!serialized.includes("prompt.txt") && !serialized.includes("generation-log"), "Dataset leaks internal generation records");

console.log("Validated exercise dataset and WebP media.");
