const cron = require("node-cron");
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const Dispatch = require("../models/Dispatch");
const MailSettings = require("../models/MailSettings");
const Location = require("../models/LocationMaster"); // same model as the Perso mail
const sendMail = require("../utils/mailSender");
const mailConfig = require("../utils/productionMailConfig") || {};

const toArr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const DEFAULT_TO = toArr(mailConfig.TO ?? mailConfig.to);
const DEFAULT_CC = toArr(mailConfig.CC ?? mailConfig.cc);

const pad = (n) => String(n).padStart(2, "0");
const lastRunKeys = {}; // one entry per setting (location), so each mail fires once

const REPORT_DAY_OFFSET = 1;      // 0 = dispatches of today, 1 = dispatches of yesterday
const SEND_WHEN_EMPTY = false;    // true = also send a "No dispatches" mail
const MAX_ATTACH_BYTES = 20 * 1024 * 1024; // total size of uploaded files attached per mail

const escapeHtml = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const runDispatchReport = async (settings, location) => {
  try {
    const TO = settings?.toEmails?.length ? settings.toEmails : DEFAULT_TO;
    const CC = settings?.ccEmails?.length ? settings.ccEmails : DEFAULT_CC;

    // dispatch date to report
    const day = new Date();
    day.setDate(day.getDate() - REPORT_DAY_OFFSET);
    const ymd = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    const dateStr = day.toLocaleDateString("en-GB").replace(/\//g, ".");

    // dispatchDate is stored as "YYYY-MM-DD"; optional user-location filter
    const filter = { dispatchDate: { $regex: `^${ymd}` } };
    if (location) {
      const loc = await Location.findOne({ locationName: location }).lean();
      if (!loc) {
        console.log(`⚠️ Dispatch mail: location "${location}" not found - skipped.`);
        return;
      }
      filter.userLocations = String(loc._id);
    }

    const rows = await Dispatch.find(filter).sort({ createdAt: 1 }).lean();

    if (!rows.length && !SEND_WHEN_EMPTY) {
      console.log(`ℹ️ No dispatches for ${dateStr}${location ? ` [${location}]` : ""} - mail skipped.`);
      return;
    }

    const recipients = TO || [];
    if (!recipients.length) {
      console.log("⚠️ Dispatch mail: TO list is empty - check Admin > Mail Settings. Mail not sent.");
      return;
    }
    const ccList = (CC || []).filter((c) => !recipients.includes(c));

    // ================= HTML TABLE =================
    const ctr = "text-align:center;";
    const numF = (v) => (v || v === 0 ? Number(v).toLocaleString("en-IN") : "-");

    let sumDispatch = 0;
    let sumBoxes = 0;
    let sumPackets = 0;

    let body = "";
    rows.forEach((d, i) => {
      sumDispatch += Number(d.dispatchQty) || 0;
      sumBoxes += Number(d.noOfBoxes) || 0;
      sumPackets += Number(d.noOfPackets) || 0;

      body += `
        <tr>
          <td style="${ctr}">${i + 1}</td>
          <td style="${ctr}font-weight:bold;">${escapeHtml(d.efiWoNumber || d.ticketNo)}</td>
          <td>${escapeHtml(d.customer) || "-"}</td>
          <td>${escapeHtml(d.productName) || "-"}</td>
          <td>${escapeHtml(d.productType) || "-"}</td>
          <td style="text-align:right;">${numF(d.totalQty)}</td>
          <td style="text-align:right;font-weight:bold;">${numF(d.dispatchQty)}</td>
          <td style="text-align:right;">${numF(d.balanceQty)}</td>
          <td style="text-align:right;">${numF(d.extraQty)}</td>
          <td style="${ctr}">${numF(d.noOfBoxes)}</td>
          <td style="${ctr}">${numF(d.noOfPackets)}</td>
          <td>${escapeHtml(d.courier) || "-"}</td>
          <td>${escapeHtml(d.trackingNumber) || "-"}</td>
          <td>${escapeHtml(d.invoiceNo) || "-"}</td>
          <td style="${ctr}">${escapeHtml(d.delayLabel) || "-"}</td>
          <td>${escapeHtml(d.deliveryAddress) || "-"}</td>
          <td>${escapeHtml(d.enteredBy) || "-"}</td>
        </tr>`;
    });

    const totalRow = `
      <tr style="background:#1a2a3a;color:#ffffff;font-weight:bold;">
        <td colspan="6" style="text-align:right;">TOTAL</td>
        <td style="text-align:right;">${sumDispatch.toLocaleString("en-IN")}</td>
        <td></td><td></td>
        <td style="${ctr}">${sumBoxes.toLocaleString("en-IN")}</td>
        <td style="${ctr}">${sumPackets.toLocaleString("en-IN")}</td>
        <td colspan="6"></td>
      </tr>`;

    const html = rows.length
      ? `
    <div style="font-family:Arial,sans-serif">
      <p>Dispatch report for <b>${dateStr}</b>${location ? ` - ${escapeHtml(location)}` : ""}.
         Total dispatches: <b>${rows.length}</b></p>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:12px;">
        <thead style="background:#a9cce3;text-align:center;">
          <tr>
            <th>#</th>
            <th>WO / TICKET</th>
            <th style="text-align:left;">CUSTOMER</th>
            <th style="text-align:left;">PRODUCT</th>
            <th style="text-align:left;">PRODUCT TYPE</th>
            <th>TOTAL QTY</th>
            <th>DISPATCH QTY</th>
            <th>BALANCE QTY</th>
            <th>EXTRA QTY</th>
            <th>BOXES</th>
            <th>PACKETS</th>
            <th style="text-align:left;">COURIER</th>
            <th style="text-align:left;">VEHICLE NO</th>
            <th style="text-align:left;">INVOICE NO</th>
            <th>TAT</th>
            <th style="text-align:left;">ADDRESS</th>
            <th style="text-align:left;">USER</th>
          </tr>
        </thead>
        <tbody>${body}${totalRow}</tbody>
      </table>
    </div>`
      : `
    <div style="font-family:Arial,sans-serif;font-size:14px;">
      <p><b>No dispatch was made on ${dateStr}${location ? ` - ${escapeHtml(location)}` : ""}.</b></p>
    </div>`;

    // ================= ATTACHMENTS =================
    const attachments = [];

    if (rows.length) {
      // Excel summary of the day's dispatches
      const excelRows = rows.map((d, i) => ({
        "Sl No": i + 1,
        "WO / Ticket": d.efiWoNumber || d.ticketNo || "",
        "PO No": d.purchaseOrderNo || "",
        Customer: d.customer || "",
        Product: d.productName || "",
        "Product Type": d.productType || "",
        "Total Qty": d.totalQty ?? "",
        "Dispatch Qty": d.dispatchQty ?? "",
        "Balance Qty": d.balanceQty ?? "",
        "Extra Qty": d.extraQty ?? "",
        "No. of Boxes": d.noOfBoxes ?? 0,
        "No. of Packets": d.noOfPackets ?? 0,
        "Dispatch Date": d.dispatchDate || "",
        "Expected Delivery": d.expectedDeliveryDate || "",
        TAT: d.delayLabel || "",
        Courier: d.courier || "",
        "Vehicle No": d.trackingNumber || "",
        "Invoice No": d.invoiceNo || "",
        "Invoice Date": d.invoiceDate || "",
        "Delivery Address": d.deliveryAddress || "",
        User: d.enteredBy || "",
        Remarks: d.remarks || "",
      }));
      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dispatch");
      attachments.push({
        filename: `Dispatch_Report_${dateStr}.xlsx`,
        content: XLSX.write(wb, { type: "buffer", bookType: "xlsx" }),
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // uploaded files of each dispatch (within the size limit)
      let total = 0;
      for (const d of rows) {
        if (!d.attachment) continue;
        const full = path.join(__dirname, "..", d.attachment);
        try {
          const size = fs.statSync(full).size;
          if (total + size > MAX_ATTACH_BYTES) continue;
          total += size;
          attachments.push({
            filename: `${d.efiWoNumber || d.ticketNo}_${d.attachmentName || path.basename(full)}`,
            path: full,
          });
        } catch {
          /* file missing on disk - ignore */
        }
      }
    }

    await sendMail({
      to: recipients,
      cc: ccList,
      subject: `DISPATCH REPORT ${dateStr}${location ? ` - ${location}` : ""}.`,
      html,
      attachments,
    });

    console.log(
      `✅ Dispatch report mail sent for ${dateStr}${location ? ` [${location}]` : ""} | to: ${recipients.join(", ")}`
    );
  } catch (err) {
    console.error(`❌ Dispatch Mail Error [${settings?.key}]:`, err);
  }
};

// every minute: fire each stored setting ("dispatchReport" and "dispatchReport::<Location>") at its own send time
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const nowHM = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const docs = await MailSettings.find({ key: /^dispatchReport(::|$)/ }).lean();
    if (!docs.length) return; // nothing saved in Admin > Mail Settings yet

    for (const settings of docs) {
      const sendTime = settings.sendTime || "18:00";
      if (nowHM !== sendTime) continue;

      const runKey = `${now.toDateString()} ${sendTime}`;
      if (lastRunKeys[settings.key] === runKey) continue;
      lastRunKeys[settings.key] = runKey;

      await runDispatchReport(settings, settings.key.split("::")[1] || "");
    }
  } catch (err) {
    console.error("❌ Dispatch Mail Cron Error:", err);
  }
});