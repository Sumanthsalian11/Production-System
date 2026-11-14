const IndentRequest = require("../models/Indentrequest");
const MailSettings = require("../models/MailSettings");
const sendMail = require("./mailSender");
const { CC } = require("./mailConfig");

const esc = (v) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB").replace(/\//g, "-") : "";

// Accepts ONE indent id or an ARRAY of ids (indents saved together).
// One mail is sent: a single indent keeps the normal layout,
// several indents show one row each plus a Total Qty row.
// The creator (userEmail) is always added in CC.
async function sendIndentRequestMail(ids) {
  try {
    const idList = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    if (!idList.length) return;

    const found = await IndentRequest.find({ _id: { $in: idList } })
      .populate("location", "locationName")
      .lean();
    // keep the same order the indents were created in
    const indents = idList
      .map((id) => found.find((d) => String(d._id) === String(id)))
      .filter(Boolean);
    if (!indents.length) return;

    const first = indents[0];

    const settings = await MailSettings.findOne({ key: "indentSummary" }).lean();
    const adminTo = settings?.toEmails || [];
    const adminCc = settings?.ccEmails || [];

    const toArr = (v) => (Array.isArray(v) ? v : v ? [v] : []);

    const toEmails = adminTo.length ? toArr(adminTo) : toArr(CC);
    const ccEmails = [...new Set([first.userEmail, ...toArr(adminCc)].filter(Boolean))]
      .filter((e) => !toEmails.includes(e));

    if (!toEmails.length) {
      console.error("❌ Indent request mail: no TO recipients (set Indent Summary TO in Admin > Mail Settings)");
      return;
    }

    const typeLabel = first.indentType === "sample" ? "Sample Request" : "Indent Request";
    const indentNos = indents.map((d) => d.indentNo).filter(Boolean).join(", ");

    let html;

    if (indents.length === 1) {
      // ===== single request: same layout as before =====
      const indent = first;
      const item = indent.items?.[0] || {};
      html = `
    <div style="font-family:Arial,sans-serif">
      <h2 style="color:#1976d2;">New ${typeLabel} - ${esc(indent.indentNo)}</h2>
      <table border="1" cellpadding="8" cellspacing="0"
        style="border-collapse:collapse;font-size:14px;">
        <tr><th align="left">Indent No</th><td>${esc(indent.indentNo)}</td></tr>
        <tr><th align="left">Product Code</th><td>${esc(item.productCode)}</td></tr>
        <tr><th align="left">Customer</th><td>${esc(item.customerName)}</td></tr>
        <tr><th align="left">Description</th><td>${esc(item.description)}</td></tr>
        <tr><th align="left">Qty</th><td>${esc(item.quantity || 0)}</td></tr>

        <tr><th align="left">Expected Dispatch Date</th><td>${esc(fmtDate(item.deliveryDate))}</td></tr>
        <tr><th align="left">Status</th><td>${esc(indent.status)}</td></tr>
        <tr><th align="left">Request Location</th><td>${esc(indent.location?.locationName)}</td></tr>
        <tr><th align="left">Requested By</th><td>${esc(indent.user)}</td></tr>
        <tr><th align="left">Requested At</th><td>${esc(new Date(indent.createdAt).toLocaleString("en-IN"))}</td></tr>
      </table>
    </div>`;
    } else {
      // ===== multiple locations / quantities: one row per indent + total =====
      const th = "border:1px solid #999;padding:6px 8px;background:#a9d0d9;text-align:left;font-size:13px";
      const td = "border:1px solid #999;padding:6px 8px;font-size:13px;vertical-align:top";
      const tt = `${td};background:#eef6f8`;

      let sum = 0;
      const rows = indents
        .map((d) => {
          const it = d.items?.[0] || {};
          const qty = Number(it.quantity) || 0;
          sum += qty;
          return `<tr>
          <td style="${td}">${esc(d.indentNo)}</td>
          <td style="${td}">${esc(it.productCode)}</td>
          <td style="${td}">${esc(it.customerName)}</td>
          <td style="${td}">${esc(it.description)}</td>
          <td style="${td};text-align:right">${esc(qty)}</td>
          <td style="${td}">${esc(fmtDate(it.deliveryDate))}</td>
          <td style="${td}">${esc(d.status)}</td>
          <td style="${td}">${esc(d.location?.locationName)}</td>
          <td style="${td}">${esc(d.user)}</td>
          <td style="${td}">${esc(new Date(d.createdAt).toLocaleString("en-IN"))}</td>
        </tr>`;
        })
        .join("");

      const totalRow = `<tr>
          <td style="${tt}" colspan="4"><b>Total Qty</b></td>
          <td style="${tt};text-align:right"><b>${esc(sum)}</b></td>
          <td style="${tt}" colspan="5"></td>
        </tr>`;

      html = `
    <div style="font-family:Arial,sans-serif">
      <h2 style="color:#1976d2;">New ${typeLabel} - ${esc(indentNos)}</h2>
      <table style="border-collapse:collapse">
        <thead><tr>
          <th style="${th}">Indent No</th><th style="${th}">Product Code</th><th style="${th}">Customer</th>
          <th style="${th}">Description</th><th style="${th}">Qty</th><th style="${th}">Expected Dispatch Date</th>
          <th style="${th}">Status</th><th style="${th}">Request Location</th>
          <th style="${th}">Requested By</th><th style="${th}">Requested At</th>
        </tr></thead>
        <tbody>${rows}${totalRow}</tbody>
      </table>
    </div>`;
    }

    await sendMail({
      to: toEmails,
      cc: ccEmails,
      subject: `New ${typeLabel} - ${indentNos}`,
      html,
    });

    console.log(`✅ Indent request mail sent for ${indentNos}`);
  } catch (err) {
    console.error("❌ Indent request mail error:", err);
  }
}

module.exports = sendIndentRequestMail;