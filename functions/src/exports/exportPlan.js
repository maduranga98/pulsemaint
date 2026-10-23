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
    {name: "workOrders", subcollections: ["partsRequests"], titleKeys: ["woNumber"]},
  ]},
  {id: "breakdowns", label: "Breakdowns", collections: [
    {name: "breakdown_tickets", titleKeys: ["ticketNumber"]},
    {name: "rca", titleKeys: ["problem"]},
  ]},
  {id: "contractors", label: "Contractors", collections: [
    {name: "contractors", subcollections: ["technicians", "documents"], titleKeys: ["companyName", "name"]},
    {name: "contractorJobs", titleKeys: ["jobNumber", "title"]},
  ]},
  {id: "machines", label: "Machines", collections: [
    {name: "machines", titleKeys: ["name"]},
    {name: "machineOutsourcedMaintenance", titleKeys: ["title", "description"]},
  ]},
  {id: "pmSchedules", label: "PM schedules", collections: [
    {name: "pm_schedules", titleKeys: ["title", "name"]},
    {name: "pm_history", titleKeys: ["title", "scheduleName"]},
  ]},
  {id: "safety", label: "Safety cases", collections: [
    {name: "safety_cases", titleKeys: ["caseNumber", "title"]},
    {name: "work_permits", titleKeys: ["permitNumber", "title"]},
    {name: "safetyCertificates", titleKeys: ["certificateNumber", "holderName"]},
  ]},
  {id: "inventory", label: "Inventory", collections: [
    {name: "inventoryParts", titleKeys: ["partNumber", "name"]},
    {name: "suppliers", titleKeys: ["name"]},
    {name: "stockMovements", titleKeys: ["partName", "type"]},
  ]},
  {id: "purchaseOrders", label: "Purchase orders", collections: [
    {name: "purchaseOrders", titleKeys: ["poNumber"]},
  ]},
  {id: "audits", label: "Audits", collections: [
    {name: "audit_sessions", pathKeyed: "sessions", titleKeys: ["title", "templateName", "category"]},
    {name: "audit_templates", pathKeyed: "templates", titleKeys: ["name", "title"]},
  ]},
  {id: "evaluations", label: "Evaluations", collections: [
    {name: "evaluations", titleKeys: ["title", "name"]},
    {name: "evaluation_templates", titleKeys: ["name", "title"]},
    {name: "evaluation_sessions", titleKeys: ["title", "name"]},
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

/** The ZIP entry a Storage path is saved as (keeps the folder layout, always relative and safe). */
function attachmentEntryName(path) {
  return `files/${path.split("/").map((p) => p.replace(/[^\p{L}\p{N}._ ()+@-]/gu, "_")).join("/")}`;
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

const VIEWER_JS = `
(function () {
  var data = window.FC_DATA || {};
  var manifest = window.FC_MANIFEST || { company: "", exportedAt: "", sections: [] };
  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  var state = { section: null, collection: null, query: "", selected: null };
  var IMAGE = /\\.(png|jpe?g|gif|webp|bmp)$/i;

  $("title").textContent = manifest.company + " — data export";
  $("sub").textContent = "Exported " + manifest.exportedAt + ". Works offline: unzip the folder and open this file.";

  function sectionData(id) { return data[id] || { collections: {} }; }
  function currentRecords() {
    var s = sectionData(state.section); var list = (s.collections && s.collections[state.collection]) || [];
    var q = state.query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(function (r) { return (r.title + " " + r.id + " " + JSON.stringify(r.data)).toLowerCase().indexOf(q) !== -1; });
  }
  function renderNav() {
    var nav = $("nav"); nav.textContent = "";
    manifest.sections.forEach(function (s) {
      var h = el("div", "sec", s.label); nav.appendChild(h);
      s.collections.forEach(function (c) {
        var b = el("button", "col" + (state.section === s.id && state.collection === c.name ? " on" : ""), c.name + " (" + c.count + ")");
        b.onclick = function () { state.section = s.id; state.collection = c.name; state.selected = null; render(); };
        nav.appendChild(b);
      });
    });
  }
  function renderList() {
    var box = $("list"); box.textContent = "";
    if (!state.collection) { box.appendChild(el("p", "muted", "Choose a collection on the left.")); return; }
    var rows = currentRecords();
    box.appendChild(el("p", "muted", rows.length + " record(s)"));
    rows.slice(0, 500).forEach(function (r) {
      var b = el("button", "row" + (state.selected === r ? " on" : ""));
      b.appendChild(el("strong", null, r.title));
      b.appendChild(el("span", "muted", " " + r.id));
      b.onclick = function () { state.selected = r; render(); };
      box.appendChild(b);
    });
    if (rows.length > 500) box.appendChild(el("p", "muted", "Showing the first 500 — use search to narrow down."));
  }
  function value(v) {
    if (v === null || v === undefined || v === "") return el("span", "muted", "—");
    if (typeof v === "object") { var pre = el("pre", null, JSON.stringify(v, null, 2)); return pre; }
    return el("span", null, String(v));
  }
  function renderDetail() {
    var box = $("detail"); box.textContent = "";
    var r = state.selected;
    if (!r) { box.appendChild(el("p", "muted", "Select a record to see everything saved on it, with its attachments.")); return; }
    box.appendChild(el("h2", null, r.title));
    box.appendChild(el("p", "muted", state.collection + " / " + r.id));
    if (r.attachments && r.attachments.length) {
      box.appendChild(el("h3", null, "Attachments (" + r.attachments.length + ")"));
      var wrap = el("div", "atts");
      r.attachments.forEach(function (a) {
        var item = el("div", "att");
        if (IMAGE.test(a.file)) { var img = el("img"); img.src = a.file; img.alt = a.name; img.loading = "lazy"; item.appendChild(img); }
        var link = el("a", null, a.name); link.href = a.file; link.target = "_blank"; link.rel = "noopener";
        item.appendChild(link); wrap.appendChild(item);
      });
      box.appendChild(wrap);
    }
    if (r.missing && r.missing.length) box.appendChild(el("p", "warn", r.missing.length + " attachment(s) could not be included — see _export-notes.txt"));
    box.appendChild(el("h3", null, "Details"));
    var table = el("table");
    Object.keys(r.data).sort().forEach(function (k) {
      var tr = el("tr"); tr.appendChild(el("th", null, k)); var td = el("td"); td.appendChild(value(r.data[k])); tr.appendChild(td); table.appendChild(tr);
    });
    box.appendChild(table);
    if (r.sub) Object.keys(r.sub).forEach(function (name) {
      box.appendChild(el("h3", null, name + " (" + r.sub[name].length + ")"));
      r.sub[name].forEach(function (s) { box.appendChild(el("pre", null, JSON.stringify(s, null, 2))); });
    });
  }
  function render() { renderNav(); renderList(); renderDetail(); }
  $("search").oninput = function (e) { state.query = e.target.value; renderList(); };
  var first = manifest.sections.filter(function (s) { return s.collections.some(function (c) { return c.count > 0; }); })[0];
  if (first) { state.section = first.id; state.collection = first.collections.filter(function (c) { return c.count > 0; })[0].name; }
  render();
})();
`;

const VIEWER_CSS = `
:root{color-scheme:light dark;--bg:#fff;--fg:#0f172a;--mut:#64748b;--bd:#e2e8f0;--acc:#2563eb;--sel:#eff6ff}
@media (prefers-color-scheme:dark){:root{--bg:#0f1e35;--fg:#f0f4f8;--mut:#8ba3bf;--bd:#1e3a5f;--acc:#60a5fa;--sel:#13294a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif}
header{padding:12px 16px;border-bottom:1px solid var(--bd)}h1{margin:0;font-size:18px}.muted{color:var(--mut)}.warn{color:#b45309}
main{display:grid;grid-template-columns:240px 320px 1fr;min-height:calc(100vh - 70px)}
@media (max-width:900px){main{grid-template-columns:1fr}}
#nav,#list,#detail{padding:12px;border-right:1px solid var(--bd);overflow:auto;max-height:calc(100vh - 70px)}
.sec{margin:12px 0 4px;font-weight:600}.col,.row{display:block;width:100%;text-align:left;background:none;border:0;color:inherit;padding:6px 8px;border-radius:6px;cursor:pointer;font:inherit}
.col.on,.row.on{background:var(--sel);color:var(--acc)}.col:hover,.row:hover{background:var(--sel)}
#search{width:100%;padding:8px;margin:0 0 8px;border:1px solid var(--bd);border-radius:6px;background:transparent;color:inherit}
table{border-collapse:collapse;width:100%}th,td{border-top:1px solid var(--bd);padding:6px 8px;vertical-align:top;text-align:left}th{width:30%;color:var(--mut);font-weight:500}
pre{white-space:pre-wrap;word-break:break-word;margin:0;font-size:12px}
.atts{display:flex;flex-wrap:wrap;gap:12px}.att{max-width:180px}.att img{display:block;max-width:180px;max-height:130px;border:1px solid var(--bd);border-radius:6px}.att a{color:var(--acc);word-break:break-all}
`;

/** index.html + data scripts for the offline viewer. `datasets` = {sectionId: {label, collections:{name:[record]}}}. */
function buildViewerEntries({company, exportedAt, sections, datasets}) {
  const manifest = {
    company,
    exportedAt,
    sections: sections.map((s) => ({
      id: s.id,
      label: s.label,
      collections: s.collections.map((c) => ({name: c.name, count: (datasets[s.id].collections[c.name] || []).length})),
    })),
  };
  const entries = [{name: "data/manifest.js", content: `window.FC_MANIFEST = ${scriptJson(manifest)};\n`}];
  for (const s of sections) {
    entries.push({
      name: `data/${s.id}.js`,
      content: `window.FC_DATA = window.FC_DATA || {};\nwindow.FC_DATA[${JSON.stringify(s.id)}] = ${scriptJson(datasets[s.id])};\n`,
    });
  }
  const scripts = ["data/manifest.js", ...sections.map((s) => `data/${s.id}.js`)]
      .map((f) => `<script src="${f}"></script>`).join("\n");
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;"}[c]));
  entries.push({
    name: "index.html",
    content: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(company)} — data export</title><style>${VIEWER_CSS}</style></head>
<body><header><h1 id="title"></h1><div id="sub" class="muted"></div></header>
<main><nav id="nav"></nav><section id="listwrap"><input id="search" placeholder="Search records…" /><div id="list"></div></section><article id="detail"></article></main>
${scripts}
<script src="viewer.js"></script></body></html>
`,
  });
  entries.push({name: "viewer.js", content: VIEWER_JS});
  return entries;
}

module.exports = {
  SECTIONS,
  TENANT_FIELDS,
  STORAGE_COMPANY_ROOTS,
  STORAGE_PLANT_ROOTS,
  serialize,
  storagePathFromString,
  isAllowedStoragePath,
  collectAttachments,
  attachmentEntryName,
  recordTitle,
  toCsv,
  scriptJson,
  buildViewerEntries,
};
