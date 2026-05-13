const express = require("express");
const router = express.Router();
const CustomerOrder = require("../models/CustomerOrder");
const authMiddleware = require("../middleware/authMiddleware");
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ reply: "Message required" });
    }

    // ==============================
    // 🔥 FETCH DATA FROM DB
    // ==============================
    const orders = await CustomerOrder.find()
      .populate("location")
      .sort({ createdAt: -1 })
      .limit(50);

    // ==============================
    // 🔥 PREPARE CONTEXT
    // ==============================
    const context = orders.map(o => ({
      po: o.purchaseOrderNo,
      customer: o.customerName,
      qty: o.quantity,
      status: o.status,
      type: o.orderType,
      location: o.location?.locationName || "N/A",
      product: o.productCode,
      date: o.createdAt
    }));

    // ==============================
    // 🤖 CALL OPENAI
    // ==============================
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
You are an ERP assistant.

Answer ONLY using the provided data.
Be short and clear.
If user asks for specific field, return only that field.
If data not found, say "No data found".

Data:
${JSON.stringify(context)}
          `
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    });

    const reply = response.choices[0].message.content;

    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "AI error" });
  }
});

module.exports = router;