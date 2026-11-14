const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const IndentRequest = require("../models/Indentrequest");
const CustomerOrder = require("../models/CustomerOrder");
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const Item = require("../models/Item");
const IndentRouting = require("../models/IndentRouting");
const Dispatch = require("../models/Dispatch");
const sendIndentRequestMail = require("../utils/indentRequestMail");
const sendInhouseOrderMail = require("../cron/inhouseOrderMail"); // change to the real file name of your inhouse mail file

const mongoose = require("mongoose");
const { PDFDocument, StandardFonts, rgb, degrees } = require("pdf-lib");

async function stampPdf(filePath) {
  const pdf = await PDFDocument.load(fs.readFileSync(filePath), { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ANGLE = 35, TEXT = "SPECIMEN";
  const rad = (ANGLE * Math.PI) / 180;
  pdf.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    const size = Math.min(width, height) * 0.2;
    const w = font.widthOfTextAtSize(TEXT, size);
    const h = size * 0.7;
    page.drawText(TEXT, {
      x: width / 2 - (w / 2) * Math.cos(rad) + (h / 2) * Math.sin(rad),
      y: height / 2 - (w / 2) * Math.sin(rad) - (h / 2) * Math.cos(rad),
      size, font, color: rgb(0.84, 0.27, 0.27), opacity: 0.25, rotate: degrees(ANGLE),
    });
  });
  fs.writeFileSync(filePath, await pdf.save());
}

// runs after multer: stamps uploaded artwork PDFs
async function watermarkUploadedPdfs(req, res, next) {
  const files = ["artwork", "artworkFiles"].flatMap((n) => (req.files && req.files[n]) || []);
  for (const f of files) {
    if (path.extname(f.originalname).toLowerCase() !== ".pdf") continue;
    try { await stampPdf(f.path); } catch (e) { console.error("WATERMARK ERROR:", f.originalname, e.message); }
  }
  next();
}

// no rule for a user = sees every indent (old behaviour);
// a rule = only indents raised by users in the locations the admin assigned
// returns null when there is no rule, otherwise the list of location names
async function allowedLocationNames(userId) {
  const rule = await IndentRouting.findOne({ user: userId }).lean();
  if (!rule) return null;
  const LocationMaster = mongoose.model("LocationMaster");
  const locs = await LocationMaster.find({ _id: { $in: rule.locations || [] } })
    .select("locationName")
    .lean();
  return locs.map((l) => l.locationName).filter(Boolean);
}

const escapeRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function allowedLocationFilter(userId) {
  try {
    const names = await allowedLocationNames(userId);
    if (names === null) return {};
    return {
      userLocations: { $in: names.map((n) => new RegExp("^" + escapeRx(n.trim()) + "$", "i")) }
    };
  } catch (e) {
    return {};
  }
}

// =============================================
// MULTER CONFIG (Customer Copy / Artwork uploads)
// =============================================
const uploadDir = path.join(__dirname, "..", "uploads", "indents");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per file
});

const indentUploadFields = upload.fields([
  { name: "customerCopy", maxCount: 1 },
  { name: "artwork", maxCount: 1 },
  { name: "artworkFiles", maxCount: 20 }
]);

// =============================================
// ARTWORK MANAGEMENT HELPERS (versions)
// =============================================
const ART_STATUSES = ["Pending", "Approved", "Rejected", "Superseded"];

