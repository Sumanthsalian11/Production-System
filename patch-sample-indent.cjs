#!/usr/bin/env node
/*
  Adds to the New Indent page:
    - "Sample Request" radio (customer + product type dropdowns from master, product code optional,
      Sample Details section, Sample Costing section)
    - "Artwork Management" section (versions, approve / reject) replacing the single Artwork upload
  Patches 3 files: NewIndent.jsx, the newindent routes file, Indentrequest.js (model).

  Run it from the folder that contains BOTH frontend and backend:
      cd E:\company\Production_System
      node patch-sample-indent.cjs
  (or:  node patch-sample-indent.cjs E:\company\Production_System)

  - A backup "<file>.bak-before-sample" is made next to every file it changes.
  - Each file is all-or-nothing: if any anchor text does not match exactly once, that file is NOT touched
    and the script tells you which anchor failed.
  - Safe to run twice: already patched files are skipped.
*/
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const SKIP = new Set(["node_modules", ".git", "dist", "build", "uploads", ".vite"]);

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (/\.(jsx|js)$/i.test(e.name)) out.push(path.join(dir, e.name));
  }
  return out;
}

function patchFile(file, marker, steps) {
  const raw = fs.readFileSync(file, "utf8");
  const crlf = raw.includes("\r\n");
  const text = raw.replace(/\r\n/g, "\n");

  if (text.includes(marker)) { console.log("[skip] already patched: " + file); return true; }

  const edits = [];
  const problems = [];

  for (const step of steps) {
    const name = step[0], find = step[1], repl = step[2];
    const hits = [];
    if (typeof find === "string") {
      let i = text.indexOf(find);
      while (i !== -1) { hits.push({ start: i, end: i + find.length, match: find }); i = text.indexOf(find, i + find.length); }
    } else {
      const re = new RegExp(find.source, find.flags.replace("g", "") + "g");
      let m;
      while ((m = re.exec(text)) !== null) {
        hits.push({ start: m.index, end: m.index + m[0].length, match: m[0] });
        if (m[0].length === 0) re.lastIndex++;
      }
    }
    if (hits.length !== 1) { problems.push(name + "  -> found " + hits.length + " times (needs exactly 1)"); continue; }
    const h = hits[0];
    edits.push({ name, start: h.start, end: h.end, out: typeof repl === "function" ? repl(h.match) : repl });
  }

  edits.sort((a, b) => a.start - b.start);
  for (let i = 1; i < edits.length; i++) {
    if (edits[i].start < edits[i - 1].end) problems.push("overlap: " + edits[i - 1].name + " / " + edits[i].name);
  }

  if (problems.length) {
    console.log("[FAILED] " + file + " was NOT changed. Problems:");
    problems.forEach((p) => console.log("   - " + p));
    return false;
  }

  let out = text;
  for (let i = edits.length - 1; i >= 0; i--) {
    out = out.slice(0, edits[i].start) + edits[i].out + out.slice(edits[i].end);
  }
  if (crlf) out = out.replace(/\n/g, "\r\n");

  const bak = file + ".bak-before-sample";
  if (!fs.existsSync(bak)) fs.copyFileSync(file, bak);
  fs.writeFileSync(file, out, "utf8");
  console.log("[ok] patched " + file + "  (" + edits.length + " edits)");
  return true;
}

// ---------- locate the three files ----------
const all = walk(root, []);
const jsxFiles = all.filter((f) => path.basename(f).toLowerCase() === "newindent.jsx");
const modelFiles = all.filter((f) => path.basename(f).toLowerCase() === "indentrequest.js");
const routeFiles = all.filter((f) => {
  if (!/\.js$/i.test(f)) return false;
  try { return fs.readFileSync(f, "utf8").includes("indentUploadFields"); } catch (e) { return false; }
});

function pick(label, list) {
  if (list.length === 0) { console.log("[missing] could not find " + label + " under " + root); return null; }
  if (list.length > 1) { console.log("[note] several " + label + " found, using the first:\n   " + list.join("\n   ")); }
  return list[0];
}

