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

/**
 * What goes into the ZIP. Deliberately narrow: work orders, breakdowns, safety
 * cases, shift handovers, work permits, PM history and stock movements. Machines, users, inventory,
 * contractors, analytics, audits, evaluations, reports, MOE and plants are NOT
 * exported. `layout` decides how a collection's records are laid out (see
 * layoutSection).
 */
const SECTIONS = [
  {id: "workOrders", label: "Work orders", collections: [
    {name: "workOrders", label: "Work orders", layout: "workOrder", subcollections: ["partsRequests"], titleKeys: ["woNumber"]},
  ]},
  {id: "breakdowns", label: "Breakdowns", collections: [
    {name: "breakdown_tickets", label: "Breakdown tickets", layout: "breakdown", titleKeys: ["ticketNumber"]},
  ]},
  {id: "safety", label: "Safety cases", collections: [
    {name: "safety_cases", label: "Safety cases", layout: "textOnly", titleKeys: ["caseNumber", "title"]},
  ]},
  {id: "workPermits", label: "Work permits", collections: [
    {name: "work_permits", label: "Work permits", layout: "permit", titleKeys: ["permitNumber", "title"]},
  ]},
  {id: "handovers", label: "Shift handovers", collections: [
    {name: "shift_handovers", label: "Shift handovers", layout: "sheet", titleKeys: ["shiftName"]},
  ]},
  {id: "pmHistory", label: "PM history", collections: [
    {name: "pm_history", label: "PM history", layout: "record", titleKeys: ["woNumber", "scheduleName", "machineName"]},
  ]},
  {id: "stockMovements", label: "Stock movements", collections: [
    {name: "stockMovements", label: "Stock movements", layout: "sheet", titleKeys: ["partName", "type"]},
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

const ACRONYMS = {wo: "WO", wos: "WOs", pm: "PM", moe: "MOE", rca: "RCA", loto: "LOTO", ppe: "PPE", sla: "SLA", qr: "QR", id: "ID", ptw: "PTW", bd: "BD", po: "PO", ehs: "EHS", url: "URL"};

/** "qr_scan" / "woNumber" / "CONTRACTOR" -> "QR scan" / "WO number" / "Contractor". */
function humanizeWords(text) {
  const words = String(text).replace(/[_]+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return String(text);
  const out = words.map((w) => ACRONYMS[w] || w);
  if (!ACRONYMS[words[0]]) out[0] = out[0].charAt(0).toUpperCase() + out[0].slice(1);
  return out.join(" ");
}

function humanizeKey(key) {
  return humanizeWords(String(key).replace(/(Ids|Id|Uid)$/, "")) || String(key);
}

/** Fields whose value is a code ("low", "qr_scan", "CONTRACTOR", "safety_officer") that reads better as words. */
const ENUM_KEY = /(status|severity|types?|source|priority|category|roles?|kinds?|scope|state|mode|frequency|outcome|result|method)$/i;
const ENUM_VALUE = /^[A-Za-z][A-Za-z0-9]*(_[A-Za-z0-9]+)*$/;

function humanizeValue(key, value) {
  if (!key || !ENUM_KEY.test(String(key)) || !ENUM_VALUE.test(value)) return value;
  const mixed = /[a-z]/.test(value) && /[A-Z]/.test(value);
  if (mixed) return value; // camelCase / ids, not an enum code
  return humanizeWords(value);
}

/** A Firestore / Auth style id that no name was found for — meaningless to a reader, so it is left out. */
function isOpaqueId(v) {
  return /^[A-Za-z0-9_-]{20,}$/.test(v) && (/[0-9]/.test(v) || (/[a-z]/.test(v) && /[A-Z]/.test(v)));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
/** Plain-language ids kept under "Other details" at the bottom of a record (shown as names). */
const TECH_KEYS = /^(companyId|siteId|tenantId|plantId|machinePlantId|createdBy|updatedBy|closedBy|uid|userId)$/;

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

function textValue(v, indent, lookup, key) {
  const pad = "  ".repeat(indent);
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") {
    if (ISO_DATE.test(v)) return v.replace("T", " ").replace(/:\d{2}(\.\d+)?Z$/, " UTC");
    const file = fileNameFromUrl(v);
    if (file) return `${file} (file saved in this folder)`;
    if (lookup && lookup.has(v)) return lookup.get(v);
    if (isOpaqueId(v)) return null;
    return humanizeValue(key, v);
  }
  if (typeof v !== "object") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return null;
    if (v.every((x) => x === null || typeof x !== "object")) return v.map((x) => textValue(x, 0, lookup, key)).filter(Boolean).join(", ") || null;
    return "\n" + v.map((x, i) => `${pad}  ${i + 1}.${textBlock(x, indent + 2, lookup).replace(/^\s+/, " ")}`).join("\n");
  }
  const body = textBlock(v, indent + 1, lookup);
  return body ? "\n" + body : null;
}

function textBlock(obj, indent, lookup) {
  if (obj === null || typeof obj !== "object") return String(obj ?? "");
  const pad = "  ".repeat(indent);
  return Object.keys(obj).sort().map((k) => {
    if (k === "id") return null;
    const t = textValue(obj[k], indent, lookup, k);
    if (t === null) return null;
    return t.startsWith("\n") ? `${pad}${humanizeKey(k)}:${t}` : `${pad}${humanizeKey(k)}: ${t}`;
  }).filter(Boolean).join("\n");
}

/** The readable text of one record: labels, dates, Yes/No, and every id shown as a name. */
function recordToText(record, collectionLabel, lookup) {
  const main = {};
  const other = {};
  for (const [k, v] of Object.entries(record.data)) (TECH_KEYS.test(k) ? other : main)[k] = v;
  const lines = [`${collectionLabel} — ${record.title}`, "", textBlock(main, 0, lookup)];
  for (const [name, list] of Object.entries(record.sub || {})) {
    lines.push("", `${humanizeKey(name)} (${list.length})`);
    list.forEach((item, i) => lines.push(`  ${i + 1}.${textBlock(item, 2, lookup).replace(/^\s+/, " ")}`));
  }
  const t = textBlock(other, 0, lookup);
  if (t) lines.push("", "Other details", t);
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

/**
 * Lays out the records of one collection (mutates them): `folder` (where its
 * files go, or null), `textPath` (the .txt it is written to — records with the
 * same path share one file) and `attachments[].file`. Text-only layouts drop
 * the attachments. `ctx.woNumberById` / `ctx.woNumberByTicket` link
 * breakdowns and permits to their work order number.
 */
function layoutSection(col, list, ctx) {
  const usedNames = ctx.usedNames || (ctx.usedNames = new Map());
  const takenFiles = ctx.takenFiles || (ctx.takenFiles = new Map());
  const unique = (parent, wanted, id) => {
    const used = usedNames.get(parent) || new Set();
    usedNames.set(parent, used);
    let name = safeName(wanted, id);
    if (used.has(name.toLowerCase())) name = `${name} (${safeName(id, "x", 8)})`;
    used.add(name.toLowerCase());
    return name;
  };
  const place = (r, folder) => {
    const taken = takenFiles.get(folder) || new Set(["details.txt", "breakdown tickets.txt"]);
    takenFiles.set(folder, taken);
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
      a.file = `${folder}/${file}`;
    }
  };
  const when = (r) => String(r.data.reportedAt || r.data.createdAt || "");
  const sorted = [...list].sort((a, b) => when(a).localeCompare(when(b)));

  for (const r of sorted) {
    r.folder = null;
    r.textPath = null;
    if (col.layout === "workOrder") {
      // Work orders/<WO type>/<WO number>/
      const type = r.data.woType ? humanizeValue("woType", String(r.data.woType)) : "Other";
      const parent = `Work orders/${safeName(type, "Other")}`;
      r.folder = `${parent}/${unique(parent, r.title, r.id)}`;
      r.textPath = `${r.folder}/details.txt`;
      place(r, r.folder);
    } else if (col.layout === "breakdown") {
      const low = String(r.data.severity || "").toLowerCase() === "low";
      const woNumber = ctx.woNumberById.get(r.data.linkedWOId) || ctx.woNumberByTicket.get(r.id) || null;
      if (low) {
        // Low severity: one folder per ticket (text + files).
        const parent = "Breakdowns/Low severity";
        r.folder = `${parent}/${unique(parent, r.title, r.id)}`;
        r.textPath = `${r.folder}/details.txt`;
      } else if (woNumber) {
        // Other severities: one folder per work order, all its tickets in one text file.
        const groups = ctx.groupFolders || (ctx.groupFolders = new Map());
        if (!groups.has(`bd:${woNumber}`)) groups.set(`bd:${woNumber}`, `Breakdowns/${unique("Breakdowns", woNumber, woNumber)}`);
        r.folder = groups.get(`bd:${woNumber}`);
        r.textPath = `${r.folder}/breakdown tickets.txt`;
      } else {
        const parent = "Breakdowns/Without work order";
        r.folder = `${parent}/${unique(parent, r.title, r.id)}`;
        r.textPath = `${r.folder}/details.txt`;
      }
      place(r, r.folder);
    } else if (col.layout === "textOnly") {
      r.attachments = [];
      r.textPath = `Safety cases/${unique("Safety cases", r.title, r.id)}.txt`;
    } else if (col.layout === "permit") {
      r.attachments = [];
      const woNumber = r.data.workOrderNumber || ctx.woNumberById.get(r.data.workOrderId) || null;
      const groups = ctx.groupFolders || (ctx.groupFolders = new Map());
      const gk = `wp:${woNumber || r.id}`;
      if (!groups.has(gk)) groups.set(gk, `Work permits/${unique("Work permits", woNumber || r.title, r.id)}.txt`);
      r.textPath = groups.get(gk);
    } else if (col.layout === "record") {
      // <Section>/<record>/ — details.txt and the record's files
      const parent = safeName(col.label);
      r.folder = `${parent}/${unique(parent, r.title, r.id)}`;
      r.textPath = `${r.folder}/details.txt`;
      place(r, r.folder);
    } else if (col.layout === "sheet") {
      r.attachments = [];
    }
  }
  // Callers keep their own order; `sorted` only fixed the order inside shared files.
  list.splice(0, list.length, ...sorted);
}

function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Neutralise spreadsheet formulas in exported text.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, "\"\"")}"` : safe;
}

/**
 * One spreadsheet-ready CSV (UTF-8 with a byte-order mark, so Excel reads
 * Sinhala / Tamil correctly): readable column titles, ids shown as names,
 * lists and sub-records written out as text. Columns with no data are left out.
 */
function toSheetCsv(records, lookup) {
  const first = ["shiftDate", "shiftName"];
  const keys = [];
  for (const r of records) for (const k of Object.keys(r.data)) if (k !== "id" && !keys.includes(k)) keys.push(k);
  keys.sort((a, b) => {
    const ia = first.indexOf(a);
    const ib = first.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });
  const rows = records.map((r) => keys.map((k) => {
    const t = textValue(r.data[k], 0, lookup, k);
    return t === null ? "" : t.replace(/^\n/, "");
  }));
  const used = keys.map((_, i) => rows.some((row) => row[i] !== ""));
  const header = keys.filter((_, i) => used[i]).map((k) => csvCell(humanizeKey(k)));
  const lines = [header.join(",")];
  for (const row of rows) lines.push(row.filter((_, i) => used[i]).map(csvCell).join(","));
  return "﻿" + lines.join("\r\n");
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
  layoutSection,
  recordToText,
  humanizeKey,
  humanizeValue,
  recordTitle,
  toSheetCsv,
};