// Builds the artworkVersions array. The browser can only ADD new versions (a new file in artworkFiles).
// Status, comment, reviewer and version number always come from the database / server.
function buildArtworkVersions(req, existingItem, userName, masterVersions) {
  const existing = (existingItem && existingItem.artworkVersions) || [];

  // old clients that do not send artworkMeta: keep whatever is already saved
  if (req.body.artworkMeta === undefined) return existing;

  let meta = [];
  try { meta = JSON.parse(req.body.artworkMeta || "[]"); } catch (e) { meta = []; }
  if (!Array.isArray(meta)) meta = [];

  const files = (req.files && req.files.artworkFiles) || [];
  const added = meta.filter((m) => Number.isInteger(m.fileIndex) && files[m.fileIndex]);
  // versions picked from the item's saved artwork (no file upload; checked against the item master)
  const linked = meta
    .filter((m) => !Number.isInteger(m.fileIndex) && m.filePath)
    .map((m) => (masterVersions || []).find((mv) => mv.filePath === m.filePath))
    .filter((mv, i, arr) => mv && arr.indexOf(mv) === i && !existing.some((v) => v.filePath === mv.filePath));
  if (!added.length && !linked.length) return existing; // nothing new

  const out = existing.map((v) => ({
    version: v.version,
    fileName: v.fileName,
    filePath: v.filePath,
    note: v.note,
    status: v.status,
    comment: v.comment,
    uploadedBy: v.uploadedBy,
    uploadedAt: v.uploadedAt,
    reviewedBy: v.reviewedBy || "",
    reviewedAt: v.reviewedAt || null
  }));

  // an old indent with only the single legacy artwork file: keep it as an approved v1
  if (!out.length && existingItem && existingItem.artwork && existingItem.artwork.filePath) {
    out.push({
      version: 1,
      fileName: existingItem.artwork.fileName,
      filePath: existingItem.artwork.filePath,
      note: "Carried over (earlier upload)",
      status: "Approved",
      comment: "",
      uploadedBy: userName || "",
      uploadedAt: new Date(),
      reviewedBy: "",
      reviewedAt: null
    });
  }

  linked.forEach((mv) => {
    out.forEach((v) => { if (v.status === "Pending") v.status = "Superseded"; });
    const next = out.length ? Math.max(...out.map((v) => v.version || 0)) + 1 : 1;
    out.push({
      version: next,
      fileName: mv.fileName,
      filePath: mv.filePath,
      note: mv.note || "From item artwork V" + mv.version,
      status: "Pending",
      comment: "",
      uploadedBy: mv.uploadedBy || userName || "",
      uploadedAt: mv.uploadedAt || new Date(),
      reviewedBy: "",
      reviewedAt: null
    });
  });

  added.forEach((m) => {
    const f = files[m.fileIndex];
    // a newer upload replaces the older pending one
    out.forEach((v) => { if (v.status === "Pending") v.status = "Superseded"; });
    const next = out.length ? Math.max(...out.map((v) => v.version || 0)) + 1 : 1;
    out.push({
      version: next,
      fileName: f.originalname,
      filePath: "/api/newindent/files/" + f.filename,
      note: String(m.note || "").slice(0, 500),
      status: "Pending",
      comment: "",
      uploadedBy: userName || "",
      uploadedAt: new Date(),
      reviewedBy: "",
      reviewedAt: null
    });
  });

  return out;
}

// the single "artwork" field (used by the table / other pages) follows the best version
function pickLatestArtwork(versions) {
  if (!versions || !versions.length) return null;
  const live = versions.filter((v) => v.status !== "Superseded");
  const v = [...live].reverse().find((x) => x.status === "Approved") || live[live.length - 1] || versions[versions.length - 1];
  return v ? { fileName: v.fileName, filePath: v.filePath } : null;
}

// Serve uploaded indent files
router.use("/files", express.static(uploadDir));

