const {
  SECTIONS,
  TENANT_FIELDS,
  serialize,
  collectAttachments,
  layoutSection,
  recordToText,
  recordTitle,
  toSheetCsv,
} = require("./exportPlan");

const PAGE = 500;

/** Documents of `collection` that belong to `companyId` (any of the tenant fields), deduplicated, paged. */
async function tenantDocs(db, collection, companyId) {
  const seen = new Map();
  for (const field of TENANT_FIELDS) {
    let last = null;
    for (;;) {
      let q = db.collection(collection).where(field, "==", companyId).orderBy("__name__").limit(PAGE);
      if (last) q = q.startAfter(last);
      let snap;
      try {
        snap = await q.get();
      } catch {
        break; // collection / field combination that does not exist
      }
      snap.docs.forEach((d) => seen.set(d.ref.path, d));
      if (snap.docs.length < PAGE) break;
      last = snap.docs[snap.docs.length - 1];
    }
  }
  return [...seen.values()];
}

/** id -> name for the people, plants, company and machines the exported records point at (so no code is shown). */
async function nameLookup(db, companyId, plantIds) {
  const lookup = new Map();
  const add = (id, name) => {
    if (id && typeof name === "string" && name.trim() && id.length >= 10) lookup.set(id, name.trim());
  };
  const company = await db.collection("companies").doc(companyId).get();
  if (company.exists) add(companyId, company.get("name"));
  const users = await db.collection(`companies/${companyId}/users`).get();
  users.docs.forEach((d) => add(d.id, d.get("fullName") || d.get("name") || d.get("displayName")));
  const plants = await db.collection("plants").where("companyId", "==", companyId).get();
  plants.docs.forEach((d) => add(d.id, d.get("name")));
  plantIds.forEach((id) => lookup.has(id) || add(id, id));
  for (const d of await tenantDocs(db, "machines", companyId)) add(d.id, d.get("name"));
  return lookup;
}

/**
 * Reads the exportable collections of ONE company (work orders, breakdowns,
 * safety cases, work permits, shift handovers) and works out which Storage
 * files its records reference. Only records matched by this company's id are
 * read, and only Storage paths keyed by this company or its plants are
 * returned for download.
 *
 * @return {{datasets, files: Map, refused: string[], counts}}
 */
async function gatherCompanyData({db, companyId, plantIds, bucketName, onProgress}) {
  const ctx = {bucketName, companyId, plantIds, woNumberById: new Map(), woNumberByTicket: new Map()};
  const datasets = {};
  const files = new Map(); // storage path -> [zip entry names] (one per record that uses it)
  const refused = new Set();
  let records = 0;

  for (const section of SECTIONS) {
    const dataset = {label: section.label, collections: {}};
    datasets[section.id] = dataset;
    for (const col of section.collections) {
      const docs = await tenantDocs(db, col.name, companyId);
      const list = [];
      for (const d of docs) {
        const data = serialize(d.data());
        const sub = {};
        for (const subName of col.subcollections || []) {
          const subSnap = await d.ref.collection(subName).get();
          if (!subSnap.empty) sub[subName] = subSnap.docs.map((s) => ({id: s.id, ...serialize(s.data())}));
        }
        const found = col.layout === "textOnly" || col.layout === "permit" || col.layout === "sheet" ?
          {allowed: [], refused: []} :
          collectAttachments({data, sub}, ctx);
        found.refused.forEach((p) => refused.add(p));
        const record = {
          id: d.id,
          title: recordTitle(data, col.titleKeys, d.id),
          data,
          attachments: found.allowed.map((path) => ({name: path.split("/").pop().replace(/^\d{10,}_/, ""), file: "", path})),
        };
        if (Object.keys(sub).length) record.sub = sub;
        list.push(record);
        records++;
        if (col.name === "workOrders" && data.woNumber) {
          ctx.woNumberById.set(d.id, data.woNumber);
          for (const t of [data.linkedBreakdownId, ...(data.linkedBreakdownIds || [])]) if (t) ctx.woNumberByTicket.set(t, data.woNumber);
        }
      }
      // Each record gets its folder / text file (work orders and permits are read first, so breakdowns can name their WO).
      layoutSection(col, list, ctx);
      for (const r of list) {
        for (const a of r.attachments) {
          const entries = files.get(a.path) || [];
          entries.push(a.file);
          files.set(a.path, entries);
        }
      }
      dataset.collections[col.name] = list;
      if (onProgress) await onProgress({step: "collecting", collection: col.name, records});
    }
  }
  datasets._names = Object.fromEntries(await nameLookup(db, companyId, plantIds));
  return {datasets, files, refused: [...refused], counts: {records, files: files.size}};
}

/** Text files of the ZIP: one .txt per record (or per work order / permit group), the handover spreadsheet and notes. */
function buildTextEntries({company, exportedAt, datasets, missing, refused}) {
  const entries = [];
  const lookup = new Map(Object.entries(datasets._names || {}));
  // Ids of exported records read as their numbers too ("Linked WO: WO-2026-0004").
  for (const section of SECTIONS) {
    for (const col of section.collections) {
      for (const r of (datasets[section.id] && datasets[section.id].collections[col.name]) || []) if (r.id.length >= 10) lookup.set(r.id, r.title);
    }
  }
  for (const section of SECTIONS) {
    for (const col of section.collections) {
      const list = (datasets[section.id] && datasets[section.id].collections[col.name]) || [];
      if (col.layout === "sheet") {
        if (list.length) entries.push({name: `${section.label}/${section.label}.csv`, content: toSheetCsv(list, lookup)});
        continue;
      }
      const texts = new Map(); // textPath -> [text of each record]
      for (const r of list) {
        if (!r.textPath) continue;
        const group = texts.get(r.textPath) || [];
        group.push(recordToText(r, col.label || col.name, lookup));
        texts.set(r.textPath, group);
      }
      for (const [name, parts] of texts) entries.push({name, content: parts.join(`\n${"=".repeat(60)}\n\n`)});
    }
  }
  const notes = [
    `FirmiCore data export — ${company}`,
    `Exported ${exportedAt}`,
    "",
    "Unzip the whole folder. It holds:",
    "  Work orders/<work order type>/<WO number>/   details.txt and the work order's files",
    "  Breakdowns/Low severity/<ticket number>/     details.txt and the ticket's files",
    "  Breakdowns/<WO number>/                      breakdown tickets.txt (every ticket of that work order) and their files",
    "  Safety cases/                                one text file per case (no attachments)",
    "  Work permits/                                one text file per work order number (no attachments)",
    "  Shift handovers/                             one spreadsheet (CSV, opens in Excel)",
    "  PM history/<record>/                         details.txt and the record's files",
    "  Stock movements/                             one spreadsheet (CSV, opens in Excel)",
    "Machines, users, inventory, contractors, analytics, audits, evaluations, reports, MOE and plants are not part of this export.",
    "",
  ];
  if (missing.length) notes.push(`Attachments that could not be read (${missing.length}):`, ...missing.map((p) => `  - ${p}`), "");
  if (refused.length) {
    notes.push(`Files referenced by records but not included because they are not in this company's storage (${refused.length}):`,
        ...refused.map((p) => `  - ${p}`), "");
  }
  entries.push({name: "_export-notes.txt", content: notes.join("\n")});
  return entries;
}

module.exports = {gatherCompanyData, buildTextEntries, tenantDocs};