const jsx = pick("NewIndent.jsx", jsxFiles);
const model = pick("Indentrequest.js (model)", modelFiles);
const routes = pick("newindent routes file", routeFiles);

// =====================================================================
//  FRONTEND  - NewIndent.jsx
// =====================================================================
const wrapHide = (m) => '{searchMode !== "sample" && (\n' + m + '\n)}';
const wrapRe = (label) =>
  new RegExp('<PoField className="[^"]*"\\s+icon="[^"]*"\\s+label="' + label + '"[\\s\\S]*?<\\/PoField>');
const inputRe = (f) =>
  new RegExp('<input\\s+className="po-input"\\s+value=\\{form\\.' + f + '\\}\\s+title=\\{form\\.' + f + '\\}\\s+readOnly\\s*\\/>');
const editableInput = (f) =>
  '<input name="' + f + '" className="po-input" value={form.' + f + '} title={form.' + f +
  '} readOnly={searchMode !== "sample"} onChange={handleChange} />';

const J_STATE = `const [existingArtwork, setExistingArtwork] = useState(null);

  // ===== ARTWORK MANAGEMENT (versions) =====
  // each version: { version, file (new upload only), fileName, filePath, note, status, comment, uploadedBy, uploadedAt }
  const [artworkVersions, setArtworkVersions] = useState([]);
  const [awFile, setAwFile] = useState(null);
  const [awNote, setAwNote] = useState("");
  const [awReview, setAwReview] = useState("");
  const awFileInputRef = useRef(null);`;

const J_MATERIAL_TYPES = `// product types available in the Items master (used by the Sample Request dropdown)
  const materialTypeOptions = useMemo(
    () =>
      [...new Set(itemList.map((it) => norm(it.materialType)).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      ),
    [itemList]
  );

  // only the products of the chosen customer`;

const J_SAMPLE_EARLY_RETURN = `// Sample Request: product code is optional free text and must not overwrite customer / type
      if (searchMode === "sample") {
        setErrors(prev => ({ ...prev, productCode: "" }));
        setForm(prev => ({ ...prev, productCode: newValue }));
        return;
      }

      if (!newValue) {`;

const J_RESET_ART = `setExistingArtwork(null);
    setArtworkVersions([]);
    setAwFile(null);
    setAwNote("");
    setAwReview("");
    if (awFileInputRef.current) awFileInputRef.current.value = "";`;

const J_EDIT_ART = `setExistingArtwork(item.artwork?.filePath ? item.artwork : null);

    // artwork versions (an old single artwork is shown as an approved v1 so it is not lost)
    const vers = (item.artworkVersions || []).map((v) => ({ ...v, file: null }));
    if (!vers.length && item.artwork?.filePath) {
      vers.push({
        version: 1,
        file: null,
        fileName: item.artwork.fileName,
        filePath: item.artwork.filePath,
        note: "Carried over (earlier upload)",
        status: "Approved",
        comment: "",
        uploadedBy: ind.user || "",
        uploadedAt: ind.createdAt
      });
    }
    setArtworkVersions(vers);
    setAwFile(null);
    setAwNote("");
    setAwReview("");
    setSearchMode(ind.indentType === "sample" ? "sample" : "code");`;

const J_SUBMIT = `if (artworkFile) formData.append("artwork", artworkFile);

      // artwork versions: details as JSON, newly picked files appended in the same order
      const newArtFiles = [];
      const artMeta = artworkVersions.map((v) => {
        let fileIndex = null;
        if (v.file) { fileIndex = newArtFiles.length; newArtFiles.push(v.file); }
        const { file, ...rest } = v;
        return { ...rest, fileIndex };
      });
      formData.append("artworkMeta", JSON.stringify(artMeta));
      newArtFiles.forEach((f) => formData.append("artworkFiles", f));
      formData.append("indentType", searchMode === "sample" ? "sample" : "production");`;

