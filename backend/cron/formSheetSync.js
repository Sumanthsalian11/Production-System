const FormResponse = require("../models/FormResponse");

const EVERY_MS = 60 * 1000; // check every minute

// small CSV parser (handles quotes and line breaks inside answers)
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// reads "25/11/2026 12:06:18" (dd/mm/yyyy) as well as normal date formats
function parseSheetDate(s) {
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6] || 0);
  const d = new Date(s);
  return isNaN(d) ? new Date() : d;
}

async function syncOnce() {
  const URL_CSV = process.env.FORM_SHEET_CSV_URL;
  if (!URL_CSV) {
    console.log("FORM SYNC: FORM_SHEET_CSV_URL is missing in .env");
    return;
  }
  if (typeof fetch !== "function") {
    console.log("FORM SYNC: this Node version has no fetch. Node 18 or newer is needed. Your version:", process.version);
    return;
  }

  try {
    const res = await fetch(URL_CSV);
    const body = await res.text();
    if (!res.ok) throw new Error("Google returned HTTP " + res.status);

    const rows = parseCsv(body);
    console.log(`FORM SYNC: downloaded ${rows.length} line(s). First line: ${(rows[0] || []).join(" | ")}`);
    if (rows.length < 2) {
      console.log("FORM SYNC: no data rows found. Is the Sheet tab published as CSV (not as a web page)?");
      return;
    }

    const head = rows[0].map((h) => h.trim());
    const idx = (name) => head.indexOf(name);
    const iTime = idx("Timestamp"), iName = idx("Name"), iEmail = idx("Email");
    const iAddr = idx("Address"), iPhone = idx("Phone number"), iCom = idx("Comments");
    if (iTime < 0) {
      console.log("FORM SYNC: no 'Timestamp' column. Headers found:", head.join(", "));
      return;
    }

    let added = 0, skipped = 0;
    for (const r of rows.slice(1)) {
      const ts = (r[iTime] || "").trim();
      if (!ts) continue;
      const key = `${ts}|${(r[iEmail] || "").trim().toLowerCase()}`;
      try {
        await FormResponse.create({
          name: r[iName] || "",
          email: r[iEmail] || "",
          address: r[iAddr] || "",
          phone: r[iPhone] || "",
          comments: r[iCom] || "",
          submittedAt: parseSheetDate(ts),
          sheetKey: key,
        });
        added++;
      } catch (e) {
        if (e.code === 11000) skipped++; // already saved
        else throw e;
      }
    }
    console.log(`FORM SYNC: saved ${added} new, ${skipped} already in database`);
  } catch (err) {
    console.error("FORM SYNC ERROR:", err.message, err.cause ? "| cause: " + (err.cause.message || err.cause.code) : "");
  }
}

syncOnce();
setInterval(syncOnce, EVERY_MS);