// =============================================
// CREATE NEW INDENT (Saves to IndentRequest Model)
// =============================================
router.post("/", authMiddleware, indentUploadFields, watermarkUploadedPdfs, async (req, res) => {
  try {
    const userId = req.user.id;
    const userData = await User.findById(userId);

    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
      productCode,
      materialType,
      description,
      customerName,
      colorFront,
      colorBack,
      wasteQty,
      jobSize,
      inkDetails,
      quantity,
      location,
      unitRate,
      remark,
      deliveryDate,
      // ===== NEW FIELDS =====
      lamination,
      finish,
      jobNo,
      soNo,
      soDate,
      sampleType,
      costingConfirmation,
      customerPoNo,
      customerPoDate,
      typeOfBilling,
      itemPdfPath,
      millName,
      paperGroup,
      paperSize,
      gsm
    } = req.body;

    const isSample = req.body.indentType === "sample";
    const specification = req.body.specification || "";
    const { sampleRequestType, provisionalCustomerId } = req.body;
    const { productFamily, physicalReference, expectedOrderValue } = req.body;

    let splits = [];
    try { splits = JSON.parse(req.body.splits || "[]"); } catch { splits = []; }
    splits = splits.filter((s) => s && s.location && Number(s.quantity) > 0);
    if (!splits.length && location && quantity) splits = [{ location, quantity }];

    if ((!isSample && !productCode) || !splits.length) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const missing = [];
    if (!String(paperGroup || "").trim())             missing.push("Group");
    if (!String(gsm || "").trim())                    missing.push("GSM");
    if (!String(lamination || "").trim())             missing.push("Lamination");
    if (!String(finish || "").trim())                 missing.push("Finish");
    if (!String(sampleType || "").trim())             missing.push("Sample Type");
    if (!String(req.body.specification || "").trim()) missing.push("Specification");
    if (missing.length) {
      return res.status(400).json({ message: "Required: " + missing.join(", ") });
    }

    // Generate Indent Number (e.g., IND_001)
    const lastIndent = await IndentRequest.findOne(
      isSample ? { indentType: "sample" } : { indentType: { $ne: "sample" } }
    ).sort({ createdAt: -1 });
    let lastNumber = 0;

    if (lastIndent && lastIndent.indentNo) {
      const parts = lastIndent.indentNo.split("_");
      lastNumber = Number(parts[1]) || 0;
    }

    // ===== Uploaded files =====
    const customerCopyFile = req.files?.customerCopy?.[0];
    const artworkFile = req.files?.artwork?.[0];

    const customerCopy = customerCopyFile
      ? {
          fileName: customerCopyFile.originalname,
          filePath: `/api/newindent/files/${customerCopyFile.filename}`
        }
      : { fileName: "", filePath: "" };

    const artwork = artworkFile
      ? {
          fileName: artworkFile.originalname,
          filePath: `/api/newindent/files/${artworkFile.filename}`
        }
      : { fileName: "", filePath: "" };

    // ===== Artwork versions =====
    const artworkVersions = buildArtworkVersions(req, {}, userData.name);

    // nothing uploaded with this indent: carry the item's latest saved artwork (PO reviewer still approves it)
    if (!artworkVersions.length && productCode) {
      const master = await Item.findOne({ itemCode: productCode }).select("artworkVersions").lean();
      const last = master && (master.artworkVersions || []).slice(-1)[0];
      if (last) {
        artworkVersions.push({
          version: last.version,
          fileName: last.fileName,
          filePath: last.filePath,
          note: last.note || "From item artwork V" + last.version,
          status: "Pending",
          comment: "",
          uploadedBy: last.uploadedBy || "",
          uploadedAt: last.uploadedAt || new Date(),
          reviewedBy: "",
          reviewedAt: null
        });
      }
    }
    const latestArt = pickLatestArtwork(artworkVersions);

    const groupId = splits.length > 1 ? "GRP_" + Date.now() + "_" + Math.round(Math.random() * 1e6) : "";
    const savedList = [];

    for (let n = 0; n < splits.length; n++) {
      const indentNo = `${isSample ? "SMP" : "IND"}_${String(lastNumber + 1 + n).padStart(3, "0")}`;

      const indentItem = {
        productCode, materialType, description, customerName, colorFront, colorBack,
        wasteQty, jobSize, inkDetails,
        quantity: Number(splits[n].quantity),
        unitRate: Number(unitRate) || 0,
        remark: remark || "",
        deliveryDate: deliveryDate || null,
        lamination: lamination || "", finish: finish || "", jobNo: jobNo || "", soNo: soNo || "",
        soDate: soDate || null, sampleType: sampleType || "",
        costingConfirmation: costingConfirmation || "",
        customerPoNo: customerPoNo || "", customerPoDate: customerPoDate || null,
        typeOfBilling: typeOfBilling || "", itemPdfPath: itemPdfPath || "",
        millName: millName || "", paperGroup: paperGroup || "", paperSize: paperSize || "", gsm: gsm || "",
        sampleRequestType: sampleRequestType || "",
        provisionalCustomerId:
          sampleRequestType === "new" ? (provisionalCustomerId || "PRV-" + indentNo.split("_")[1]) : "",
        artworkVersions: artworkVersions.map((v) => ({ ...v })),
        customerCopy,
        artwork: latestArt || artwork,
        specification,
        productFamily: productFamily || "",
        physicalReference: physicalReference || "",
        expectedOrderValue: expectedOrderValue || ""
      };

      const doc = new IndentRequest({
        indentNo,
        groupId,
        items: [indentItem],
        location: splits[n].location,
        user: userData.name,
        userEmail: userData.email,
        userLocations: Array.isArray(userData.locations) ? userData.locations : [],
        status: isSample ? "SAMPLE_REQUESTED" : "PENDING_PO",
        indentType: isSample ? "sample" : "production",
        orderType: ""
      });
      savedList.push(await doc.save());
    }

    res.status(201).json(savedList.length === 1 ? savedList[0] : savedList);
    savedList.forEach((s) => sendIndentRequestMail(s._id));

  } catch (err) {
    console.error("CREATE INDENT ERROR:", err);
    res.status(500).json({ message: "Error creating indent" });
  }
});

// =============================================
// GET ALL INDENTS (For New Indent Page)
// =============================================
router.get("/", authMiddleware, async (req, res) => {
  try {
    // no page param = old behaviour (other pages may still call this)
    if (req.query.page === undefined) {
      const indents = await IndentRequest.find()
        .populate("location", "locationName")
        .sort({ createdAt: -1 })
        .lean();
      return res.status(200).json(indents);
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const rx = (s) => new RegExp(escapeRx(String(s)), "i");
    const f = {};
    if (req.query.indentNo) f.indentNo = rx(req.query.indentNo);
    if (req.query.indentNos) {
      f.indentNo = { $in: String(req.query.indentNos).split(",").map((s) => s.trim()).filter(Boolean) };
    }
    if (req.query.productCode) f["items.productCode"] = rx(req.query.productCode);
    if (req.query.customer) f["items.customerName"] = rx(req.query.customer);
    if (req.query.indenter) f.user = req.query.indenter;
    if (req.query.location) f.location = req.query.location;
    if (req.query.from || req.query.to) {
      f.createdAt = {};
      if (req.query.from) f.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) f.createdAt.$lte = new Date(req.query.to);
    }
    if (req.query.productType) {
      f["items.materialType"] = new RegExp("^" + escapeRx(String(req.query.productType).trim()) + "$", "i");
    }
    if (req.query.type === "sample") f.indentType = "sample";
    else if (req.query.type === "production") f.indentType = { $ne: "sample" };
    if (req.query.q) {
      const r = rx(req.query.q);
      f.$or = [
        { indentNo: r },
        { "items.customerName": r },
        { "items.productCode": r },
        { "items.description": r }
      ];
    }

    const filtered = Object.keys(f).length > 0;
    const [data, total, grandTotal] = await Promise.all([
      IndentRequest.find(f)
        .populate("location", "locationName")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      filtered ? IndentRequest.countDocuments(f) : IndentRequest.estimatedDocumentCount(),
      IndentRequest.estimatedDocumentCount()
    ]);
    res.status(200).json({ data, total, grandTotal });
  } catch (err) {
    console.error("FETCH INDENTS ERROR:", err);
    res.status(500).json({ message: "Error fetching indents" });
  }
});