const J_VALID_DELIVERY = `if (!form.deliveryDate) newErrors.deliveryDate = "Required";
    if (searchMode === "sample") {
      if (!form.sampleRequestType) newErrors.sampleRequestType = "Required";
      if (!form.sampleType) newErrors.sampleType = "Required";
    } else if (REQUIRE_APPROVED_ARTWORK && !artworkVersions.some((v) => v.status === "Approved")) {
      newErrors.artwork = "This production indent needs an approved artwork version. Upload a version and click Approve.";
      Swal.fire({
        icon: "warning",
        title: "Artwork approval needed",
        text: "Upload an artwork version and approve it, or use Sample Request.",
        confirmButtonColor: "#3085d6"
      });
    }`;

const J_HELPERS = `// ===== SAMPLE REQUEST helpers =====
  const PRODUCT_FIELDS_BLANK = {
    productCode: "", materialType: "", description: "", customerName: "",
    colorFront: "", colorBack: "", wasteQty: "", jobSize: "", inkDetails: "", itemPdfPath: ""
  };

  // switching to / from Sample Request starts the product block clean
  const switchMode = (m) => {
    const touchesSample = searchMode === "sample" || m === "sample";
    setSearchMode(m);
    if (touchesSample) {
      setForm((prev) => ({ ...prev, ...PRODUCT_FIELDS_BLANK, sampleRequestType: "", provisionalCustomerId: "" }));
      setCustSearch("");
      setDescSearch("");
      setErrors({});
    }
  };

  const handleRequestTypeChange = (e) => {
    const v = e.target.value;
    setErrors((prev) => ({ ...prev, sampleRequestType: "" }));
    setForm((prev) => ({
      ...prev,
      sampleRequestType: v,
      // a brand-new customer is not in the master yet, so the name is typed instead of picked
      customerName: v === "new" || prev.sampleRequestType === "new" ? "" : prev.customerName,
      provisionalCustomerId: v === "new" ? prev.provisionalCustomerId : ""
    }));
  };

  // customer is a master dropdown in Sample Request, except for a brand-new customer
  const custIsSelect = searchMode === "sample" && form.sampleRequestType !== "new";

  // ===== ARTWORK MANAGEMENT helpers =====
  const awBadge = (s) =>
    "custom-badge " +
    (s === "Approved" ? "badge-approved" : s === "Rejected" ? "badge-rejected" : s === "Pending" ? "badge-pending" : "badge-secondary");

  const liveArtwork = artworkVersions.filter((v) => v.status !== "Superseded");
  const latestArtwork = liveArtwork[liveArtwork.length - 1] || artworkVersions[artworkVersions.length - 1] || null;

  const addArtworkVersion = () => {
    if (!awFile) { awFileInputRef.current?.focus(); return; }
    setArtworkVersions((prev) => {
      const nextNo = prev.length ? Math.max(...prev.map((v) => v.version)) + 1 : 1;
      // a newer upload replaces the previous pending one
      const older = prev.map((v) => (v.status === "Pending" ? { ...v, status: "Superseded" } : v));
      return [
        ...older,
        {
          version: nextNo,
          file: awFile,
          fileName: awFile.name,
          filePath: "",
          note: awNote,
          status: "Pending",
          comment: "",
          uploadedBy: loggedInUser,
          uploadedAt: new Date().toISOString()
        }
      ];
    });
    setErrors((prev) => ({ ...prev, artwork: "" }));
    setAwFile(null);
    setAwNote("");
    if (awFileInputRef.current) awFileInputRef.current.value = "";
  };

  const reviewArtwork = (version, status) => {
    setArtworkVersions((prev) =>
      prev.map((v) => {
        if (v.version === version) return { ...v, status, comment: awReview };
        // only one approved version is live at a time
        if (status === "Approved" && v.status === "Approved") return { ...v, status: "Superseded" };
        return v;
      })
    );
    setErrors((prev) => ({ ...prev, artwork: "" }));
    setAwReview("");
  };

  // ---- Double-click protection for Save Indent ----`;

