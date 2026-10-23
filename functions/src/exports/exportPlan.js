/**
 * Pure logic of the "export all company data" ZIP (no Firebase imports, so it
 * can be unit-tested): which collections go in, how a record is serialised,
 * which Storage files a record points at (and whether they may be included),
 * and the offline `index.html` viewer.
 *
 * The cross-company rule lives here: a Storage path is only ever included when
 * it sits under a folder keyed by THIS company (or one of its plants) — see
 * isAllowedStoragePath().
 */

/** What goes into the ZIP, grouped like the app's modules. */
const SECTIONS = [
  {id: "workOrders", label: "Work orders", collections: [
    {name: "workOrders", label: "Work orders", subcollections: ["partsRequests"], titleKeys: ["woNumber"]},
  ]},
  {id: "breakdowns", label: "Breakdowns", collections: [
    {name: "breakdown_tickets", label: "Breakdown tickets", titleKeys: ["ticketNumber"]},
    {name: "rca", label: "Root cause analyses", titleKeys: ["problem"]},
  ]},
  {id: "contractors", label: "Contractors", collections: [
    {name: "contractors", label: "Contractors", subcollections: ["technicians", "documents"], titleKeys: ["companyName", "name"]},
    {name: "contractorJobs", label: "Contractor jobs", titleKeys: ["jobNumber", "title"]},
  ]},
  {id: "machines", label: "Machines", collections: [
    {name: "machines", label: "Machine register", titleKeys: ["name"]},
    {name: "machineOutsourcedMaintenance", label: "Outsourced maintenance", titleKeys: ["title", "description"]},
  ]},
  {id: "pmSchedules", label: "PM schedules", collections: [
    {name: "pm_schedules", label: "PM schedules", titleKeys: ["title", "name"]},
    {name: "pm_history", label: "PM history", titleKeys: ["title", "scheduleName"]},
  ]},
  {id: "safety", label: "Safety cases", collections: [
    {name: "safety_cases", label: "Safety cases", titleKeys: ["caseNumber", "title"]},
    {name: "work_permits", label: "Work permits", titleKeys: ["permitNumber", "title"]},
    {name: "safetyCertificates", label: "Safety certificates", titleKeys: ["certificateNumber", "holderName"]},
  ]},
  {id: "inventory", label: "Inventory", collections: [
    {name: "inventoryParts", label: "Parts", titleKeys: ["partNumber", "name"]},
    {name: "suppliers", label: "Suppliers", titleKeys: ["name"]},
    {name: "stockMovements", label: "Stock movements", titleKeys: ["partName", "type"]},
  ]},
  {id: "purchaseOrders", label: "Purchase orders", collections: [
    {name: "purchaseOrders", label: "Purchase orders", titleKeys: ["poNumber"]},
  ]},
  {id: "audits", label: "Audits", collections: [
    {name: "audit_sessions", label: "Audits", pathKeyed: "sessions", titleKeys: ["title", "templateName", "category"]},
    {name: "audit_templates", label: "Audit templates", pathKeyed: "templates", titleKeys: ["name", "title"]},
  ]},
  {id: "evaluations", label: "Evaluations", collections: [
    {name: "evaluations", label: "Evaluations", titleKeys: ["title", "name"]},
    {name: "evaluation_templates", label: "Evaluation templates", titleKeys: ["name", "title"]},
    {name: "evaluation_sessions", label: "Evaluation sessions", titleKeys: ["title", "name"]},
  ]},
];

/** Fields that carry a document's company. */
const TENANT_FIELDS = ["companyId", "siteId", "tenantId"];
/** Storage roots keyed by company id / by plant id (see storage.rules). */
const STORAGE_COMPANY_ROOTS = ["companies", "workorders", "breakdowns", "evaluation_attachments", "safetyTrainingSubmissions", "triage"];
const STORAGE_PLANT_ROOTS = ["audit_attachments", "audit_reports", "audits", "kaizen"];

/** Firestore Timestamp / DocumentReference / nested values -> plain JSON. */
function serialize(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    if (typeof value.toDate === "function") {
      const d = value.toDate();
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (typeof value.path === "string" && typeof value.id === "string") return value.path; // DocumentReference
    if (Array.isArray(value)) return value.map(serialize);
    if (typeof value.latitude === "number" && typeof value.longitude === "number") {
      return {latitude: value.latitude, longitude: value.longitude};
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = serialize(v);
    }
    return out;
  }
  if (typeof value === "function" || typeof value === "symbol") return null;
  return value;
}