// distinct indenters for the filter dropdown
router.get("/indenters", authMiddleware, async (req, res) => {
  try {
    const users = await IndentRequest.distinct("user");
    res.status(200).json(users.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: "Error fetching indenters" });
  }
});

// one indent by id (used when Track is opened from another page)
router.get("/by-id/:id", authMiddleware, async (req, res) => {
  try {
    const ind = await IndentRequest.findById(req.params.id)
      .populate("location", "locationName")
      .lean();
    if (!ind) return res.status(404).json({ message: "Indent not found" });
    res.status(200).json(ind);
  } catch (err) {
    res.status(500).json({ message: "Error fetching indent" });
  }
});

// the logged-in user's indents that have artwork updates (feeds the bell)
router.get("/my-artwork-updates", authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select("name");
    if (!me) return res.status(200).json([]);
    const list = await IndentRequest.find({
      user: me.name,
      status: { $in: ["PENDING_PO", "SAMPLE_REQUESTED", "REJECTED"] },
      "items.artworkVersions.status": { $in: ["Rejected", "Approved"] }
    })
      .populate("location", "locationName")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: "Error fetching artwork updates" });
  }
});

// =============================================
// GET PENDING INDENTS (For Purchase Order Page)
// =============================================

router.get("/requests", authMiddleware, async (req, res) => {
  try {
    const locFilter = await allowedLocationFilter(req.user.id);
    const indents = await IndentRequest.find({
      status: { $in: ["PENDING_PO", "SAMPLE_REQUESTED"] },
      ...locFilter
    })
    .populate("location", "locationName")
    .sort({ createdAt: -1 });

    res.status(200).json(indents);
  } catch (err) {
    console.error("FETCH PENDING INDENTS ERROR:", err);
    res.status(500).json({ message: "Error fetching pending indents" });
  }
});
// =============================================
// INDENTS WITH ARTWORK WAITING FOR REVIEW (production + sample)
// =============================================
router.get("/artwork-pending", authMiddleware, async (req, res) => {
  try {
    const indents = await IndentRequest.find({
      status: { $in: ["PENDING_PO", "SAMPLE_REQUESTED"] },
      "items.artworkVersions.status": "Pending",
      ...(await allowedLocationFilter(req.user.id))
    })
      .populate("location", "locationName")
      .sort({ createdAt: -1 });
    res.status(200).json(indents);
  } catch (err) {
    console.error("FETCH PENDING ARTWORK ERROR:", err);
    res.status(500).json({ message: "Error fetching pending artwork" });
  }
});

