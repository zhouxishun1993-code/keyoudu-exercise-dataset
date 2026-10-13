import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const excludedNames = new Set([".git", "node_modules"]);

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
  assert(typeof relative === "string" && /^images\/ex-\d{4}-[a-z][a-z0-9-]*\.webp$/.test(relative), "Invalid media path: " + relative);
  const absolute = path.resolve(root, relative);
  const imagesRoot = path.resolve(root, "images") + path.sep;
  assert(absolute.startsWith(imagesRoot), "Media path escapes images/: " + relative);
  return absolute;
}

// Width and height read from the WebP container itself, so declared dimensions cannot drift from the files.
function webpDimensions(bytes, label) {
  assert(bytes.length > 30 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP", "Invalid WebP file: " + label);
  const chunk = bytes.subarray(12, 16).toString("ascii");
  if (chunk === "VP8 ") return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  if (chunk === "VP8L") {
    const bits = bytes.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
  }
  if (chunk === "VP8X") return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1];
  throw new Error("Unsupported WebP chunk in " + label);
}

// The subset of JSON Schema 2020-12 used by data/exercises.schema.json, so the repository stays dependency-free.
const supportedKeywords = new Set([
  "$schema", "$id", "$defs", "$ref", "title", "description", "format", "type", "const", "enum", "pattern",
  "minLength", "minItems", "uniqueItems", "minimum", "maximum", "required", "properties", "additionalProperties",
  "items", "prefixItems"
]);

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function validateSchema(value, schema, rootSchema, at) {
  for (const keyword of Object.keys(schema)) assert(supportedKeywords.has(keyword), "Schema uses an unsupported keyword: " + keyword);
  if (schema.$ref) {
    const match = /^#\/\$defs\/([A-Za-z0-9_]+)$/.exec(schema.$ref);
    assert(match && rootSchema.$defs && rootSchema.$defs[match[1]], "Unresolvable $ref: " + schema.$ref);
    return validateSchema(value, rootSchema.$defs[match[1]], rootSchema, at);
  }
  const actual = typeOf(value);
  if (schema.type !== undefined) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    assert(allowed.includes(actual) || (actual === "integer" && allowed.includes("number")), at + ": expected " + allowed.join("|") + ", got " + actual);
  }
  if ("const" in schema) assert(value === schema.const, at + ": expected " + JSON.stringify(schema.const) + ", got " + JSON.stringify(value));
  if (schema.enum) assert(schema.enum.includes(value), at + ": " + JSON.stringify(value) + " is not an allowed value");
  if (actual === "string") {
    if (schema.pattern) assert(new RegExp(schema.pattern, "u").test(value), at + ": does not match " + schema.pattern);
    if (schema.minLength !== undefined) assert([...value].length >= schema.minLength, at + ": shorter than " + schema.minLength);
  }
  if (actual === "integer" || actual === "number") {
    if (schema.minimum !== undefined) assert(value >= schema.minimum, at + ": below minimum " + schema.minimum);
    if (schema.maximum !== undefined) assert(value <= schema.maximum, at + ": above maximum " + schema.maximum);
  }
  if (actual === "array") {
    if (schema.minItems !== undefined) assert(value.length >= schema.minItems, at + ": fewer than " + schema.minItems + " items");
    if (schema.uniqueItems) assert(new Set(value.map((item) => JSON.stringify(item))).size === value.length, at + ": items are not unique");
    const prefix = schema.prefixItems || [];
    value.forEach((item, index) => {
      if (index < prefix.length) validateSchema(item, prefix[index], rootSchema, at + "[" + index + "]");
      else if (schema.items === false) throw new Error(at + ": unexpected item at index " + index);
      else if (schema.items) validateSchema(item, schema.items, rootSchema, at + "[" + index + "]");
    });
  }
  if (actual === "object") {
    for (const key of schema.required || []) assert(key in value, at + ": missing required property " + key);
    const properties = schema.properties || {};
    for (const [key, child] of Object.entries(value)) {
      if (key in properties) validateSchema(child, properties[key], rootSchema, at + "." + key);
      else if (schema.additionalProperties === false) throw new Error(at + ": unexpected property " + key);
      else if (typeof schema.additionalProperties === "object") validateSchema(child, schema.additionalProperties, rootSchema, at + "." + key);
    }
  }
}

const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const dataPath = path.join(root, "data", "exercises.json");
const dataset = JSON.parse(await fs.readFile(dataPath, "utf8"));
const schema = JSON.parse(await fs.readFile(path.join(root, "data", "exercises.schema.json"), "utf8"));

validateSchema(dataset, schema, schema, "dataset");

// One version number, stated once in package.json and repeated in the data file and changelog.
assert(dataset.dataset_version === packageJson.version, "dataset_version differs from package.json version");
const changelog = await fs.readFile(path.join(root, "CHANGELOG.md"), "utf8");
const latestEntry = /^## ([^\s]+)/m.exec(changelog);
assert(latestEntry && latestEntry[1] === packageJson.version, "Latest CHANGELOG entry differs from package.json version");
assert(dataset.counts.exercises === dataset.exercises.length, "Exercise count does not match records");

const pairs = (key, labelKey) => new Map(schema.$defs.exercise.properties[key].enum.map((value, index) => [value, schema.$defs.exercise.properties[labelKey].enum[index]]));
const targetLabels = pairs("target", "target_zh");
const internalNotes = /图示|图中|图片|两图|两帧|双帧|源图|现图|小图|原图|画外|叠化|核清|核定|待核|待确认|待最终|没收录|未收录|可读。|成立。|JEFIT|样本|预览/;
const internalNotesEn = /\bimages?\b|illustrated|as shown|static frames|source image|JEFIT/i;