const J_RADIO = (m) => m +
`
                    <div className="form-check form-check-inline m-0">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="productSearchMode"
                        id="psm-sample"
                        checked={searchMode === "sample"}
                        onChange={() => switchMode("sample")}
                      />
                      <label className="form-check-label fw-bold" htmlFor="psm-sample">
                        Sample Request
                      </label>
                    </div>`;

const J_MATERIAL_INPUT = `{searchMode === "sample" ? (
                      <select
                        name="materialType"
                        className="po-input"
                        value={form.materialType}
                        title={form.materialType}
                        onChange={handleChange}
                      >
                        <option value="">Select Product Type</option>
                        {form.materialType && !materialTypeOptions.includes(form.materialType) && (
                          <option value={form.materialType}>{form.materialType}</option>
                        )}
                        {materialTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : (
                      <input className="po-input" value={form.materialType} title={form.materialType} readOnly />
                    )}`;

const J_CUSTOMER_INPUT = `{custIsSelect ? (
                      <select
                        name="customerName"
                        className="po-input"
                        value={form.customerName}
                        title={form.customerName}
                        onChange={handleChange}
                      >
                        <option value="">Select Customer</option>
                        {form.customerName && !customerNames.includes(form.customerName) && (
                          <option value={form.customerName}>{form.customerName}</option>
                        )}
                        {customerNames.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    ) : searchMode === "sample" ? (
                      <input
                        name="customerName"
                        className="po-input"
                        value={form.customerName}
                        title={form.customerName}
                        placeholder="New customer name"
                        onChange={handleChange}
                      />
                    ) : (
                      <input className="po-input" value={form.customerName} title={form.customerName} readOnly />
                    )}`;

const J_SAMPLE_DETAILS = `{/* SAMPLE DETAILS (Sample Request only) */}
              {searchMode === "sample" && (
                <div className="gl-inner">
                  <div className="gl-group">
                    <i className="bi bi-clipboard-check"></i>
                    <span>Sample Details</span>
                  </div>

                  <div className="row g-2">
                    <PoField
                      className="col-12 col-md-4"
                      icon="bi-person-plus"
                      label="Request Type"
                      required
                      alwaysFloat
                      caret
                      after={errors.sampleRequestType && <small className="indent-error-text">{errors.sampleRequestType}</small>}
                    >
                      <select
                        name="sampleRequestType"
                        className="po-input"
                        value={form.sampleRequestType || ""}
                        onChange={handleRequestTypeChange}
                      >
                        <option value="">Select Request Type</option>
                        <option value="new">New customer</option>
                        <option value="design">Existing customer, design change</option>
                        <option value="product">Existing customer, new product</option>
                      </select>
                    </PoField>

                    {form.sampleRequestType === "new" && (
                      <PoField className="col-12 col-md-4" icon="bi-hash" label="Provisional Customer ID" alwaysFloat>
                        <input className="po-input" value={form.provisionalCustomerId || "Generated on save"} readOnly />
                      </PoField>
                    )}

                    <PoField className="col-12 col-md-4" icon="bi-person" label="Raised By" alwaysFloat>
                      <input className="po-input" value={loggedInUser} readOnly />
                    </PoField>
                  </div>
                </div>
              )}

              {/* SECTION 3: SALES ORDER / BILLING DETAILS (NEW) */}`;