// =============================================
// PROCESS INDENT -> CONVERT TO CUSTOMER ORDER
// =============================================
router.put("/process/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { orderType, remarks, purchaseOrderNo, poDate, expectedDeliveryDate, planningLocation } = req.body;
    const wastePct = Math.max(0, Number(req.body.wastePct) || 0);
    
    const userId = req.user.id;
    const userData = await User.findById(userId);

    // 1. Find the indent request
    const indent = await IndentRequest.findById(id).populate("location");
    
    if (!indent) {
      return res.status(404).json({ message: "Indent not found" });
    }

    const allowedNames = await allowedLocationNames(userId);
    if (allowedNames !== null) {
      const mine = (indent.userLocations || []).map((s) => String(s).trim().toLowerCase());
      const ok = allowedNames.some((n) => mine.includes(String(n).trim().toLowerCase()));
      if (!ok) {
        return res.status(403).json({ message: "This indent's user location is not assigned to you" });
      }
    }

    if (!["PENDING_PO", "SAMPLE_REQUESTED"].includes(indent.status)) {
      return res.status(400).json({ message: "Indent already processed" });
    }

    // 2. Validate based on order type
    if (!orderType) {
      return res.status(400).json({ message: "Order type is required" });
    }

    // Production indents need an approved artwork version (samples are exempt).
    // Old indents that only have the single legacy artwork file are allowed through.
    if (indent.indentType !== "sample") {
      const it0 = (indent.items && indent.items[0]) || {};
      const vers0 = it0.artworkVersions || [];
      const legacyOnly = !vers0.length && it0.artwork && it0.artwork.filePath;
      if (!legacyOnly && !vers0.some((v) => v.status === "Approved")) {
        return res.status(400).json({ message: "Artwork is not approved yet. Approve an artwork version first." });
      }
    }

    // indents saved together (same groupId) become ONE order with the quantities added up
    let groupDocs = [indent];
    if (indent.groupId) {
      const sibs = await IndentRequest.find({
        groupId: indent.groupId,
        _id: { $ne: indent._id },
        status: { $in: ["PENDING_PO", "SAMPLE_REQUESTED"] }
      }).populate("location");
      groupDocs = [indent, ...sibs];
    }
    const totalQty = groupDocs.reduce((s, d) => s + (Number(d.items?.[0]?.quantity) || 0), 0);
    const locationSplits = groupDocs.map((d) => ({
      location: d.location?._id || d.location,
      locationName: d.location?.locationName || "",
      quantity: Number(d.items?.[0]?.quantity) || 0
    }));

    // 3. Process each item in the indent
    const createdOrders = [];
    const mailOrders = [];
    
    for (const item of indent.items) {
      const orderData = {
        productCode: item.productCode,
        materialType: item.materialType,
        description: item.description,
        customerName: item.customerName,
        colorFront: item.colorFront === "" || item.colorFront == null ? "0" : item.colorFront,
        colorBack: item.colorBack === "" || item.colorBack == null ? "0" : item.colorBack,
        wasteQty: item.wasteQty,
        jobSize: item.jobSize,
        inkDetails: item.inkDetails,
        quantity: wastePct > 0
          ? Math.ceil(totalQty + (totalQty * wastePct) / 100)
          : totalQty,
        locationSplits,
        orderWastePct: wastePct,
        estimatedCost: Math.max(0, Number(req.body.estimatedCost) || 0),
        location: indent.location?._id || indent.location,
        orderType: orderType,
        remarks: remarks || "",
        remarks2: req.body.remarks2 || "",
        user: userData?.name || "System",
        userLocations:
          orderType === "Inhouse" && planningLocation
            ? [planningLocation]
            : userData?.locations || [],
        status: "ORDER_RECEIVED",
        source: "purchaseOrder",
        // Link back to indent
        indentNo: indent.indentNo,
        // ===== NEW FIELDS PASSED THROUGH =====
        lamination: item.lamination || "",
        finish: item.finish || "",
        jobNo: item.jobNo || "",
        soNo: item.soNo || "",
        soDate: item.soDate || null,
        sampleType: item.sampleType || "",
        costingConfirmation: item.costingConfirmation || "",
        customerPoNo: item.customerPoNo || "",
        customerPoDate: item.customerPoDate || null,
        typeOfBilling: item.typeOfBilling || "",
        itemPdfPath: item.itemPdfPath || "",
        millName: item.millName || "",
        paperGroup: item.paperGroup || "",
        paperSize: item.paperSize || "",
        gsm: item.gsm || "",
        specification: item.specification || "",
        artwork: (() => {
          const vs = item.artworkVersions || [];
          const a = [...vs].reverse().find((v) => v.status === "Approved");
          if (a) return { fileName: a.fileName, filePath: a.filePath };
          if (item.artwork && item.artwork.filePath) return { fileName: item.artwork.fileName, filePath: item.artwork.filePath };
          return { fileName: "", filePath: "" };
        })()
      };

      // Add PO fields for Inhouse/Stationary
     if (purchaseOrderNo) {
        orderData.purchaseOrderNo = purchaseOrderNo;
        orderData.poDate = poDate;
      }
      if (expectedDeliveryDate) {
        orderData.expectedDeliveryDate = expectedDeliveryDate;
      }

      // Generate ticket number for Inhouse orders
      const ticketPrefixMap = { Inhouse: "IH", "Out Source": "OS" };
      const ticketPrefix = ticketPrefixMap[orderType];
      if (ticketPrefix) {
        const lastOrder = await CustomerOrder.find({
          orderType,
          ticketNo: { $regex: "^" + ticketPrefix + "_" }
        }).sort({ createdAt: -1 }).limit(1);

        let lastNumber = 0;
        if (lastOrder.length > 0 && lastOrder[0].ticketNo) {
          const parts = lastOrder[0].ticketNo.split("_");
          lastNumber = Number(parts[parts.length - 1]) || 0;
        }
        orderData.ticketNo = `${ticketPrefix}_${String(lastNumber + 1).padStart(2, "0")}`;
      }
      const newOrder = new CustomerOrder(orderData);
      const savedOrder = await newOrder.save();
      createdOrders.push(savedOrder);

      const mailArt =
        item.artwork && item.artwork.filePath
          ? { filePath: item.artwork.filePath, fileName: item.artwork.fileName }
          : item.itemPdfPath
          ? { filePath: item.itemPdfPath, fileName: "" }
          : null;
      mailOrders.push({
        ...savedOrder.toObject(),
        location: indent.location,
        indentType: indent.indentType,
        artworkPath: mailArt ? mailArt.filePath : "",
        artworkName: mailArt ? mailArt.fileName : ""
      });
    }

    // 4. Update indent status
    for (const d of groupDocs) {
      d.status = "APPROVED";
      d.orderType = orderType;
      d.approvedAt = new Date();
      await d.save();
    }

    res.status(200).json({
      message: "Indent processed successfully",
      indentNo: indent.indentNo,
      ordersCreated: createdOrders.length,
      orders: createdOrders
    });

    if (orderType === "Inhouse") {
      sendInhouseOrderMail(mailOrders, planningLocation || "");
    }

  } catch (err) {
    console.error("PROCESS INDENT ERROR:", err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "PO Number already exists" });
    }
    res.status(500).json({ message: "Error processing indent" });
  }
});

