const fs = require("fs");
const path = require("path");
const sendMail = require("../utils/mailSender");
const MailSettings = require("../models/MailSettings");

const esc = (v) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN") : "");
const toList = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);

const MAX_ATTACH_BYTES = 20 * 1024 * 1024;
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

// recipients: only TO and CC saved for "outsourceOrder" (no location), else .env
async function getRecipients() {
  const cfg = await MailSettings.findOne({ key: "outsourceOrder" }).lean();
  const to = cfg?.toEmails?.length ? cfg.toEmails : toList(process.env.OUTSOURCE_ORDER_MAIL_TO);
  const ccAll = cfg?.ccEmails?.length ? cfg.ccEmails : toList(process.env.OUTSOURCE_ORDER_MAIL_CC);
  return { to, cc: ccAll.filter((c) => !to.includes(c)) };
}

// orders = array of saved Out Source orders; one mail is sent for all of them
async function sendOutsourceOrderMail(orders = []) {
  try {
    const list = (orders || []).map((o) => (o.toObject ? o.toObject() : o));
    if (!list.length) return;

    const { to, cc } = await getRecipients();
    if (!to.length) {
      console.warn("Outsource mail: no TO set in Mail Settings, mail skipped");
      return;
    }

    const th = "border:1px solid #999;padding:5px 8px;background:#a9d0d9;text-align:left;font-size:12px";
    const td = "border:1px solid #999;padding:5px 8px;font-size:12px;vertical-align:top";

    const rows = list
      .map((o) => {
        const loc =
          Array.isArray(o.locationSplits) && o.locationSplits.length > 1
            ? o.locationSplits.map((l) => `${l.locationName || "-"}: ${l.quantity}`).join(" | ")
            : o.location?.locationName || "";
        const paper = [o.paperGroup, o.paperSize, o.millName].filter(Boolean).join(" / ");
        return `<tr>
          <td style="${td}">${esc(o.ticketNo || o.indentNo)}</td>
          <td style="${td}">${esc(o.purchaseOrderNo)}</td>
          <td style="${td}">${esc(fmtDate(o.poDate))}</td>
          <td style="${td}">${esc(fmtDate(o.expectedDeliveryDate))}</td>
          <td style="${td}">${esc(o.productCode)}</td>
          <td style="${td}">${esc(o.materialType)}</td>
          <td style="${td}">${esc(o.customerName)}</td>
          <td style="${td}">${esc(o.description)}</td>
          <td style="${td};text-align:right">${esc(o.quantity)}</td>
          <td style="${td}">${esc(loc)}</td>
          <td style="${td}">${esc(o.jobSize)}</td>
          <td style="${td}">${esc(paper)}</td>
          <td style="${td}">${esc(o.gsm)}</td>
          <td style="${td}">${esc(o.orderNature)}</td>
          <td style="${td}">${esc(o.remarks)}</td>
          <td style="${td}">${esc(o.remarks2)}</td>
          <td style="${td}">${esc(o.user)}</td>
        </tr>`;
      })
      .join("");

    const html = `
      <p>Dear Team,</p>
      <p>Please find below the details of the order placed as <b>Out Source</b>. The artwork is attached for your reference.</p>
      <table style="border-collapse:collapse;font-family:Arial,sans-serif">
        <thead><tr>
          <th style="${th}">Ticket No</th><th style="${th}">PO No</th><th style="${th}">PO Date</th><th style="${th}">Expected Date</th>
          <th style="${th}">Product Code</th><th style="${th}">Product Type</th><th style="${th}">Customer</th><th style="${th}">Description</th>
          <th style="${th}">Quantity</th><th style="${th}">Location</th><th style="${th}">Job Size</th><th style="${th}">Paper</th>
          <th style="${th}">GSM</th><th style="${th}">Order Nature</th><th style="${th}">Supplier</th><th style="${th}">Remarks</th><th style="${th}">User</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p>Regards,<br/>Production Management System</p>`;

    // attachments: artwork + PO file (unique files, total size capped)
    const attachments = [];
    const seen = new Set();
    let total = 0;
    const addFile = (ref, name) => {
      const file = resolveFile(ref);
      if (!file || seen.has(file)) return;
      const size = fs.statSync(file).size;
      if (total + size > MAX_ATTACH_BYTES) {
        console.warn("Outsource mail: attachment skipped (size cap)", file);
        return;
      }
      seen.add(file);
      total += size;
      attachments.push({ filename: name || path.basename(file), path: file });
    };
    for (const o of list) {
      const tag = o.ticketNo || o.indentNo || "order";
      addFile(o.artwork?.filePath || o.artworkPath || o.itemPdfPath, `${tag}_${o.artwork?.fileName || "artwork"}`);
      addFile(o.attachment, `${tag}_PO_${path.basename(String(o.attachment || ""))}`);
    }

    const ids = [...new Set(list.map((o) => o.ticketNo || o.indentNo).filter(Boolean))].join(", ");

    await sendMail({
      to,
      cc,
      subject: `Outsource Order - ${ids}`,
      html,
      attachments
    });
  } catch (err) {
    console.error("OUTSOURCE ORDER MAIL ERROR:", err.message);
  }
}

module.exports = sendOutsourceOrderMail;