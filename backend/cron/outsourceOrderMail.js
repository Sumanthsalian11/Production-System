const fs = require("fs");
const path = require("path");
const sendMail = require("../utils/mailSender");
const MailSettings = require("../models/MailSettings");

const esc = (v) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN") : "");
const toList = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);

const MAX_ATTACH_BYTES = 20 * 1024 * 1024;
const { getCleanArtwork, findUploaded } = require("../utils/artworkClean");

// recipients: only TO and CC saved for "outsourceOrder" (no location), else .env
async function getRecipients() {
  const cfg = await MailSettings.findOne({ key: "outsourceOrder" }).lean();
  const to = cfg?.toEmails?.length ? cfg.toEmails : toList(process.env.OUTSOURCE_ORDER_MAIL_TO);
  const ccAll = cfg?.ccEmails?.length ? cfg.ccEmails : toList(process.env.OUTSOURCE_ORDER_MAIL_CC);
  return { to, cc: ccAll.filter((c) => !to.includes(c)) };
}

// orders = array of order objects (same list the Inhouse mail gets); one mail is sent for all of them
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
        const colour = [o.colorFront, o.colorBack].filter((x) => x !== undefined && x !== "").join("+");
        const splits = Array.isArray(o.mailSplits) && o.mailSplits.length > 1 ? o.mailSplits : null;

        // one full row (all details repeated); indent no, location and qty come from the caller
        const makeRow = (indentNo, locName, qty, reqDate) => `<tr>
          <td style="${td}">${esc(indentNo)}</td>
          <td style="${td}">${esc(o.ticketNo)}</td>
          <td style="${td}">${esc(locName)}</td>
          <td style="${td}">${esc(fmtDate(reqDate || o.expectedDeliveryDate))}</td>
          <td style="${td}">${esc(o.productCode)}</td>
          <td style="${td}">${esc(o.customerName)}</td>
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
          <td style="${td}">${esc(o.orderNature)}</td>
          <td style="${td}">${esc(o.processedBy)}</td>
          <td style="${td};white-space:nowrap">${esc(o.processedAt)}</td>
        </tr>`;

        // single request: one normal row
        if (!splits) {
          return makeRow(
            o.indentNo || o.ticketNo,
            o.location?.locationName || "",
            o.quantity
          );
        }

        // multiple locations: one full row per indent + a total row
        const sum = splits.reduce((s, x) => s + (Number(x.quantity) || 0), 0);
        const wasteNote =
          Number(o.quantity) && Number(o.quantity) !== sum
            ? ` <span style="font-size:11px;font-weight:normal">(incl. waste: ${esc(o.quantity)})</span>`
            : "";

        const splitRows = splits.map((x) => makeRow(x.indentNo, x.locationName, x.quantity, x.deliveryDate)).join("");

        const tt = `${td};background:#eef6f8`;
        const totalRow = `<tr>
          <td style="${tt}" colspan="8"><b>Total Qty</b></td>
          <td style="${tt};text-align:right"><b>${esc(sum)}</b>${wasteNote}</td>
          <td style="${tt}" colspan="10"></td>
        </tr>`;

        return splitRows + totalRow;
      })
      .join("");

    const html = `
      <p>Dear Team,</p>
      <p>Please find below the details of the indent order planned as <b>Out Source</b>. The artwork is attached for your reference.</p>
      <table style="border-collapse:collapse;font-family:Arial,sans-serif">
        <thead><tr>
          <th style="${th}">Indent No</th><th style="${th}">Ticket Id</th><th style="${th}">Location</th><th style="${th}">Required date</th>
          <th style="${th}">Product Code</th><th style="${th}">Customer Name</th><th style="${th}">Description</th><th style="${th}">Paper Group</th>
          <th style="${th}">Quantity</th><th style="${th}">GSM</th><th style="${th}">Close size</th>
          <th style="${th}">Colour</th><th style="${th}">Lamination</th><th style="${th}">Finish</th>
          <th style="${th}">Specification</th><th style="${th}">Sample Type</th>
          <th style="${th}">Order Nature</th><th style="${th}">Processed By</th><th style="${th}">Processed On</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p>Regards,<br/>Production Management System</p>`;

    // attachments: artwork + PO file (unique files, total size capped)
    const attachments = [];
    const seen = new Set();
    let total = 0;
    const addFile = async (ref, name, isArtwork) => {
      const file = isArtwork ? await getCleanArtwork(ref) : findUploaded(ref);
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
      const tag = o.indentNo || o.ticketNo || "order";
      await addFile(
        o.artworkPath || o.artwork?.filePath || o.itemPdfPath,
        `${tag}_${o.artworkName || o.artwork?.fileName || "artwork"}`,
        true
      );
      await addFile(o.attachment, `${tag}_PO_${path.basename(String(o.attachment || ""))}`);
    }

    const indentNos = [
      ...new Set(
        list
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
      subject: `Outsource Order Planned - ${indentNos}`,
      html,
      attachments
    });
  } catch (err) {
    console.error("OUTSOURCE ORDER MAIL ERROR:", err.message);
  }
}

module.exports = sendOutsourceOrderMail;