// =============================================
// REJECT INDENT (Optional)
// =============================================
router.put("/reject/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const indent = await IndentRequest.findByIdAndUpdate(
      id,
      { 
        status: "REJECTED",
        remark: reason || "Rejected"
      },
      { new: true }
    );

    if (!indent) {
      return res.status(404).json({ message: "Indent not found" });
    }

    res.status(200).json({ message: "Indent rejected", indent });

  } catch (err) {
    console.error("REJECT INDENT ERROR:", err);
    res.status(500).json({ message: "Error rejecting indent" });
  }
});

// =============================================
// TRACKING (stage pipeline, hold / resume, undo)
// =============================================
// =============================================
// OUT SOURCE / PMS TRACKING (ticket + dispatches)
// =============================================
// indentNo -> ticket numbers, for the Track table
router.get("/external-tickets", authMiddleware, async (req, res) => {
  try {
    const wanted = String(req.query.indentNos || "").split(",").map((s) => s.trim()).filter(Boolean);
    const orders = await CustomerOrder.find({
      orderType: "Out Source",
      indentNo: wanted.length ? { $in: wanted } : { $exists: true, $ne: "" },
      ticketNo: { $exists: true, $ne: "" }
    }).select("indentNo ticketNo quantity").lean();

    const sent = await Dispatch.aggregate([
      { $match: { ticketNo: { $in: orders.map((o) => o.ticketNo) } } },
      { $group: { _id: "$ticketNo", qty: { $sum: "$dispatchQty" } } }
    ]);
    const sentBy = {};
    sent.forEach((s) => { sentBy[s._id] = s.qty; });

    const map = {};
    orders.forEach((o) => {
      const m = (map[o.indentNo] = map[o.indentNo] || { tickets: [], totalQty: 0, dispatchedQty: 0 });
      m.tickets.push(o.ticketNo);
      m.totalQty += Number(o.quantity) || 0;
      m.dispatchedQty += Number(sentBy[o.ticketNo]) || 0;
    });
    res.status(200).json(map);
  } catch (err) {
    console.error("EXTERNAL TICKETS ERROR:", err);
    res.status(500).json({ message: "Error fetching tickets" });
  }
});

// one indent: its Out Source / PMS ticket(s) with the dispatch entries
router.get("/external-track/:indentNo", authMiddleware, async (req, res) => {
  try {
    const orders = await CustomerOrder.find({
      indentNo: req.params.indentNo,
      orderType: "Out Source",
      ticketNo: { $exists: true, $ne: "" }
    })
      .select("ticketNo orderType quantity remarks purchaseOrderNo poDate expectedDeliveryDate createdAt")
      .lean();

    const result = [];
    for (const o of orders) {
      const dispatches = await Dispatch.find({ ticketNo: o.ticketNo })
        .sort({ dispatchDate: 1, createdAt: 1 })
        .lean();
      const dispatchedQty = dispatches.reduce((s, d) => s + Number(d.dispatchQty || 0), 0);
      const totalQty = Number(o.quantity) || 0;
      result.push({
        ticketNo: o.ticketNo,
        orderType: o.orderType,
        supplier: o.remarks || "",
        purchaseOrderNo: o.purchaseOrderNo || "",
        poDate: o.poDate || null,
        expectedDeliveryDate: o.expectedDeliveryDate || null,
        totalQty,
        dispatchedQty,
        balanceQty: Math.max(0, totalQty - dispatchedQty),
        dispatches
      });
    }
    res.status(200).json({ orders: result });
  } catch (err) {
    console.error("EXTERNAL TRACK ERROR:", err);
    res.status(500).json({ message: "Error fetching tracking" });
  }
});

const PIPE = {
  production: [
    ["raised", "Indent raised"], ["po", "PO received"], ["appr", "Approved for production"],
    ["wo", "Work order generated"], ["print", "Printing"], ["post", "Finishing"],
    ["qc", "Quality check"], ["disp", "Dispatched"], ["done", "Delivered"]
  ],
  sample: [
    ["req", "Sample requested"], ["art", "Artwork approved"], ["cost", "Costing confirmed"],
    ["wo", "Work order generated"], ["print", "Printing"], ["qc", "Quality check"],
    ["sent", "Sample sent"], ["sign", "Customer sign-off"]
  ]
};
const TRACK_EX = {
  po: ["Customer PO no"], wo: ["Work order no"], print: ["Machine"],
  disp: ["Challan / LR no"], sent: ["Courier / AWB no"], sign: ["Outcome"]
};

