const {
  SECTIONS,
  TENANT_FIELDS,
  serialize,
  collectAttachments,
  assignFolders,
  recordToText,
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
  const files = new Map(); // storage path -> [zip entry names] (one per record that uses it)
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
        const record = {
          id: d.id,
          title: recordTitle(data, col.titleKeys, d.id),
          data,
          attachments: found.allowed.map((path) => ({name: path.split("/").pop().replace(/^\d{10,}_/, ""), file: "", path})),
        };
        if (Object.keys(sub).length) record.sub = sub;
        list.push(record);
        records++;
      }
      // Every record gets its own folder (named by its number) holding its files.
      assignFolders(section, col, list);
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
  // Each record's folder holds a readable summary and the raw data beside its files.
  // Ids of exported records read as their names ("Machine: Press 01").
  const lookup = new Map();
  for (const section of SECTIONS) {
    for (const col of section.collections) {
      for (const r of datasets[section.id].collections[col.name] || []) if (r.id.length >= 12) lookup.set(r.id, r.title);
    }
  }
  for (const section of SECTIONS) {
    for (const col of section.collections) {
      for (const r of datasets[section.id].collections[col.name] || []) {
        entries.push({name: `${r.folder}/details.txt`, content: recordToText(r, col.label || col.name, lookup)});
        entries.push({name: `${r.folder}/details.json`, content: JSON.stringify({id: r.id, ...r.data, ...(r.sub ? {_subcollections: r.sub} : {})}, null, 2)});
      }
    }
  }
  // The viewer maps each storage link to the copy saved in the record's folder (by path).
  const viewerSets = {};
  for (const section of SECTIONS) {
    viewerSets[section.id] = {
      label: datasets[section.id].label,
      collections: Object.fromEntries(Object.entries(datasets[section.id].collections).map(([name, list]) => [
        name,
        list.map((r) => ({
          ...r,
          attachments: r.attachments.map(({name: n, file, path}) => ({name: n, file, path})),
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
    "Unzip the whole folder, then open index.html in a browser to browse everything offline (no internet or login needed).",
    "Every record has its own folder named by its number (for example Breakdowns/Breakdown tickets/BD-0012) holding its files,",
    "a readable details.txt and the raw details.json. data/*.json and data/*.csv hold whole lists for Excel or other systems.",
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
