const fs = require("fs");
const path = require("path");
const sendMail = require("../utils/mailSender");
const MailSettings = require("../models/MailSettings");

const esc = (v) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN") : "");
const toList = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);

const MAX_ATTACH_BYTES = 20 * 1024 * 1024;

// "/api/newindent/files/abc.pdf" or "/uploads/..." -> real file on disk (null if not found)
const UPLOAD_DIRS = ["uploads/indents", "uploads", "uploads/artwork", "uploads/newindent"];

const resolveFile = (p) => {
  if (!p) return null;
  let clean = String(p).split("?")[0];
  try { clean = decodeURIComponent(clean); } catch {}
  const base = path.basename(clean);
  const root = path.join(__dirname, "..");
  const candidates = [
    ...UPLOAD_DIRS.map((d) => path.join(root, d, base)),
    path.join(root, clean)
  ];
  return candidates.find((f) => fs.existsSync(f) && fs.statSync(f).isFile()) || null;
};

// recipients: product type setting -> "all product types" setting -> .env
async function getRecipients() {
  const cfg = await MailSettings.findOne({ key: "inhouseOrder" }).lean();
  const to = cfg?.toEmails?.length ? cfg.toEmails : toList(process.env.INHOUSE_ORDER_MAIL_TO);
  const ccAll = cfg?.ccEmails?.length ? cfg.ccEmails : toList(process.env.INHOUSE_ORDER_MAIL_CC);
  return { to, cc: ccAll.filter((c) => !to.includes(c)) };
}

// orders = array of order objects (see route); one mail is sent per product type
async function sendInhouseOrderMail(orders = [], planningLocation = "") {
  try {
    const list = (orders || []).map((o) => (o.toObject ? o.toObject() : o));
    if (!list.length) return;

    const groups = { "": list };

    const th = "border:1px solid #999;padding:5px 8px;background:#a9d0d9;text-align:left;font-size:12px";
    const td = "border:1px solid #999;padding:5px 8px;font-size:12px;vertical-align:top";

    for (const [materialType, rowsList] of Object.entries(groups)) {
      const { to, cc } = await getRecipients();
      if (!to.length) {
        console.warn("Inhouse mail: no TO set in Mail Settings, mail skipped");
        continue;
      }

          const rows = rowsList
        .map((o) => {
          const colour = [o.colorFront, o.colorBack].filter((x) => x !== undefined && x !== "").join("+");
          const splits = Array.isArray(o.mailSplits) && o.mailSplits.length > 1 ? o.mailSplits : null;

          // one full row (all details repeated); indent no, location and qty come from the caller
          const makeRow = (indentNo, locName, qty) => `<tr>
          <td style="${td}">${esc(indentNo)}</td>
          <td style="${td}">${esc(locName)}</td>
          <td style="${td}">${esc(fmtDate(o.expectedDeliveryDate))}</td>
          <td style="${td}">${esc(o.productCode)}</td>
          <td style="${td}">${esc(o.description)}</td>
          <td style="${td}">${esc(o.paperGroup)}</td>
          <td style="${td};text-align:right">${esc(qty)}</td>
          <td style="${td}">${esc(o.gsm)}</td>
          <td style="${td}">${esc(o.jobSize)}</td>
          <td style="${td}">${esc(colour)}</td>
          <td style="${td}">${esc(o.lamination)}</td>
          <td style="${td}">${esc(o.finish)}</td>
          <td style="${td}">${esc(o.specification)}</td>
          <td style="${td}">${esc(o.sampleType || o.indentType)}</td>
        </tr>`;

          // single request: one normal row
          if (!splits) {
            return makeRow(
              o.indentNo || o.ticketNo,
              o.location?.locationName || planningLocation || "",
              o.quantity
            );
          }

          // multiple locations: one full row per indent + a total row
          const sum = splits.reduce((s, x) => s + (Number(x.quantity) || 0), 0);
          const wasteNote =
            Number(o.quantity) && Number(o.quantity) !== sum
              ? ` <span style="font-size:11px;font-weight:normal">(incl. waste: ${esc(o.quantity)})</span>`
              : "";

          const splitRows = splits.map((x) => makeRow(x.indentNo, x.locationName, x.quantity)).join("");

          const tt = `${td};background:#eef6f8`;
          const totalRow = `<tr>
          <td style="${tt}" colspan="6"><b>Total Qty</b></td>
          <td style="${tt};text-align:right"><b>${esc(sum)}</b>${wasteNote}</td>
          <td style="${tt}" colspan="7"></td>
        </tr>`;

          return splitRows + totalRow;
        })
        .join("");

      const html = `
      <p>Dear Team,</p>
      <p>The following order request has been planned as <b>Inhouse</b> and saved${
        planningLocation ? " for <b>" + esc(planningLocation) + "</b>" : ""
      }. Artwork is attached.</p>
      <table style="border-collapse:collapse;font-family:Arial,sans-serif">
        <thead><tr>
          <th style="${th}">Indent No</th><th style="${th}">Location</th><th style="${th}">Required date</th>
          <th style="${th}">Product Code</th><th style="${th}">Description</th><th style="${th}">Paper Group</th>
          <th style="${th}">Quantity</th><th style="${th}">GSM</th><th style="${th}">Close size</th>
          <th style="${th}">Colour</th><th style="${th}">Lamination</th><th style="${th}">Finish</th>
          <th style="${th}">Specification</th><th style="${th}">Sample Type</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p>Regards,<br/>Production Management System</p>`;

      // artwork attachments (unique files, total size capped)
      const attachments = [];
      const seen = new Set();
      let total = 0;
      for (const o of rowsList) {
        const ref = o.artworkPath || o.attachment || o.itemPdfPath;
        const file = resolveFile(ref);
        if (!file) {
          console.warn("Inhouse mail: artwork not found for", o.indentNo || o.ticketNo, "->", ref);
          continue;
        }
        if (seen.has(file)) continue;
        const size = fs.statSync(file).size;
        if (total + size > MAX_ATTACH_BYTES) {
          console.warn("Inhouse mail: attachment skipped (size cap)", file);
          continue;
        }
        seen.add(file);
        total += size;
        attachments.push({
          filename: `${o.indentNo || o.ticketNo || "artwork"}_${o.artworkName || path.basename(file)}`,
          path: file
        });
      }

      const indentNos = [
        ...new Set(
          rowsList
            .flatMap((o) =>
              Array.isArray(o.mailSplits) && o.mailSplits.length > 1
                ? o.mailSplits.map((x) => x.indentNo)
                : [o.indentNo || o.ticketNo]
            )
            .filter(Boolean)
        )
      ].join(", ");

      await sendMail({
        to,
        cc,
        subject: `Inhouse Order Planned - ${indentNos}`,
        html,
        attachments
      });
    }
  } catch (err) {
    console.error("INHOUSE ORDER MAIL ERROR:", err.message);
  }
}

module.exports = sendInhouseOrderMail;