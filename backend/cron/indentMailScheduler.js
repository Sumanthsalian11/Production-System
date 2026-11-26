const cron = require("node-cron");
const IndentRequest = require("../models/Indentrequest");
const MailSettings = require("../models/MailSettings");
const sendMail = require("../utils/mailSender");
const { CC } = require("../utils/mailConfig");
const XLSX = require("xlsx");

const pad = (n) => String(n).padStart(2, "0");
let lastRunKey = ""; // prevents sending twice in the same minute/day

// Checks every minute; sends when the time set in Admin arrives
cron.schedule("* * * * *", async () => {
  try {
    const settings = await MailSettings.findOne({ key: "indentSummary" }).lean();
    const sendTime = settings?.sendTime || "15:00";

    const now = new Date();
    const nowHM = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (nowHM !== sendTime) return;

    const runKey = `${now.toDateString()} ${sendTime}`;
    if (lastRunKey === runKey) return;
    lastRunKey = runKey;

    const [sh, sm] = sendTime.split(":").map(Number);

    // Today at the set time
    const toTime = new Date(now);
    toTime.setHours(sh, sm, 0, 0);

    // Yesterday at the set time
    const fromTime = new Date(toTime);
    fromTime.setDate(fromTime.getDate() - 1);

    const indents = await IndentRequest.find({
      createdAt: { $gte: fromTime, $lte: toTime },
      status: { $in: ["PENDING_PO", "SAMPLE_REQUESTED"] },
    }).populate("location", "locationName");

    if (!indents.length) {
      console.log("No indents found.");
      return;
    }

    // Group by userEmail
    const grouped = {};
    indents.forEach((indent) => {
      const email = indent.userEmail;
      if (!email) return;
      if (!grouped[email]) grouped[email] = [];
      grouped[email].push(indent);
    });

    let rows = "";
    let totalCount = 0;

    indents.forEach((indent, index) => {
      const item = indent.items?.[0] || {};
      totalCount++;
      rows += `
      <tr>
        <td style="text-align:center;">${index + 1}</td>
        <td>${indent.indentNo}</td>
        <td>${item.productCode || ""}</td>
        <td>${item.customerName || ""}</td>
        <td>${item.description || ""}</td>
        <td style="text-align:center;">${item.quantity || 0}</td>

        <td>${
          item.deliveryDate
            ? new Date(item.deliveryDate).toLocaleDateString("en-GB").replace(/\//g, "-")
            : ""
        }</td>
        <td>${indent.status || ""}</td>
        <td>${indent.location?.locationName || ""}</td>
        <td>${indent.user || ""}</td>
        <td>${new Date(indent.createdAt).toLocaleString("en-IN")}</td>
      </tr>`;
    });

    const html = `
    <div style="font-family:Arial,sans-serif">
      <h2 style="color:#1976d2;">Pending Indent Summary</h2>
      <p>
        <strong>From :</strong> ${fromTime.toLocaleString("en-IN")}<br>
        <strong>To :</strong> ${toTime.toLocaleString("en-IN")}
      </p>
      <table border="1" cellpadding="8" cellspacing="0"
        style="border-collapse:collapse;width:100%;font-size:14px;">
        <thead style="background:#1976d2;color:white;">
          <tr>
            <th>Sl No</th>
            <th>Indent No</th>
            <th>Product Code</th>
            <th>Customer</th>
            <th>Description</th>
            <th>Qty</th>

            
            <th>Expected Dispatch Date</th>
              <th>Status</th>
            <th>Request Location</th>
            <th>Requested By</th>
            <th>Requested At</th>
          
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <br>
      <h3>Total Indents : ${totalCount}</h3>
    </div>`;

    // TO / CC from Admin settings (falls back to the old behaviour if left empty)
    const adminTo = settings?.toEmails || [];
    const adminCc = settings?.ccEmails || [];

    const toEmails = adminTo.length
      ? adminTo
      : [...new Set(indents.map((i) => i.userEmail).filter(Boolean))];
    const ccEmails = adminCc.length ? adminCc : CC;

    // ===== Consolidated Excel: ALL indents still pending till this time =====
    let attachments = [];
    try {
      const allPending = await IndentRequest.find({
        createdAt: { $lte: toTime },
        status: { $in: ["PENDING_PO", "SAMPLE_REQUESTED"] },
      })
        .populate("location", "locationName")
        .sort({ createdAt: 1 })
        .lean();

      const fmtDate = (d) =>
        d ? new Date(d).toLocaleDateString("en-GB").replace(/\//g, "-") : "";

      const excelRows = allPending.map((indent, i) => {
        const item = indent.items?.[0] || {};
        const ageDays = Math.floor((toTime - new Date(indent.createdAt)) / 86400000);
        return {
          "Sl No": i + 1,
          "Indent No": indent.indentNo || "",
          "Product Code": item.productCode || "",
          "Product Type": item.materialType || "",
          "Customer": item.customerName || "",
          "Description": item.description || "",
          "Qty": item.quantity || 0,
          "Expected Dispatch Date": fmtDate(item.deliveryDate),
          "Status": indent.status || "",
          "Request Location": indent.location?.locationName || "",
          "Requested By": indent.user || "",
          "Requested At": new Date(indent.createdAt).toLocaleString("en-IN"),
          "Pending Days": ageDays < 0 ? 0 : ageDays,
        };
      });

      const ws = XLSX.utils.json_to_sheet(excelRows);
      ws["!cols"] = [
        { wch: 6 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 28 }, { wch: 40 },
        { wch: 8 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 13 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pending Indents");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      attachments = [
        {
          filename: `Pending_Indents_Consolidated_${fmtDate(toTime)}.xlsx`,
          content: buffer,
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ];
    } catch (xErr) {
      // the normal summary mail still goes even if the Excel fails
      console.error("❌ Consolidated Excel Error:", xErr);
    }

    await sendMail({
      to: toEmails,
      cc: ccEmails,
      subject: `Pending Indent Summary`,
      html,
      attachments,
    });

    console.log(`✅ Mail sent to: ${toEmails.join(", ")}`);
  } catch (err) {
    console.error("❌ Mail Error:", err);
  }
});