const ids = new Set();
const names = new Set();
const expectedMedia = new Set();

for (const exercise of dataset.exercises) {
  assert(!ids.has(exercise.id), "Duplicate exercise ID: " + exercise.id);
  ids.add(exercise.id);
  assert(!names.has(exercise.name_zh), "Duplicate Chinese name: " + exercise.name_zh + " (" + exercise.id + ")");
  names.add(exercise.name_zh);
  assert(!exercise.aliases.includes(exercise.name_zh), "Alias repeats the name: " + exercise.id);
  assert(exercise.target_zh === targetLabels.get(exercise.target), "target_zh does not match target: " + exercise.id);
  assert(exercise.instructions_en.length === exercise.instructions_zh.length, "English and Chinese step counts differ: " + exercise.id);
  for (const step of exercise.instructions_zh) {
    assert(/[。！？]$/.test(step), "Chinese step lacks closing punctuation: " + exercise.id);
    assert(!internalNotes.test(step), "Chinese step reads like an image-review note: " + exercise.id + " " + step);
  }
  for (const step of exercise.instructions_en) {
    assert(!internalNotesEn.test(step), "English step reads like an image-review note: " + exercise.id + " " + step);
  }
  assert(!internalNotes.test(exercise.name_zh), "Name contains an internal note: " + exercise.id);
  assert(exercise.source.id === exercise.id.slice(3), "Source ID mismatch: " + exercise.id);

  for (const kind of ["thumbnail", "start", "end"]) {
    const relative = exercise.media[kind];
    assert(relative === "images/" + exercise.id + "-" + (kind === "thumbnail" ? "thumb" : kind) + ".webp", "Incorrect canonical image path: " + relative);
    const bytes = await fs.readFile(safeMediaPath(relative));
    expectedMedia.add(relative);
    assert(hash(bytes) === exercise.media.sha256[kind], "Image hash mismatch: " + relative);
    const declared = exercise.media.dimensions[kind];
    const actual = webpDimensions(bytes, relative);
    assert(declared[0] === actual[0] && declared[1] === actual[1], "Declared dimensions differ from file: " + relative);
    const maximum = kind === "thumbnail" ? 256 : 768;
    assert(actual[0] <= maximum && actual[1] <= maximum, "Image dimensions exceed limit: " + relative);
  }
  const frames = exercise.media.frames;
  const phases = new Set();
  for (const frame of frames) {
    assert(!phases.has(frame.phase), "Duplicate phase: " + exercise.id);
    phases.add(frame.phase);
    assert(frame.path.startsWith("images/" + exercise.id + "-"), "Frame belongs to another exercise: " + exercise.id);
    const bytes = await fs.readFile(safeMediaPath(frame.path));
    assert(hash(bytes) === frame.sha256, "Frame hash mismatch: " + frame.path);
    const actual = webpDimensions(bytes, frame.path);
    assert(frame.dimensions[0] === actual[0] && frame.dimensions[1] === actual[1], "Declared frame dimensions differ from file: " + frame.path);
    expectedMedia.add(frame.path);
  }
  assert(frames[0].path === exercise.media.start, "First frame must match start: " + exercise.id);
  if (frames.length === 1) {
    assert(exercise.measurement === "duration" && frames[0].phase === "hold", "Single frame requires an explicit hold: " + exercise.id);
    assert(exercise.media.sha256.start === exercise.media.sha256.end, "Hold compatibility images differ: " + exercise.id);
  } else {
    assert(frames.at(-1).path === exercise.media.end, "Last frame must match end: " + exercise.id);
    assert(exercise.media.sha256.start !== exercise.media.sha256.end, "Start/end images are identical: " + exercise.id);
  }
  assert(exercise.media.sequence.length >= frames.length && exercise.media.sequence.every((phase) => phases.has(phase)), "Invalid playback sequence: " + exercise.id);
  assert(new Set(exercise.media.sequence).size === phases.size, "Playback sequence omits a phase: " + exercise.id);
}

assert(expectedMedia.size === dataset.counts.media_files, "Media count does not match referenced files");

const actualMedia = (await fs.readdir(path.join(root, "images")))
  .filter((name) => name.endsWith(".webp"))
  .map((name) => "images/" + name);
assert(actualMedia.length === dataset.counts.media_files, "Unexpected number of WebP files");
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

// Figures quoted in the documentation must follow the data.
const readme = await fs.readFile(path.join(root, "README.md"), "utf8");
const figure = (n) => n.toLocaleString("en-US");
assert(readme.includes(figure(dataset.counts.exercises) + " 个动作"), "README exercise count is out of date");
assert(readme.includes(figure(dataset.counts.media_files) + " 张"), "README image count is out of date");
for (const match of readme.matchAll(/src="(images\/[^"]+)"/g)) assert(expectedMedia.has(match[1]), "README references a missing image: " + match[1]);
const notices = await fs.readFile(path.join(root, "THIRD_PARTY_NOTICES.md"), "utf8");
assert(notices.includes(figure(dataset.counts.media_files) + " 个 WebP"), "THIRD_PARTY_NOTICES image count is out of date");

const serialized = JSON.stringify(dataset);
assert(!/[A-Za-z]:\\\\/.test(serialized), "Dataset contains an absolute Windows path");
assert(!serialized.includes("prompt.txt") && !serialized.includes("generation-log"), "Dataset leaks internal generation records");

console.log("Validated " + dataset.counts.exercises + " exercises and " + dataset.counts.media_files + " WebP files (dataset " + dataset.dataset_version + ", schema " + dataset.schema_version + ").");
