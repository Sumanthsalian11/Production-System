 // npm install multer @google/generative-ai (if not already installed)
//
// Mount this router in your main app, e.g.:
//   const ocrHandwritingRoutes = require("./routes/ocrHandwriting.routes");
//   app.use(ocrHandwritingRoutes);
//
// Make sure GEMINI_API_KEY is set in your backend's environment (get one free at
// aistudio.google.com/app/apikey).
//
// IMPORTANT: check https://ai.google.dev/gemini-api/docs/models for the current
// model ID string — the one below may need updating.

const express = require("express");
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const router = express.Router();
// Scanned multi-page PDFs run larger than a single phone photo, so allow more headroom.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MODEL_ID = "gemini-3.6-flash"; // current stable GA flash model as of Aug 2026 — verify against https://ai.google.dev/gemini-api/docs/changelog before deploying, Google's Gemini lineup rotates fairly quickly

// Gemini 3.x Flash defaults to a "medium" thinking level, which adds real latency for a
// fairly mechanical read-the-handwriting-and-return-JSON task. Gemini 3 Flash can't fully
// disable thinking (thinkingLevel has no "none"), but dropping it to "low" cuts response
// time noticeably without a meaningful accuracy hit for this use case. If accuracy suffers
// on tricky handwriting, try "medium" again as a middle ground.
const model = genAI.getGenerativeModel({
  model: MODEL_ID,
  generationConfig: {
    thinkingConfig: { thinkingLevel: "low" },
  },
});

router.post("/api/ocr/handwriting", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image uploaded" });

    const docType = req.body.docType === "reel" ? "reel" : "production";
    let fieldList;
    try {
      fieldList = JSON.parse(req.body.fields || "[]");
    } catch {
      fieldList = [];
    }
    if (!Array.isArray(fieldList) || fieldList.length === 0) {
      return res.status(400).json({ message: "No field list provided" });
    }

    const base64Data = req.file.buffer.toString("base64");
    const isPdf = req.file.mimetype === "application/pdf";
    const mimeType = isPdf
      ? "application/pdf"
      : (req.file.mimetype && req.file.mimetype.startsWith("image/") ? req.file.mimetype : "image/jpeg");

    // Gemini accepts both images and PDFs as inlineData parts — it handles multi-page PDFs
    // natively, no separate PDF-to-image conversion step needed on our side.
    const filePart = { inlineData: { mimeType, data: base64Data } };

    const prompt = `You are reading a page (or pages) from a handwritten paper ledger/register
used in a print/paper mill's ${docType === "reel" ? "Reel Register" : "Production"} log.
The book keeps the same header row across many entries — every row underneath a header is
a separate, complete record. If this is a multi-page PDF, read every page in order; do not
skip pages and do not merge rows from different pages together.

Extract exactly these fields for EVERY row you find: ${fieldList.join(", ")}.

Rules:
- Read digits (especially in dates and numeric fields) very carefully, one at a time. Do not
  infer a digit from context or make it "look right" — if a digit is genuinely ambiguous,
  transcribe your best single reading rather than guessing a different value.
- Return ONLY a raw JSON object. No markdown fences, no commentary, no explanation.
- Shape: {"rows": [ {"<fieldName>": "<value>", ...}, ... ], "extra": "<string>"}
- "rows" must contain one object per handwritten data row found, in the order they appear.
  If there is only one row, still return it as a single-element array.
- Every field in the list above must be a key in each row object, using an empty string ""
  if it isn't visible or can't be confidently read for that row. Do not guess, infer, or
  autocomplete a value that isn't actually legible — copy exactly what is written.
- Dates in this ledger are written as DD/MM/YYYY or DD-MM-YYYY. Transcribe the date EXACTLY
  as handwritten, digit by digit, in that same DD/MM/YYYY order — do NOT reformat, reorder,
  or convert it yourself. Read each digit carefully; do not guess a digit you can't clearly
  make out, and do not "auto-correct" a date to look more plausible.
- "extra" should capture any other clearly labeled handwritten values that appear on the
  page(s) but are NOT in the field list above, formatted as "label: value" pairs separated
  by commas (if this differs per row, prefix each with the row number, e.g. "row1 - job:
  Cub, row2 - job: City"). Use an empty string if there's nothing extra.`;

    const result = await model.generateContent([filePart, prompt]);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Handwriting OCR: model did not return valid JSON:", text);
      return res.status(502).json({ message: "Could not parse handwriting OCR response" });
    }

    let rows = parsed.rows;
    if (!Array.isArray(rows)) {
      // Tolerate a model that ignores the array instruction and returns a single object.
      rows = parsed.fields ? [parsed.fields] : [];
    }

    return res.json({ rows, extra: parsed.extra || "" });
  } catch (err) {
    console.error("Handwriting OCR error:", err);
    if (err.status === 429) {
      return res.status(503).json({ message: "OCR quota exceeded for today — please enter this row manually or try again later" });
    }
    return res.status(500).json({ message: "Handwriting OCR failed" });
  }
});

module.exports = router;