const cron = require("node-cron");
const IndentRequest = require("../models/Indentrequest");
const sendMail = require("../utils/mailSender");
const { CC } = require("../utils/mailConfig");

// Runs every day at 3:00 PM
cron.schedule("0 15 * * *", async () => {
  try {
    const now = new Date();
   // Yesterday 3:00 PM
const fromTime = new Date(now);
fromTime.setDate(fromTime.getDate() - 1);
fromTime.setHours(15, 0, 0, 0);

// Today 3:00 PM
const toTime = new Date(now);
toTime.setHours(15, 0, 0, 0);
// Today 4:00 PM
// const fromTime = new Date(now);
// fromTime.setHours(16, 0, 0, 0);

// // Today 5:00 PM
// const toTime = new Date(now);
// toTime.setHours(17, 0, 0, 0);

    const indents = await IndentRequest.find({
      createdAt: { $gte: fromTime, $lte: toTime },
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
        <td>${item.unitRate || ""}</td>
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
      <h2 style="color:#1976d2;">Daily Indent Summary</h2>
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
            <th>Unit Rate</th>
            
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

    const toEmails = [...new Set(indents.map(i => i.userEmail).filter(Boolean))];

    await sendMail({
      to: toEmails,
      cc: CC,
      subject: `Indent Summary`,
      html,
    });

    console.log(`✅ Mail sent to: ${toEmails.join(", ")}`);
  } catch (err) {
    console.error("❌ Mail Error:", err);
  }
});