function baseTrackLog(indent) {
  const item = (indent.items && indent.items[0]) || {};
  const isSample = indent.indentType === "sample";
  const P = PIPE[isSample ? "sample" : "production"];
  const log = [{ stage: P[0][0], at: indent.createdAt || new Date(), by: indent.user || "", note: "" }];
  if (!isSample) {
    if (item.customerPoNo || indent.status === "APPROVED") {
      log.push({ stage: "po", at: indent.createdAt || new Date(), by: indent.user || "",
                 note: item.customerPoNo ? "Customer PO no: " + item.customerPoNo : "" });
    }
    if (indent.status === "APPROVED") {
      log.push({ stage: "appr", at: indent.approvedAt || new Date(), by: indent.user || "", note: "" });
    }
  }
  return log;
}

router.put("/:id/track", authMiddleware, async (req, res) => {
  try {
    const { action, details, note, reason } = req.body;
    const indent = await IndentRequest.findById(req.params.id);
    if (!indent) return res.status(404).json({ message: "Indent not found" });

    const user = await User.findById(req.user.id);
    const P = PIPE[indent.indentType === "sample" ? "sample" : "production"];

    if (!indent.trackLog || !indent.trackLog.length) indent.trackLog = baseTrackLog(indent);
    const curIdx = Math.max(0, P.findIndex((s) => s[0] === indent.trackLog[indent.trackLog.length - 1].stage));

    if (action === "hold") {
      indent.holdReason = (reason || "").trim() || "No reason given";
    } else if (action === "resume") {
      indent.holdReason = "";
    } else if (action === "undo") {
      if (indent.trackLog.length > 1) indent.trackLog.pop();
    } else if (action === "advance") {
      if (indent.holdReason) return res.status(400).json({ message: "Indent is on hold. Resume it first." });
      const nx = P[curIdx + 1];
      if (!nx) return res.status(400).json({ message: "Final stage already reached" });

      const d = details || {};
      const need = TRACK_EX[nx[0]] || [];
      if (need.some((l) => !String(d[l] || "").trim())) {
        return res.status(400).json({ message: "Fill every field marked * to move to this stage." });
      }
      const parts = need.map((l) => `${l}: ${String(d[l]).trim()}`);
      if (note && note.trim()) parts.push(note.trim());
      indent.trackLog.push({ stage: nx[0], at: new Date(), by: (user && user.name) || "", note: parts.join("; ") });
    } else {
      return res.status(400).json({ message: "Unknown tracking action" });
    }

    await indent.save();
    res.status(200).json(indent);
  } catch (err) {
    console.error("TRACK ERROR:", err);
    res.status(500).json({ message: "Error updating tracking" });
  }
});

// =============================================
// ARTWORK REVIEW (PO reviewer approves / rejects one version)
// =============================================
router.put("/:id/artwork-review", authMiddleware, async (req, res) => {
  try {
    const { version, action, comment } = req.body;
    const verdict = action === "approve" ? "Approved" : action === "reject" ? "Rejected" : null;
    if (!verdict) return res.status(400).json({ message: "Unknown review action" });

    const cmt = String(comment || "").trim();
    if (verdict === "Rejected" && !cmt) {
      return res.status(400).json({ message: "A comment is required to reject artwork" });
    }

    const reviewer = await User.findById(req.user.id);
    if (!reviewer) return res.status(404).json({ message: "User not found" });
    // TODO role check: allow only PO reviewers here, e.g.
    // if (reviewer.role !== "PO") return res.status(403).json({ message: "Not allowed" });

    const indent = await IndentRequest.findById(req.params.id);
    if (!indent) return res.status(404).json({ message: "Indent not found" });
    if (indent.status === "APPROVED" || indent.status === "REJECTED") {
      return res.status(400).json({ message: "Indent already processed" });
    }

    const item = indent.items && indent.items[0];
    const target = item && (item.artworkVersions || []).find((v) => Number(v.version) === Number(version));
    if (!target) return res.status(404).json({ message: "Artwork version not found" });
    if (target.status !== "Pending") {
      return res.status(400).json({ message: "Only a pending version can be reviewed" });
    }

    // only one approved version is live at a time
    if (verdict === "Approved") {
      item.artworkVersions.forEach((v) => {
        if (v !== target && v.status === "Approved") v.status = "Superseded";
      });
    }

    target.status = verdict;
    target.comment = cmt;
    target.reviewedBy = reviewer.name;
    target.reviewedAt = new Date();

    const best = pickLatestArtwork(item.artworkVersions);
    if (best) item.artwork = best;

    indent.markModified("items");
    await indent.save();

    if (indent.groupId) {
      const sibs = await IndentRequest.find({ groupId: indent.groupId, _id: { $ne: indent._id } });
      for (const s of sibs) {
        const it = s.items && s.items[0];
        const t = it && (it.artworkVersions || []).find((v) => Number(v.version) === Number(version) && v.status === "Pending");
        if (!t) continue;
        if (verdict === "Approved") {
          it.artworkVersions.forEach((v) => { if (v !== t && v.status === "Approved") v.status = "Superseded"; });
        }
        t.status = verdict; t.comment = cmt; t.reviewedBy = reviewer.name; t.reviewedAt = new Date();
        const b = pickLatestArtwork(it.artworkVersions);
        if (b) it.artwork = b;
        s.markModified("items");
        await s.save();
      }
    }

    const fresh = await IndentRequest.findById(indent._id).populate("location", "locationName");
    res.status(200).json(fresh);
  } catch (err) {
    console.error("ARTWORK REVIEW ERROR:", err);
    res.status(500).json({ message: "Error reviewing artwork" });
  }
});

