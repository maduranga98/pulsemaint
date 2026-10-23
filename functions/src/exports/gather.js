const {
  SECTIONS,
  TENANT_FIELDS,
  serialize,
  collectAttachments,
  attachmentEntryName,
  recordTitle,
  toCsv,
  buildViewerEntries,
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

/** Documents stored under `<collection>/<key>/<sub>/*` for the company's own keys. */
async function pathKeyedDocs(db, collection, sub, keys) {
  const out = [];
  for (const key of keys) {
    const snap = await db.collection(collection).doc(key).collection(sub).get();
    out.push(...snap.docs);
  }
  return out;
}

/**
 * Reads every exportable collection of ONE company and works out which Storage
 * files its records reference. Only records matched by this company's id (or
 * stored under this company's / plants' keys) are read, and only Storage paths
 * keyed by this company or its plants are returned for download.
 *
 * @return {{datasets, files: Map, refused: string[], counts}}
 */
async function gatherCompanyData({db, companyId, plantIds, bucketName, onProgress}) {
  const ctx = {bucketName, companyId, plantIds};
  const datasets = {};
  const files = new Map(); // storage path -> zip entry name
  const refused = new Set();
  let records = 0;

  for (const section of SECTIONS) {
    const dataset = {label: section.label, collections: {}};
    datasets[section.id] = dataset;
    for (const col of section.collections) {
      const docs = col.pathKeyed ?
        await pathKeyedDocs(db, col.name, col.pathKeyed, [companyId, ...plantIds]) :
        await tenantDocs(db, col.name, companyId);
      const list = [];
      for (const d of docs) {
        const data = serialize(d.data());
        const sub = {};
        for (const subName of col.subcollections || []) {
          const subSnap = await d.ref.collection(subName).get();
          if (!subSnap.empty) sub[subName] = subSnap.docs.map((s) => ({id: s.id, ...serialize(s.data())}));
        }
        const found = collectAttachments({data, sub}, ctx);
        found.refused.forEach((p) => refused.add(p));
        const attachments = found.allowed.map((path) => {
          const entry = attachmentEntryName(path);
          files.set(path, entry);
          return {name: path.split("/").pop().replace(/^\d{10,}_/, ""), file: entry, path};
        });
        const record = {
          id: d.id,
          title: recordTitle(data, col.titleKeys, d.id),
          data,
          attachments,
        };
        if (Object.keys(sub).length) record.sub = sub;
        list.push(record);
        records++;
      }
      dataset.collections[col.name] = list;
      if (onProgress) await onProgress({step: "collecting", collection: col.name, records});
    }
  }
  return {datasets, files, refused: [...refused], counts: {records, files: files.size}};
}

/** Text files of the ZIP (JSON + CSV per collection, offline viewer, notes). */
function buildTextEntries({company, exportedAt, datasets, missing, refused}) {
  const entries = [];
  for (const section of SECTIONS) {
    for (const col of section.collections) {
      const list = datasets[section.id].collections[col.name] || [];
      entries.push({name: `data/${col.name}.json`, content: JSON.stringify(list.map((r) => ({id: r.id, ...r.data})), null, 2)});
      entries.push({name: `data/${col.name}.csv`, content: toCsv(list)});
    }
  }
  // The viewer needs the attachment `path` only for the ZIP; drop it from the page data.
  const viewerSets = {};
  for (const section of SECTIONS) {
    viewerSets[section.id] = {
      label: datasets[section.id].label,
      collections: Object.fromEntries(Object.entries(datasets[section.id].collections).map(([name, list]) => [
        name,
        list.map((r) => ({
          ...r,
          attachments: r.attachments.map(({name: n, file}) => ({name: n, file})),
          missing: r.attachments.filter((a) => missing.includes(a.path)).map((a) => a.name),
        })),
      ])),
    };
  }
  entries.push(...buildViewerEntries({company, exportedAt, sections: SECTIONS, datasets: viewerSets}));
  const notes = [
    `FirmiCore data export — ${company}`,
    `Exported ${exportedAt}`,
    "",
    "Open index.html in a browser to browse everything offline (no internet or login needed).",
    "data/*.json and data/*.csv hold the same records for Excel or other systems; files/ holds the attachments.",
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
