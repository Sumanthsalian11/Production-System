const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  // host: "172.17.1.10",
  // port: 25,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
   tls: {
    rejectUnauthorized: false,
  },
});

const sendMail = async ({
  to,
  cc,
  subject,
  html,
  attachments = [],
}) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: Array.isArray(to) ? to.join(",") : to,
      cc: Array.isArray(cc) ? cc.join(",") : cc,
      subject,
      html,
      attachments,
    });

    console.log("✅ Email sent successfully.");
  } catch (err) {
    console.error("❌ Email Error:", err);
    throw err;
  }
};

module.exports = sendMail;