router.put("/:id", authMiddleware, indentUploadFields, watermarkUploadedPdfs, async (req, res) => {
  try {
    const {
      productCode,
      materialType,
      description,
      customerName,
      colorFront,
      colorBack,
      wasteQty,
      jobSize,
      inkDetails,
      quantity,
      location,
      unitRate,
      remark,
      deliveryDate,
      // ===== NEW FIELDS =====
      lamination,
      finish,
      jobNo,
      soNo,
      soDate,
      sampleType,
      costingConfirmation,
      customerPoNo,
      customerPoDate,
      typeOfBilling,
      itemPdfPath,
      millName,
      paperGroup,
      paperSize,
      gsm
    } = req.body;

    const indent = await IndentRequest.findById(req.params.id);

    if (!indent) {
      return res.status(404).json({
        message: "Indent not found"
      });
    }

    const missing = [];
    if (!String(paperGroup || "").trim())             missing.push("Group");
    if (!String(gsm || "").trim())                    missing.push("GSM");
    if (!String(lamination || "").trim())             missing.push("Lamination");
    if (!String(finish || "").trim())                 missing.push("Finish");
    if (!String(sampleType || "").trim())             missing.push("Sample Type");
    if (!String(sampleType || "").trim())             missing.push("Sample Type");
    if (!String(req.body.specification || "").trim()) missing.push("Specification");
    if (missing.length) {
      return res.status(400).json({ message: "Required: " + missing.join(", ") });
    }

    indent.location = location;
    const specification = req.body.specification || "";

    const existingItem = indent.items?.[0] || {};

    const editor = await User.findById(req.user.id);
    const masterDoc = productCode
      ? await Item.findOne({ itemCode: productCode }).select("artworkVersions").lean()
      : null;
    const artworkVersions = buildArtworkVersions(req, existingItem, editor && editor.name, (masterDoc && masterDoc.artworkVersions) || []);
    const latestArt = pickLatestArtwork(artworkVersions);
    const { sampleRequestType, provisionalCustomerId } = req.body;
    const { productFamily, physicalReference, expectedOrderValue } = req.body;

    const customerCopyFile = req.files?.customerCopy?.[0];
    const artworkFile = req.files?.artwork?.[0];

    const customerCopy = customerCopyFile
      ? {
          fileName: customerCopyFile.originalname,
          filePath: `/api/newindent/files/${customerCopyFile.filename}`
        }
      : existingItem.customerCopy || { fileName: "", filePath: "" };

    const artwork = artworkFile
      ? {
          fileName: artworkFile.originalname,
          filePath: `/api/newindent/files/${artworkFile.filename}`
        }
      : existingItem.artwork || { fileName: "", filePath: "" };

    indent.items = [
      {
        productCode,
        materialType,
        description,
        customerName,
        colorFront,
        colorBack,
        wasteQty,
        jobSize,
        inkDetails,
        quantity,
        unitRate,
        remark,
        deliveryDate,
        // ===== NEW FIELDS =====
        lamination,
        finish,
        jobNo,
        soNo,
        soDate,
        sampleType,
        costingConfirmation,
        customerPoNo,
        customerPoDate,
        typeOfBilling,
        itemPdfPath: itemPdfPath || existingItem.itemPdfPath || "",
        millName,
        paperGroup,
        paperSize,
        gsm,
        customerCopy,
        artwork: latestArt || artwork,
        specification,
        productFamily: productFamily || "",
        physicalReference: physicalReference || "",
        expectedOrderValue: expectedOrderValue || "",
        sampleRequestType: sampleRequestType || "",
        provisionalCustomerId:
          sampleRequestType === "new"
            ? (provisionalCustomerId || "PRV-" + String(indent.indentNo || "").split("_")[1])
            : "",
        artworkVersions
      }
    ];

    await indent.save();

    res.status(200).json({
      message: "Indent updated successfully",
      indent
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error updating indent"
    });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const indent = await IndentRequest.findById(req.params.id);

    if (!indent) {
      return res.status(404).json({
        message: "Indent not found"
      });
    }

    await IndentRequest.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: "Indent deleted successfully"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error deleting indent"
    });
  }
});

module.exports = router;