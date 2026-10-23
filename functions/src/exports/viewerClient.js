/* eslint-disable */
// Offline viewer of the company data export. This file is NOT run by Cloud
// Functions: exportPlan.js reads it as text and writes it into the ZIP's
// index.html together with the data (window.FC_MANIFEST / window.FC_DATA).
(function () {
  var data = window.FC_DATA || {};
  var manifest = window.FC_MANIFEST || { company: "", exportedAt: "", sections: [] };
  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  var state = { section: null, collection: null, query: "", selected: null };
  var IMAGE = /\.(png|jpe?g|gif|webp|bmp)$/i;
  var ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
  var URLRE = /^https?:\/\//i;
  // Internal ids that mean nothing to a reader; shown under "Technical details".
  var TECH_KEYS = /^(companyId|siteId|tenantId|plantId|machinePlantId|createdBy|updatedBy|closedBy|uid|userId|id)$/;

  // id -> {title, label} for every exported record, so a reference such as
  // machineId shows the machine's name instead of a code.
  var index = {};
  manifest.sections.forEach(function (s) {
    var set = data[s.id] || { collections: {} };
    s.collections.forEach(function (c) {
      (set.collections[c.name] || []).forEach(function (r) { if (r.id.length >= 12) index[r.id] = { title: r.title, label: c.label }; });
    });
  });

  // The record on screen: its storage links resolve to the copies saved in its folder.
  var localByPath = {};
  var STORAGE = /^https:\/\/(?:firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/|storage\.googleapis\.com\/[^/]+\/)([^?#]+)/;
  function storagePath(v) {
    var m = STORAGE.exec(v);
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch (e) { return null; }
  }

  function label(key) {
    var k = String(key).replace(/(Ids|Id|Uid)$/, "").replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim().toLowerCase();
    return k ? k.charAt(0).toUpperCase() + k.slice(1) : String(key);
  }
  function when(v) { return new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
  function isEmpty(v) { return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0); }
  function isTech(key, v) {
    if (TECH_KEYS.test(key)) return true;
    if (/(Id|Ids|Uid)$/.test(key)) {
      var vals = Array.isArray(v) ? v : [v];
      return !vals.some(function (x) { return typeof x === "string" && index[x]; });
    }
    return false;
  }
  function plain(v) { return v !== null && typeof v !== "object"; }

  function valueNode(v, depth) {
    if (isEmpty(v)) return el("span", "muted", "—");
    if (typeof v === "boolean") return el("span", null, v ? "Yes" : "No");
    if (typeof v === "number") return el("span", null, String(v));
    if (typeof v === "string") {
      if (ISO.test(v)) return el("span", null, when(v));
      if (index[v]) { var s = el("span"); s.appendChild(el("strong", null, index[v].title)); s.appendChild(el("span", "muted", " · " + index[v].label)); return s; }
      var local = localByPath[storagePath(v)];
      if (local) { var f = el("a", null, local.name); f.href = encodeURI(local.file); f.target = "_blank"; f.rel = "noopener"; return f; }
      if (URLRE.test(v)) { var a = el("a", null, "Open link"); a.href = v; a.target = "_blank"; a.rel = "noopener"; return a; }
      return el("span", "text", v);
    }
    if (Array.isArray(v)) {
      if (v.every(plain)) {
        var wrap = el("span");
        v.forEach(function (x, i) { if (i) wrap.appendChild(document.createTextNode(", ")); wrap.appendChild(valueNode(x, depth + 1)); });
        return wrap;
      }
      return tableOf(v, depth + 1);
    }
    if (depth > 3) return el("pre", "muted", JSON.stringify(v));
    return pairs(v, depth + 1);
  }
  function pairs(obj, depth) {
    var t = el("table", "kv");
    Object.keys(obj).sort().forEach(function (k) {
      if (isEmpty(obj[k])) return;
      var tr = el("tr"); tr.appendChild(el("th", null, label(k)));
      var td = el("td"); td.appendChild(valueNode(obj[k], depth)); tr.appendChild(td); t.appendChild(tr);
    });
    return t;
  }
  function tableOf(list, depth) {
    var cols = [];
    list.forEach(function (row) {
      if (row && typeof row === "object") Object.keys(row).forEach(function (k) { if (cols.indexOf(k) === -1 && !isEmpty(row[k]) && !TECH_KEYS.test(k)) cols.push(k); });
    });
    cols = cols.slice(0, 8);
    var t = el("table", "grid");
    var head = el("tr"); cols.forEach(function (c) { head.appendChild(el("th", null, label(c))); }); t.appendChild(head);
    list.forEach(function (row) {
      var tr = el("tr");
      cols.forEach(function (c) { var td = el("td"); td.appendChild(valueNode(row && row[c], depth)); tr.appendChild(td); });
      t.appendChild(tr);
    });
    return t;
  }

  function currentRecords() {
    var s = data[state.section] || { collections: {} };
    var list = (s.collections && s.collections[state.collection]) || [];
    var q = state.query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(function (r) { return (r.title + " " + r.id + " " + JSON.stringify(r.data)).toLowerCase().indexOf(q) !== -1; });
  }
  function renderNav() {
    var nav = $("nav"); nav.textContent = "";
    manifest.sections.forEach(function (s) {
      nav.appendChild(el("div", "sec", s.label));
      s.collections.forEach(function (c) {
        var b = el("button", "col" + (state.section === s.id && state.collection === c.name ? " on" : ""), c.label + " (" + c.count + ")");
        b.onclick = function () { state.section = s.id; state.collection = c.name; state.selected = null; render(); };
        nav.appendChild(b);
      });
    });
  }
  function renderList() {
    var box = $("list"); box.textContent = "";
    if (!state.collection) { box.appendChild(el("p", "muted", "Choose a list on the left.")); return; }
    var rows = currentRecords();
    box.appendChild(el("p", "muted", rows.length + " record(s)"));
    rows.slice(0, 500).forEach(function (r) {
      var b = el("button", "row" + (state.selected === r ? " on" : ""));
      b.appendChild(el("strong", null, r.title));
      if (r.attachments && r.attachments.length) b.appendChild(el("span", "muted", "  📎 " + r.attachments.length));
      b.onclick = function () { state.selected = r; render(); };
      box.appendChild(b);
    });
    if (rows.length > 500) box.appendChild(el("p", "muted", "Showing the first 500 — use search to narrow down."));
  }
  function renderDetail() {
    var box = $("detail"); box.textContent = "";
    var r = state.selected;
    if (!r) { box.appendChild(el("p", "muted", "Select a record to see everything saved on it, with its files.")); return; }
    localByPath = {};
    (r.attachments || []).forEach(function (a) { localByPath[a.path] = a; });
    box.appendChild(el("h2", null, r.title));
    box.appendChild(el("p", "muted", "Folder in this export: " + r.folder));
    if (r.attachments && r.attachments.length) {
      box.appendChild(el("h3", null, "Files (" + r.attachments.length + ")"));
      var wrap = el("div", "atts");
      r.attachments.forEach(function (a) {
        var item = el("div", "att");
        var href = encodeURI(a.file);
        if (IMAGE.test(a.file)) { var img = el("img"); img.src = href; img.alt = a.name; img.loading = "lazy"; item.appendChild(img); }
        var link = el("a", null, a.name); link.href = href; link.target = "_blank"; link.rel = "noopener";
        item.appendChild(link); wrap.appendChild(item);
      });
      box.appendChild(wrap);
    }
    if (r.missing && r.missing.length) box.appendChild(el("p", "warn", r.missing.length + " file(s) could not be included — see _export-notes.txt"));
    var main = {}, tech = {};
    Object.keys(r.data).forEach(function (k) { (isTech(k, r.data[k]) ? tech : main)[k] = r.data[k]; });
    box.appendChild(el("h3", null, "Details"));
    box.appendChild(pairs(main, 0));
    if (r.sub) Object.keys(r.sub).forEach(function (name) {
      box.appendChild(el("h3", null, label(name) + " (" + r.sub[name].length + ")"));
      box.appendChild(tableOf(r.sub[name], 0));
    });
    if (Object.keys(tech).length) {
      var d = el("details"); d.appendChild(el("summary", "muted", "Technical details"));
      d.appendChild(pairs(tech, 0)); box.appendChild(d);
    }
  }
  function render() { renderNav(); renderList(); renderDetail(); }

  $("title").textContent = manifest.company + " — data export";
  $("sub").textContent = "Exported " + when(manifest.exportedAt) + ". Unzip the whole folder first, then open this file — the files open from the folders next to it.";
  $("search").oninput = function (e) { state.query = e.target.value; renderList(); };
  var first = manifest.sections.filter(function (s) { return s.collections.some(function (c) { return c.count > 0; }); })[0];
  if (first) { state.section = first.id; state.collection = first.collections.filter(function (c) { return c.count > 0; })[0].name; }
  render();
})();