const J_ARTWORK_SECTION = `{/* ARTWORK MANAGEMENT */}
              <div className="gl-inner">
                <div className="gl-group">
                  <i className="bi bi-palette"></i>
                  <span>Artwork Management</span>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                  <span className="fw-semibold">Latest status:</span>
                  <span className={awBadge(latestArtwork ? latestArtwork.status : "Pending")}>
                    {latestArtwork ? "v" + latestArtwork.version + " " + latestArtwork.status : "No artwork"}
                  </span>
                  <small>
                    {searchMode === "sample"
                      ? "Sample can go ahead with pending artwork."
                      : "Production indent needs an approved artwork version."}
                  </small>
                </div>

                <div className="row g-2 mb-2">
                  <PoField className="col-12 col-md-4" icon="bi-paperclip" label="Artwork File" alwaysFloat>
                    <input
                      ref={awFileInputRef}
                      type="file"
                      className="po-input"
                      accept=".pdf,.ai,.psd,.png,.jpg,.jpeg,.cdr,.zip"
                      onChange={(e) => setAwFile(e.target.files?.[0] || null)}
                    />
                  </PoField>

                  <PoField className="col-12 col-md-5" icon="bi-pencil" label="Version Note" filled={has(awNote)}>
                    <input
                      type="text"
                      className="po-input"
                      value={awNote}
                      title={awNote}
                      onChange={(e) => setAwNote(e.target.value)}
                    />
                  </PoField>

                  <div className="col-12 col-md-3">
                    <button type="button" className="btn btn-export w-100" onClick={addArtworkVersion}>
                      Upload Version
                    </button>
                  </div>

                  <PoField className="col-12" icon="bi-chat-left-text" label="Reviewer comment (used when approving or rejecting)" filled={has(awReview)}>
                    <input
                      type="text"
                      className="po-input"
                      value={awReview}
                      title={awReview}
                      onChange={(e) => setAwReview(e.target.value)}
                    />
                  </PoField>
                </div>

                {errors.artwork && <small className="indent-error-text mb-2">{errors.artwork}</small>}

                <div className="table-responsive" style={{ fontSize: "12px" }}>
                  <table className="table table-bordered table-sm align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Ver</th>
                        <th>File</th>
                        <th>Uploaded</th>
                        <th>Note</th>
                        <th>Status</th>
                        <th>Reviewer comment</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {artworkVersions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center">
                            No artwork uploaded yet. Add a file to start version 1.
                          </td>
                        </tr>
                      ) : (
                        artworkVersions.map((v) => (
                          <tr key={v.version}>
                            <td>v{v.version}</td>
                            <td>
                              {v.filePath ? (
                                <a href={BASE_URL + v.filePath} target="_blank" rel="noreferrer">{v.fileName}</a>
                              ) : (
                                v.fileName
                              )}
                            </td>
                            <td>
                              {v.uploadedAt ? new Date(v.uploadedAt).toLocaleString("en-IN") : "-"}
                              <br />
                              <small>{v.uploadedBy}</small>
                            </td>
                            <td>{v.note || "-"}</td>
                            <td><span className={awBadge(v.status)}>{v.status}</span></td>
                            <td>{v.comment || "-"}</td>
                            <td>
                              {v.status === "Pending" && (
                                <div className="d-flex gap-1">
                                  <button type="button" className="btn-action-edit" onClick={() => reviewArtwork(v.version, "Approved")}>
                                    Approve
                                  </button>
                                  <button type="button" className="btn-action-delete" onClick={() => reviewArtwork(v.version, "Rejected")}>
                                    Reject
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 4: ADDITIONAL INFO */}`;

