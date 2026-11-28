const FormResponse = require("../models/FormResponse");

const EVERY_MS = 15 * 1000; // check every 15 seconds
let running = false;

// reads "28/11/2026 10:14:35", "28/11/2026" (dd/mm/yyyy) as well as normal date formats
function parseSheetDate(s) {
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +m[4] || 0, +m[5] || 0, +m[6] || 0);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

async function syncOnce() {
  if (running) return; // don't overlap with a slow previous run
  const API = process.env.FORM_SHEET_API_URL;
  const KEY = process.env.FORM_SHEET_KEY;
  if (!API || !KEY) return;
  running = true;
  try {
    const res = await fetch(`${API}?key=${encodeURIComponent(KEY)}`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data.error) throw new Error("Apps Script says: " + data.error);

    const rows = data.rows || [];
    if (!rows.length) return; // nothing came back at all: don't touch the database

    const head = rows[0].map((h) => String(h).trim());
    // match columns by keyword, so small wording changes in the form still work
    const find = (re) => head.findIndex((h) => re.test(h));
    const iTime = find(/timestamp/i);
    if (iTime < 0) {
      console.log("FORM SYNC: no 'Timestamp' column. Headers found:", head.join(", "));
      return;
    }

    // ----- Customer Satisfaction Survey columns -----
    const iCustomer = find(/customer\s*name/i);
    const iSpoc = find(/spoc\s*name/i);
    const iEmail = find(/spoc.*e-?mail/i);
    const iPhone = find(/spoc.*(contact|phone|mobile)/i);
    const iFbDate = find(/feedback\s*date/i);

    // ----- old "Contact Information" columns (old rows stay in the same sheet) -----
    const iOldName = find(/^\s*name\s*$/i);
    const iOldEmail = find(/^\s*e-?mail\s*$/i);
    const iOldPhone = find(/^\s*phone/i);
    const iOldAddr = find(/^\s*(address|location|city)/i);
    const iOldCom = find(/^\s*(comment|message|remark)/i);

    // every numbered question that is not one of the 5 main fields = rating / choice answers
    const main = new Set([iCustomer, iSpoc, iEmail, iPhone, iFbDate]);
    const answerCols = head
      .map((h, i) => ({ h, i }))
      .filter(({ h, i }) => /^\s*\d+\s*\./.test(h) && !main.has(i));

    const cell = (r, i) => (i >= 0 ? String(r[i] ?? "").trim() : "");

    let added = 0;
    const sheetKeys = new Set();
    for (const r of rows.slice(1)) {
      const ts = cell(r, iTime);
      if (!ts) continue;

      const email = cell(r, iEmail) || cell(r, iOldEmail);
      const key = `${ts}|${email.toLowerCase()}`; // same key format as before, so old rows are not duplicated
      sheetKeys.add(key);

      const answers = answerCols
        .map(({ h, i }) => ({ q: h, a: cell(r, i) }))
        .filter((x) => x.a);

      try {
        await FormResponse.create({
          name: cell(r, iCustomer) || cell(r, iOldName),
          spocName: cell(r, iSpoc),
          email,
          phone: cell(r, iPhone) || cell(r, iOldPhone),
          feedbackDate: cell(r, iFbDate) ? parseSheetDate(cell(r, iFbDate)) || undefined : undefined,
          answers,
          address: cell(r, iOldAddr),
          comments: cell(r, iOldCom),
          submittedAt: parseSheetDate(ts) || new Date(),
          sheetKey: key,
        });
        added++;
      } catch (e) {
        if (e.code !== 11000) throw e; // 11000 = already saved
      }
    }
    if (added) console.log(`FORM SYNC: saved ${added} new response(s)`);

    // mirror deletes: remove saved rows that no longer exist in the sheet
    const saved = await FormResponse.find({ source: "Google Form", sheetKey: { $exists: true, $ne: null } })
      .select("sheetKey")
      .lean();
    const gone = saved.filter((d) => !sheetKeys.has(d.sheetKey));
    if (gone.length) {
      // safety: a sudden mass delete usually means a bad response, not a real cleanup
      if (gone.length > 10 && gone.length >= saved.length * 0.5) {
        console.log(`FORM SYNC: ${gone.length} of ${saved.length} rows look deleted, skipped for safety`);
      } else {
        await FormResponse.deleteMany({ _id: { $in: gone.map((d) => d._id) } });
        console.log(`FORM SYNC: removed ${gone.length} response(s) deleted from the sheet`);
      }
    }
  } catch (err) {
    console.error("FORM SYNC ERROR:", err.message, err.cause ? "| cause: " + (err.cause.message || err.cause.code) : "");
  } finally {
    running = false;
  }
}

syncOnce();
setInterval(syncOnce, EVERY_MS);