const FormResponse = require("../models/FormResponse");

const EVERY_MS = 15 * 1000; // check every 15 seconds
let running = false;

// reads "25/11/2026 12:06:18" (dd/mm/yyyy) as well as normal date formats
function parseSheetDate(s) {
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6] || 0);
  const d = new Date(s);
  return isNaN(d) ? new Date() : d;
}

async function syncOnce() {
  if (running) return; // don't overlap with a slow previous run
  const API = process.env.FORM_SHEET_API_URL;
  const KEY = process.env.FORM_SHEET_KEY;
  if (!API || !KEY) {
    console.log("FORM SYNC: FORM_SHEET_API_URL / FORM_SHEET_KEY missing in .env");
    return;
  }
  running = true;
  try {
    const res = await fetch(`${API}?key=${encodeURIComponent(KEY)}`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data.error) throw new Error("Apps Script says: " + data.error);

    const rows = data.rows || [];
    if (rows.length < 2) return;

    const head = rows[0].map((h) => String(h).trim());
    // match columns by keyword, so renaming a question still works
    const find = (re, not) => head.findIndex((h) => re.test(h) && !(not && not.test(h)));
    const iTime = find(/timestamp/i);
    const iName = find(/name/i);
    const iEmail = find(/e-?mail/i);
    const iAddr = find(/address|location|city/i, /e-?mail/i);
    const iPhone = find(/phone|mobile/i);
    const iCom = find(/comment|message|remark|feedback/i);
    if (iTime < 0) {
      console.log("FORM SYNC: no 'Timestamp' column. Headers found:", head.join(", "));
      return;
    }

    let added = 0;
    for (const r of rows.slice(1)) {
      const ts = String(r[iTime] || "").trim();
      if (!ts) continue;
      const key = `${ts}|${String(r[iEmail] || "").trim().toLowerCase()}`;
      try {
        await FormResponse.create({
          name: r[iName] || "",
          email: r[iEmail] || "",
          address: r[iAddr] || "",
          phone: String(r[iPhone] || ""),
          comments: r[iCom] || "",
          submittedAt: parseSheetDate(ts),
          sheetKey: key,
        });
        added++;
      } catch (e) {
        if (e.code !== 11000) throw e; // 11000 = already saved
      }
    }
    if (added) console.log(`FORM SYNC: saved ${added} new response(s)`);
  } catch (err) {
    console.error("FORM SYNC ERROR:", err.message, err.cause ? "| cause: " + (err.cause.message || err.cause.code) : "");
  } finally {
    running = false;
  }
}

syncOnce();
setInterval(syncOnce, EVERY_MS);