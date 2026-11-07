const IndentRequest = require("../models/Indentrequest");
const MailSettings = require("../models/MailSettings");
const sendMail = require("./mailSender");
const { CC } = require("./mailConfig");

// Sends one mail for a single newly raised indent.
// The creator (indent.userEmail) is always added in CC.
async function sendIndentRequestMail(indentId) {
  try {
    const indent = await IndentRequest.findById(indentId)
      .populate("location", "locationName")
      .lean();
    if (!indent) return;

    const settings = await MailSettings.findOne({ key: "indentSummary" }).lean();
    const adminTo = settings?.toEmails || [];
    const adminCc = settings?.ccEmails || [];

    const toArr = (v) => (Array.isArray(v) ? v : v ? [v] : []);

    const toEmails = adminTo.length ? toArr(adminTo) : toArr(CC);
    const ccEmails = [...new Set([indent.userEmail, ...toArr(adminCc)].filter(Boolean))]
      .filter((e) => !toEmails.includes(e));

    if (!toEmails.length) {
      console.error("❌ Indent request mail: no TO recipients (set Indent Summary TO in Admin > Mail Settings)");
      return;
    }

    const item = indent.items?.[0] || {};
    const deliveryDate = item.deliveryDate
      ? new Date(item.deliveryDate).toLocaleDateString("en-GB").replace(/\//g, "-")
      : "";
    const typeLabel = indent.indentType === "sample" ? "Sample Request" : "Indent Request";

    const html = `
    <div style="font-family:Arial,sans-serif">
      <h2 style="color:#1976d2;">New ${typeLabel} - ${indent.indentNo}</h2>
      <table border="1" cellpadding="8" cellspacing="0"
        style="border-collapse:collapse;font-size:14px;">
        <tr><th align="left">Indent No</th><td>${indent.indentNo || ""}</td></tr>
        <tr><th align="left">Product Code</th><td>${item.productCode || ""}</td></tr>
        <tr><th align="left">Customer</th><td>${item.customerName || ""}</td></tr>
        <tr><th align="left">Description</th><td>${item.description || ""}</td></tr>
        <tr><th align="left">Qty</th><td>${item.quantity || 0}</td></tr>

        <tr><th align="left">Expected Dispatch Date</th><td>${deliveryDate}</td></tr>
        <tr><th align="left">Status</th><td>${indent.status || ""}</td></tr>
        <tr><th align="left">Request Location</th><td>${indent.location?.locationName || ""}</td></tr>
        <tr><th align="left">Requested By</th><td>${indent.user || ""}</td></tr>
        <tr><th align="left">Requested At</th><td>${new Date(indent.createdAt).toLocaleString("en-IN")}</td></tr>
      </table>
    </div>`;

    await sendMail({
      to: toEmails,
      cc: ccEmails,
      subject: `New ${typeLabel} - ${indent.indentNo}`,
      html,
    });

    console.log(`✅ Indent request mail sent for ${indent.indentNo}`);
  } catch (err) {
    console.error("❌ Indent request mail error:", err);
  }
}

module.exports = sendIndentRequestMail;