const jsxSteps = [
  ["const REQUIRE_APPROVED_ARTWORK", 'const norm = (v) => String(v ?? "").trim();',
    'const norm = (v) => String(v ?? "").trim();\n\n// Production indents (not samples) must have an approved artwork version before saving.\n// Set to false to switch that rule off.\nconst REQUIRE_APPROVED_ARTWORK = true;'],
  ["form initial state", "const [form, setForm] = useState({",
    'const [form, setForm] = useState({\n    // ===== SAMPLE REQUEST =====\n    sampleRequestType: "",\n    provisionalCustomerId: "",\n'],
  ["artwork state", "const [existingArtwork, setExistingArtwork] = useState(null);", J_STATE],
  ["materialTypeOptions", "// only the products of the chosen customer", J_MATERIAL_TYPES],
  ["handleChange sample early return", "if (!newValue) {", J_SAMPLE_EARLY_RETURN],
  ["resetForm setForm", /setForm\(\{\s*productCode: "",/,
    'setForm({\n      sampleRequestType: "",\n      provisionalCustomerId: "",\n      productCode: "",'],
  ["handleEdit setForm", /setForm\(\{\s*productCode: item\.productCode \|\| "",/,
    'setForm({\n      sampleRequestType: item.sampleRequestType || "",\n      provisionalCustomerId: item.provisionalCustomerId || "",\n      productCode: item.productCode || "",'],
  ["resetForm artwork", "setExistingArtwork(null);", J_RESET_ART],
  ["handleEdit artwork", "setExistingArtwork(item.artwork?.filePath ? item.artwork : null);", J_EDIT_ART],
  ["handleSubmit artwork", 'if (artworkFile) formData.append("artwork", artworkFile);', J_SUBMIT],
  ["validate productCode", 'if (!form.productCode) newErrors.productCode = "Required";',
    'if (searchMode !== "sample" && !form.productCode) newErrors.productCode = "Required";'],
  ["validate deliveryDate", 'if (!form.deliveryDate) newErrors.deliveryDate = "Required";', J_VALID_DELIVERY],
  ["helpers", "// ---- Double-click protection for Save Indent ----", J_HELPERS],
  ["radio code onChange", 'onChange={() => setSearchMode("code")}', 'onChange={() => switchMode("code")}'],
  ["radio customer onChange", 'onChange={() => setSearchMode("customer")}', 'onChange={() => switchMode("customer")}'],
  ["third radio", /htmlFor="psm-customer">\s*Customer \/ Description\s*<\/label>\s*<\/div>/, J_RADIO],
  ["product code required", /icon="bi-upc-scan"\s+label="Product Code"\s+required\s+filled=\{has\(form\.productCode\)\}/,
    'icon="bi-upc-scan"\n                    label="Product Code"\n                    required={searchMode !== "sample"}\n                    filled={has(form.productCode)}'],
  ["product code readOnly", 'readOnly={searchMode !== "code"}', 'readOnly={searchMode === "customer"}'],
  ["product type field open",
    '<PoField className="col-6 col-md-4" icon="bi-tag" label="Product Type" filled={has(form.materialType)}>',
    '<PoField className="col-6 col-md-4" icon="bi-tag" label="Product Type" filled={has(form.materialType)} alwaysFloat={searchMode === "sample"} caret={searchMode === "sample"}>'],
  ["product type input", inputRe("materialType"), J_MATERIAL_INPUT],
  ["customer field open",
    '<PoField className="col-12 col-md-4" icon="bi-person" label="Customer" filled={has(form.customerName)}>',
    '<PoField className="col-12 col-md-4" icon="bi-person" label="Customer" filled={has(form.customerName)} alwaysFloat={custIsSelect} caret={custIsSelect}>'],
  ["customer input", inputRe("customerName"), J_CUSTOMER_INPUT],
  ["description input", inputRe("description"), editableInput("description")],
  ["color front input", inputRe("colorFront"), editableInput("colorFront")],
  ["color back input", inputRe("colorBack"), editableInput("colorBack")],
  ["job size input", inputRe("jobSize"), editableInput("jobSize")],
  ["quantity label", 'label="Order Quantity"', 'label={searchMode === "sample" ? "Sample Quantity" : "Order Quantity"}'],
  ["delivery label", 'label="Delivery Date"', 'label={searchMode === "sample" ? "Required Date" : "Delivery Date"}'],
  ["hide unit rate in sample", wrapRe("Unit Rate"), wrapHide],
  ["sample details section", "{/* SECTION 3: SALES ORDER / BILLING DETAILS (NEW) */}", J_SAMPLE_DETAILS],
  ["billing heading", "<span>Sales Order / Billing Details</span>",
    '<span>{searchMode === "sample" ? "Sample Costing" : "Sales Order / Billing Details"}</span>'],
  ["hide job no", wrapRe("Job No"), wrapHide],
  ["hide so no", wrapRe("SO No"), wrapHide],
  ["hide so date", wrapRe("SO Date"), wrapHide],
  ["hide billing type", wrapRe("Type of Billing"), wrapHide],
  ["hide customer po no", wrapRe("Customer PO No"), wrapHide],
  ["hide customer po date", wrapRe("Customer PO Date"), wrapHide],
  ["sample type required", 'label="Sample Type" alwaysFloat caret>',
    'label="Sample Type" required={searchMode === "sample"} alwaysFloat caret after={errors.sampleType && <small className="indent-error-text">{errors.sampleType}</small>}>'],
  ["artwork section", "{/* SECTION 4: ADDITIONAL INFO */}", J_ARTWORK_SECTION],
  ["hide PO copy in sample", /<PoField className="col-md-6"\s+icon="bi-paperclip"[\s\S]*?<\/PoField>/, wrapHide],
  ["remove old artwork upload field", /<PoField className="col-md-6"\s+icon="bi-image"[\s\S]*?<\/PoField>\s*/, ""]
];

// =====================================================================
//  BACKEND MODEL - Indentrequest.js
// =====================================================================
const modelSteps = [
  ["productCode not required", /productCode:\s*\{ type: String, required: true \},/,
    'productCode:  { type: String, default: "" }, // optional for Sample Requests (the route checks it for production indents)'],
  ["sample + artwork version fields", /gsm:\s*\{ type: String, default: "" \},\s*\n\}\);/,
`gsm:        { type: String, default: "" },

  // ===== SAMPLE REQUEST =====
  sampleRequestType:     { type: String, default: "" },   // new | design | product
  provisionalCustomerId: { type: String, default: "" },

  // ===== ARTWORK MANAGEMENT (versions) =====
  artworkVersions: [
    {
      version:    { type: Number },
      fileName:   { type: String, default: "" },
      filePath:   { type: String, default: "" },
      note:       { type: String, default: "" },
      status:     { type: String, enum: ["Pending", "Approved", "Rejected", "Superseded"], default: "Pending" },
      comment:    { type: String, default: "" },
      uploadedBy: { type: String, default: "" },
      uploadedAt: { type: Date, default: Date.now },
    },
  ],
});`],
  ["status enum", 'enum: ["PENDING_PO", "APPROVED", "REJECTED"],', 'enum: ["PENDING_PO", "APPROVED", "REJECTED", "SAMPLE_REQUESTED"],'],
  ["indentType", /orderType:\s*\{ type: String, default: "" \},/,
    'indentType: { type: String, enum: ["production", "sample"], default: "production" },\n    orderType:  { type: String, default: "" },']
];

// =====================================================================
//  BACKEND ROUTES - newindent routes file
// =====================================================================
const R_HELPERS = `// =============================================
// ARTWORK MANAGEMENT HELPERS (versions)
// =============================================
const ART_STATUSES = ["Pending", "Approved", "Rejected", "Superseded"];

// Builds the artworkVersions array from the JSON the page sends (artworkMeta) + the uploaded files (artworkFiles)
function buildArtworkVersions(req, existingItem, userName) {
  // old clients that do not send artworkMeta: keep whatever is already saved
  if (req.body.artworkMeta === undefined) {
    return (existingItem && existingItem.artworkVersions) || [];
  }

  let meta = [];
  try { meta = JSON.parse(req.body.artworkMeta || "[]"); } catch (e) { meta = []; }
  if (!Array.isArray(meta)) meta = [];

  const files = (req.files && req.files.artworkFiles) || [];
  const out = [];

  meta.forEach((m) => {
    const status = ART_STATUSES.includes(m.status) ? m.status : "Pending";
    const newFile = Number.isInteger(m.fileIndex) ? files[m.fileIndex] : null;
    let fileName = "";
    let filePath = "";

    if (newFile) {
      fileName = newFile.originalname;
      filePath = "/api/newindent/files/" + newFile.filename;
    } else {
      // existing version: take the file from what is already saved (never trust a path sent by the browser)
      let old = ((existingItem && existingItem.artworkVersions) || []).find((v) => v.version === m.version);
      if (!old && existingItem && existingItem.artwork && existingItem.artwork.filePath && m.filePath === existingItem.artwork.filePath) {
        old = existingItem.artwork;
      }
      if (!old) return;
      fileName = old.fileName;
      filePath = old.filePath;
    }

    out.push({
      version: m.version,
      fileName,
      filePath,
      note: m.note || "",
      status,
      comment: m.comment || "",
      uploadedBy: m.uploadedBy || userName || "",
      uploadedAt: m.uploadedAt ? new Date(m.uploadedAt) : new Date()
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

// Serve uploaded indent files`;

const routeSteps = [
  ["multer artworkFiles", '{ name: "artwork", maxCount: 1 }', '{ name: "artwork", maxCount: 1 },\n  { name: "artworkFiles", maxCount: 20 }'],
  ["helpers", "// Serve uploaded indent files", R_HELPERS],
  ["POST validation", "if (!productCode || !quantity || !location) {",
    'const isSample = req.body.indentType === "sample";\n    const { sampleRequestType, provisionalCustomerId } = req.body;\n\n    if ((!isSample && !productCode) || !quantity || !location) {'],
  ["POST last indent", "const lastIndent = await IndentRequest.findOne().sort({ createdAt: -1 });",
    'const lastIndent = await IndentRequest.findOne(\n      isSample ? { indentType: "sample" } : { indentType: { $ne: "sample" } }\n    ).sort({ createdAt: -1 });'],
  ["POST indentNo", 'const indentNo = `IND_${String(lastNumber + 1).padStart(3, "0")}`;',
    'const indentNo = `${isSample ? "SMP" : "IND"}_${String(lastNumber + 1).padStart(3, "0")}`;'],
  ["POST artwork versions", "// Create indent item",
    '// ===== Artwork versions =====\n    const artworkVersions = buildArtworkVersions(req, {}, userData.name);\n    const latestArt = pickLatestArtwork(artworkVersions);\n\n    // Create indent item'],
  ["POST item fields", 'gsm: gsm || "",',
    'gsm: gsm || "",\n      sampleRequestType: sampleRequestType || "",\n      provisionalCustomerId:\n        sampleRequestType === "new" ? (provisionalCustomerId || "PRV-" + indentNo.split("_")[1]) : "",\n      artworkVersions,'],
  ["POST latest artwork", "const newIndent = new IndentRequest({",
    "if (latestArt) indentItem.artwork = latestArt;\n\n    const newIndent = new IndentRequest({"],
  ["POST status", 'status: "PENDING_PO",',
    'status: isSample ? "SAMPLE_REQUESTED" : "PENDING_PO",\n      indentType: isSample ? "sample" : "production",'],
  ["PUT artwork versions", "const existingItem = indent.items?.[0] || {};",
    'const existingItem = indent.items?.[0] || {};\n\n    const editor = await User.findById(req.user.id);\n    const artworkVersions = buildArtworkVersions(req, existingItem, editor && editor.name);\n    const latestArt = pickLatestArtwork(artworkVersions);\n    const { sampleRequestType, provisionalCustomerId } = req.body;'],
  ["PUT item fields", /customerCopy,\s*\n\s*artwork\s*\n\s*\}\s*\n\s*\];/,
`customerCopy,
        artwork: latestArt || artwork,
        sampleRequestType: sampleRequestType || "",
        provisionalCustomerId:
          sampleRequestType === "new"
            ? (provisionalCustomerId || "PRV-" + String(indent.indentNo || "").split("_")[1])
            : "",
        artworkVersions
      }
    ];`]
];

// ---------- run ----------
console.log("Searching under: " + root + "\n");
const results = [];
if (jsx) results.push(patchFile(jsx, "psm-sample", jsxSteps));
if (model) results.push(patchFile(model, "artworkVersions", modelSteps));
if (routes) results.push(patchFile(routes, "buildArtworkVersions", routeSteps));

if (results.length === 3 && results.every(Boolean)) {
  console.log("\nDone. Restart the backend (node server), the Vite page reloads by itself.");
} else {
  console.log("\nSome files were not patched - see the messages above and send them to me.");
}