/** The Storage object path a string points at in `bucketName`, or null. */
function storagePathFromString(value, bucketName) {
  if (typeof value !== "string" || value.length < 6 || value.length > 2048) return null;
  let path = null;
  const firebaseUrl = value.match(/^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?#]+)/);
  const gcsUrl = value.match(/^https:\/\/storage\.googleapis\.com\/([^/]+)\/([^?#]+)/);
  const gsUrl = value.match(/^gs:\/\/([^/]+)\/(.+)$/);
  const match = firebaseUrl || gcsUrl || gsUrl;
  if (match) {
    if (bucketName && match[1] !== bucketName) return null; // another bucket
    path = match[2];
  } else if (/^(?:[A-Za-z0-9_-]+)\/[A-Za-z0-9_-]+\/[^\s]+\.[A-Za-z0-9]{2,5}$/.test(value)) {
    path = value; // a bare storage path saved on the record
  }
  if (path === null) return null;
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  return path;
}

/**
 * A path may be exported only when its first folder is a known root and the
 * second is THIS company (or one of its plants for the plant-keyed roots).
 */
function isAllowedStoragePath(path, companyId, plantIds = []) {
  if (typeof path !== "string" || !path || path.includes("..") || path.startsWith("/") || path.includes("\\")) return false;
  const parts = path.split("/");
  if (parts.length < 3 || parts.some((p) => p === "" || p === ".")) return false;
  const [root, key] = parts;
  if (STORAGE_COMPANY_ROOTS.includes(root)) return key === companyId;
  if (STORAGE_PLANT_ROOTS.includes(root)) return key === companyId || plantIds.includes(key);
  return false;
}

/** Every Storage file referenced anywhere in `value`: {allowed:[path], refused:[path]}. */
function collectAttachments(value, {bucketName, companyId, plantIds}) {
  const allowed = new Set();
  const refused = new Set();
  const walk = (v) => {
    if (typeof v === "string") {
      const path = storagePathFromString(v, bucketName);
      if (path === null) return;
      (isAllowedStoragePath(path, companyId, plantIds) ? allowed : refused).add(path);
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === "object") {
      Object.values(v).forEach(walk);
    }
  };
  walk(value);
  return {allowed: [...allowed], refused: [...refused]};
}

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** A file / folder name that is safe on every OS (Windows included) and keeps readable letters. */
function safeName(value, fallback = "item", max = 80) {
  // Letters, combining marks (Sinhala / Tamil vowel signs) and the joiners that
  // sit between them are kept; everything else becomes "_".
  let n = Array.from(String(value ?? ""))
      .map((ch) => (/[\p{L}\p{M}\p{N}._ ()+@-]/u.test(ch) || ch === "\u200C" || ch === "\u200D" ? ch : "_"))
      .join("").replace(/\s+/g, " ").trim();
  n = n.replace(/^[. ]+|[. ]+$/g, "").slice(0, max).replace(/[. ]+$/g, "");
  if (!n) n = fallback;
  return RESERVED.test(n.split(".")[0]) ? `_${n}` : n;
}

/**
 * Gives each record of a collection its own folder named after its number /
 * title — "Breakdowns/Breakdown tickets/BD-0012" — and each of its attachments
 * an entry inside it. Two records with the same title get a short id suffix.
 * Mutates the records: `folder`, and `attachments[].file`.
 */
function assignFolders(section, col, list) {
  const base = [safeName(section.label)];
  if (section.collections.length > 1) base.push(safeName(col.label || col.name));
  const used = new Set();
  for (const r of list) {
    let name = safeName(r.title, r.id);
    if (used.has(name.toLowerCase())) name = `${name} (${safeName(r.id, "x", 8)})`;
    used.add(name.toLowerCase());
    r.folder = [...base, name].join("/");
    const taken = new Set(["details.txt", "details.json"]);
    for (const a of r.attachments) {
      let file = safeName(a.name, "file", 120);
      if (taken.has(file.toLowerCase())) {
        const dot = file.lastIndexOf(".");
        const stem = dot > 0 ? file.slice(0, dot) : file;
        const ext = dot > 0 ? file.slice(dot) : "";
        let i = 2;
        while (taken.has(`${stem} (${i})${ext}`.toLowerCase())) i++;
        file = `${stem} (${i})${ext}`;
      }
      taken.add(file.toLowerCase());
      a.file = `${r.folder}/${file}`;
    }
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const TECH_KEYS = /^(companyId|siteId|tenantId|plantId|machinePlantId|createdBy|updatedBy|closedBy|uid|userId|id)$/;

function humanizeKey(key) {
  const k = String(key).replace(/(Ids|Id|Uid)$/, "").replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim().toLowerCase();
  return k ? k.charAt(0).toUpperCase() + k.slice(1) : String(key);
}

const STORAGE_URL = /^https:\/\/(firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/|storage\.googleapis\.com\/[^/]+\/)([^?#]+)/;

/** A storage download link as just its file name (the file itself is in the record's folder). */
function fileNameFromUrl(v) {
  const m = STORAGE_URL.exec(v);
  if (!m) return null;
  try {
    return decodeURIComponent(m[2]).split("/").pop().replace(/^\d{10,}_/, "");
  } catch {
    return null;
  }
}

function textValue(v, indent, lookup) {
  const pad = "  ".repeat(indent);
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") {
    if (ISO_DATE.test(v)) return v.replace("T", " ").replace(/:\d{2}(\.\d+)?Z$/, " UTC");
    const file = fileNameFromUrl(v);
    if (file) return `${file} (file saved in this folder)`;
    if (lookup && lookup.has(v)) return lookup.get(v);
    return v;
  }
  if (typeof v !== "object") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return null;
    if (v.every((x) => x === null || typeof x !== "object")) return v.map((x) => textValue(x, 0, lookup)).filter(Boolean).join(", ");
    return "\n" + v.map((x, i) => `${pad}  ${i + 1}.${textBlock(x, indent + 2, lookup).replace(/^\s+/, " ")}`).join("\n");
  }
  const body = textBlock(v, indent + 1, lookup);
  return body ? "\n" + body : null;
}

function textBlock(obj, indent, lookup) {
  if (obj === null || typeof obj !== "object") return String(obj ?? "");
  const pad = "  ".repeat(indent);
  return Object.keys(obj).sort().map((k) => {
    const t = textValue(obj[k], indent, lookup);
    if (t === null) return null;
    return t.startsWith("\n") ? `${pad}${humanizeKey(k)}:${t}` : `${pad}${humanizeKey(k)}: ${t}`;
  }).filter(Boolean).join("\n");
}

/** details.txt of one record: readable labels, dates and Yes/No, ids shown as names, technical ids last. */
function recordToText(record, collectionLabel, lookup) {
  const main = {};
  const tech = {};
  for (const [k, v] of Object.entries(record.data)) (TECH_KEYS.test(k) ? tech : main)[k] = v;
  const lines = [`${collectionLabel} — ${record.title}`, `Record id: ${record.id}`, "", textBlock(main, 0, lookup)];
  for (const [name, list] of Object.entries(record.sub || {})) {
    lines.push("", `${humanizeKey(name)} (${list.length})`);
    list.forEach((item, i) => lines.push(`  ${i + 1}.${textBlock(item, 2, lookup).replace(/^\s+/, " ")}`));
  }
  const t = textBlock(tech, 0, lookup);
  if (t) lines.push("", "Technical details", t);
  return lines.join("\n") + "\n";
}

function recordTitle(data, titleKeys, fallback) {
  for (const key of titleKeys || []) {
    const v = data[key];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 120);
    if (typeof v === "number") return String(v);
  }
  return fallback;
}

function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  // Neutralise spreadsheet formulas in exported text.
  const safe = /^[=+\-@]/.test(s) && typeof v === "string" ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, "\"\"")}"` : safe;
}

/** One CSV per collection: id + every top-level field, nested values as JSON. */
function toCsv(records) {
  const columns = ["id"];
  for (const r of records) for (const k of Object.keys(r.data)) if (!columns.includes(k)) columns.push(k);
  const lines = [columns.map(csvCell).join(",")];
  for (const r of records) {
    lines.push(columns.map((c) => csvCell(c === "id" ? r.id : r.data[c])).join(","));
  }
  return lines.join("\r\n");
}

/** JSON that is safe inside a <script> element. */
function scriptJson(value) {
  return JSON.stringify(value)
      .replace(/</g, "\\u003c")
      .replace(new RegExp("\\u2028", "g"), "\\u2028")
      .replace(new RegExp("\\u2029", "g"), "\\u2029");
}

const fs = require("fs");
const path = require("path");
const VIEWER_JS = fs.readFileSync(path.join(__dirname, "viewerClient.js"), "utf8");

const VIEWER_CSS = `
:root{color-scheme:light dark;--bg:#fff;--fg:#0f172a;--mut:#64748b;--bd:#e2e8f0;--acc:#2563eb;--sel:#eff6ff;--card:#f8fafc}
@media (prefers-color-scheme:dark){:root{--bg:#0f1e35;--fg:#f0f4f8;--mut:#8ba3bf;--bd:#1e3a5f;--acc:#60a5fa;--sel:#13294a;--card:#112543}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,"Segoe UI",sans-serif}
header{padding:14px 18px;border-bottom:1px solid var(--bd)}h1{margin:0;font-size:20px}h2{margin:0 0 4px;font-size:20px}h3{margin:18px 0 6px;font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut)}
.muted{color:var(--mut)}.warn{color:#b45309}.text{white-space:pre-wrap;word-break:break-word}
main{display:grid;grid-template-columns:230px 330px 1fr;min-height:calc(100vh - 78px)}
@media (max-width:900px){main{grid-template-columns:1fr}}
#nav,#listwrap,#detail{padding:12px;border-right:1px solid var(--bd);overflow:auto;max-height:calc(100vh - 78px)}
.sec{margin:14px 0 4px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut)}
.col,.row{display:block;width:100%;text-align:left;background:none;border:0;color:inherit;padding:7px 9px;border-radius:7px;cursor:pointer;font:inherit}
.col.on,.row.on{background:var(--sel);color:var(--acc)}.col:hover,.row:hover{background:var(--sel)}
#search{width:100%;padding:9px;margin:0 0 8px;border:1px solid var(--bd);border-radius:7px;background:transparent;color:inherit;font:inherit}
table{border-collapse:collapse;width:100%}th,td{border-top:1px solid var(--bd);padding:7px 9px;vertical-align:top;text-align:left}
table.kv>tbody>tr>th,table.kv>tr>th{width:32%;color:var(--mut);font-weight:500}
table.kv table{margin:0}table.grid{border:1px solid var(--bd);margin:2px 0}table.grid th{background:var(--card);color:var(--mut);font-weight:600;font-size:13px}
pre{white-space:pre-wrap;word-break:break-word;margin:0;font-size:12px}details{margin-top:18px}summary{cursor:pointer}
.atts{display:flex;flex-wrap:wrap;gap:12px}.att{width:190px;padding:8px;border:1px solid var(--bd);border-radius:8px;background:var(--card)}.att img{display:block;width:100%;max-height:140px;object-fit:cover;border-radius:6px;margin-bottom:6px}.att a{color:var(--acc);word-break:break-all}
a{color:var(--acc)}
`;

/** index.html: the viewer, its styles and ALL the data in one file (works from a double-click, even from inside an unzipped folder). */
function buildViewerEntries({company, exportedAt, sections, datasets}) {
  const manifest = {
    company,
    exportedAt,
    sections: sections.map((s) => ({
      id: s.id,
      label: s.label,
      collections: s.collections.map((c) => ({name: c.name, label: c.label || c.name, count: (datasets[s.id].collections[c.name] || []).length})),
    })),
  };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;"}[c]));
  return [{
    name: "index.html",
    content: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(company)} — data export</title><style>${VIEWER_CSS}</style></head>
<body><header><h1 id="title"></h1><div id="sub" class="muted"></div></header>
<main><nav id="nav"></nav><section id="listwrap"><input id="search" placeholder="Search records…" /><div id="list"></div></section><article id="detail"></article></main>
<script>window.FC_MANIFEST=${scriptJson(manifest)};window.FC_DATA=${scriptJson(datasets)};</script>
<script>${VIEWER_JS.replace(/<\/script/gi, "<\\/script")}</script></body></html>
`,
  }];
}

/** A ZIP part stops growing at this many bytes (sum of the files in it, shared files counted per copy). */
const PART_MAX_BYTES = 1024 * 1024 * 1024;
/** ...or at this many files, so a part of tiny files still finishes well inside one run. */
const PART_MAX_FILES = 2000;

/**
 * Splits the files of an export into consecutive ZIP parts so no single ZIP
 * (or single run of the export function) has to carry everything. A file is
 * never split; a file bigger than the limit gets a part of its own.
 *
 * @param {{size: number, names: string[]}[]} entries files in packing order
 * @param {number} maxBytes size limit of one part
 * @param {number} maxFiles file-count limit of one part
 * @return {{start: number, end: number, bytes: number}[]} index ranges [start, end) — always at least one part
 */
function planParts(entries, maxBytes = PART_MAX_BYTES, maxFiles = PART_MAX_FILES) {
  const parts = [];
  let start = 0;
  let bytes = 0;
  let files = 0;
  entries.forEach((e, i) => {
    const weight = (e.size || 0) * Math.max(1, (e.names || []).length);
    const count = Math.max(1, (e.names || []).length);
    if (i > start && (bytes + weight > maxBytes || files + count > maxFiles)) {
      parts.push({start, end: i, bytes});
      start = i;
      bytes = 0;
      files = 0;
    }
    bytes += weight;
    files += count;
  });
  parts.push({start, end: entries.length, bytes});
  return parts;
}

module.exports = {
  PART_MAX_BYTES,
  PART_MAX_FILES,
  planParts,
  SECTIONS,
  TENANT_FIELDS,
  STORAGE_COMPANY_ROOTS,
  STORAGE_PLANT_ROOTS,
  serialize,
  storagePathFromString,
  isAllowedStoragePath,
  collectAttachments,
  safeName,
  assignFolders,
  recordToText,
  humanizeKey,
  recordTitle,
  toCsv,
  scriptJson,
  buildViewerEntries,
};
