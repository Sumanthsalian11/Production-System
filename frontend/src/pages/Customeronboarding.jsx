import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import BASE_URL from "../config/api";
import {
  FiPlus, FiEdit2, FiTrash2, FiSave, FiX, FiSearch, FiPaperclip, FiUser, FiDownload, FiFileText
} from "react-icons/fi";

/* ------------------------------------------------------------------
   Checklist definition (taken from example_1.xlsx).
   Everything on the page is driven from this array.
   type: "keyin"  -> only a key-in box
   status        -> 1st dropdown   (Status)
   pending       -> 2nd dropdown   (Pending From)
   keyIn         -> key-in box shown when status === keyInWhen
   attach        -> attachment shown when status === attachWhen (or always if attachWhen = "*")
   closeTrigger  -> if Pending From = "Closed", rows 8,9,10 -> KAM
------------------------------------------------------------------- */
const CKC = ["Customer", "KAS", "Closed"];
const REQ_RCV = ["Requested To Customer", "Received"];

const ROWS = [
  { sl: 1,  label: "Customer Name", type: "keyin", keyInLabel: "Customer Name" },
  { sl: 2,  label: "CAS Standard Agreement", status: ["Requested To Customer", "Completed"], pending: CKC, closeTrigger: true },
  { sl: 3,  label: "PAN", status: REQ_RCV, pending: CKC, closeTrigger: true },
  { sl: 4,  label: "GST", status: REQ_RCV, pending: CKC, closeTrigger: true },
  { sl: 5,  label: "Billing Address", status: REQ_RCV, pending: CKC, closeTrigger: true },
  { sl: 6,  label: "Invoice Name", status: REQ_RCV, pending: CKC, closeTrigger: true, keyIn: "Invoice Name", keyInWhen: "Received" },
  { sl: 7,  label: "Customer SPOC and Email ID / Contact Details", status: REQ_RCV, pending: CKC, closeTrigger: true },
  { sl: 8,  label: "CRM Code", status: REQ_RCV, pending: ["KAM", "KAS"], combo: true },
  { sl: 9,  label: "Credit Appraisal", status: REQ_RCV, pending: ["KAM", "KAS"], attachWhen: "Received" },
  { sl: 10, label: "Credit Limit", status: REQ_RCV, pending: ["KAM", "KAS"], attachWhen: "Received" },
  { sl: 11, label: "Chethan Approval", status: REQ_RCV, pending: ["KAS", "Finance"], attachWhen: "Received" },
  { sl: 12, label: "Shripad Approval", status: REQ_RCV, pending: ["KAS", "Finance"], attachWhen: "Received" },
  { sl: 13, label: "GST Name Match with Agreement (if not, approval required)", status: REQ_RCV, pending: ["KAS", "Finance"] },
  { sl: 14, label: "Share with Billing Team", status: ["Requested To Customer", "Not Requested To Customer"], pending: ["Closed", "Pending"] },
  { sl: 15, label: "Agreement", pending: ["KAS"], attachWhen: "*" },
  { sl: 16, label: "Final Comments", status: ["Closed", "Open"], pending: ["KAS"] },
];

// the sl numbers that become "KAM" when any of rows 2-7 is Closed
const KAM_ROWS = [8, 9, 10];

const emptyItems = () => {
  const o = {};
  ROWS.forEach((r) => {
    o[r.sl] = {
      status: "",
      pendingFrom: r.pending && r.pending.length === 1 ? r.pending[0] : "",
      keyIn: "",
      attachment: null, // { name, url } already saved on server
      file: null,       // new File chosen in this session
    };
  });
  return o;
};

const showAlert = (message, icon = "success") =>
  Swal.fire({ toast: true, position: "top", icon, title: message, showConfirmButton: false, timer: 3000 });

export default function CustomerOnboarding() {
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [items, setItems] = useState(emptyItems());
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);

  /* ---------------- load ---------------- */
  const fetchList = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/customer-onboarding`, { headers });
      setList(res.data || []);
    } catch (err) {
      console.error(err);
      showAlert("Failed to load records", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchList(); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => String(r.customerName || "").toLowerCase().includes(q));
  }, [list, search]);

  /* ---------------- form handlers ---------------- */
  const openNew = () => {
    setEditingId(null);
    setItems(emptyItems());
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const openEdit = (rec) => {
    const base = emptyItems();
    (rec.items || []).forEach((it) => {
      if (base[it.slNo]) {
        base[it.slNo] = {
          status: it.status || "",
          pendingFrom: it.pendingFrom || base[it.slNo].pendingFrom,
          keyIn: it.keyIn || "",
          attachment: it.attachment?.url ? it.attachment : null,
          file: null,
        };
      }
    });
    setEditingId(rec._id);
    setItems(base);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setItems(emptyItems());
  };

  const setField = (sl, field, value) => {
    setItems((prev) => {
      const next = { ...prev, [sl]: { ...prev[sl], [field]: value } };
      const row = ROWS.find((r) => r.sl === sl);

      // status changed -> clear key-in / attachment that no longer apply
      if (field === "status") {
        if (row.keyIn && value !== row.keyInWhen) next[sl].keyIn = "";
        if (row.attachWhen && row.attachWhen !== "*" && value !== row.attachWhen) {
          next[sl].file = null;
        }
      }

      // Sl 2-7: any one KAS -> Sl 8,9,10 = KAS ; otherwise if Closed -> KAM
      if (field === "pendingFrom" && row.closeTrigger) {
        const vals = ROWS.filter((r) => r.closeTrigger).map((r) => next[r.sl].pendingFrom);
        const auto = vals.includes("KAS") ? "KAS" : vals.includes("Closed") ? "KAM" : null;
        if (auto) KAM_ROWS.forEach((k) => { next[k] = { ...next[k], pendingFrom: auto }; });
      }
      return next;
    });
  };

  /* ---------------- save ---------------- */
  const handleSave = async () => {
    const customerName = items[1].keyIn.trim();
    if (!customerName) return showAlert("Customer Name is required", "warning");

    // key-in / attachment required once the row reaches its trigger status
    for (const r of ROWS) {
      const it = items[r.sl];
      if (r.keyIn && it.status === r.keyInWhen && !it.keyIn.trim()) {
        return showAlert(`${r.label}: please key in ${r.keyIn}`, "warning");
      }
      if (r.attachWhen && r.attachWhen !== "*" && it.status === r.attachWhen && !it.file && !it.attachment) {
        return showAlert(`${r.label}: please attach the document`, "warning");
      }
    }

    const payload = {
      customerName,
      items: ROWS.map((r) => ({
        slNo: r.sl,
        label: r.label,
        status: items[r.sl].status,
        pendingFrom: items[r.sl].pendingFrom,
        keyIn: items[r.sl].keyIn,
        attachment: items[r.sl].attachment, // keep old file unless replaced
      })),
    };

    const fd = new FormData();
    fd.append("data", JSON.stringify(payload));
    ROWS.forEach((r) => { if (items[r.sl].file) fd.append(`file_${r.sl}`, items[r.sl].file); });

    try {
      setSaving(true);
      if (editingId) {
        await axios.put(`${BASE_URL}/api/customer-onboarding/${editingId}`, fd, { headers });
        showAlert("Updated successfully ✅");
      } else {
        await axios.post(`${BASE_URL}/api/customer-onboarding`, fd, { headers });
        showAlert("Saved successfully ✅");
      }
      closeForm();
      fetchList();
    } catch (err) {
      console.error(err);
      showAlert(err.response?.data?.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const c = await Swal.fire({
      title: "Are you sure?", text: "You won't be able to revert this!", icon: "warning",
      showCancelButton: true, confirmButtonColor: "#d33", cancelButtonColor: "#3085d6", confirmButtonText: "Yes, delete it!",
    });
    if (!c.isConfirmed) return;
    try {
      await axios.delete(`${BASE_URL}/api/customer-onboarding/${id}`, { headers });
      showAlert("Deleted successfully ✅");
      fetchList();
    } catch (err) {
      console.error(err);
      showAlert("Delete failed", "error");
    }
  };

  /* ---------------- helpers ---------------- */
  const progressOf = (rec) => {
    const done = (rec.items || []).filter((i) => i.slNo > 1 && (i.status || i.attachment?.url)).length;
    return `${done} / ${ROWS.length - 1}`;
  };

  const pendingBadge = (v) => {
    if (!v) return <span className="text-muted">-</span>;
    const cls = v === "Closed" ? "bg-success" : v === "Pending" ? "bg-warning text-dark" : "bg-secondary";
    return <span className={`badge ${cls}`}>{v}</span>;
  };

  /* ---------------- export (Excel / PDF) ---------------- */
  const EXPORT_HEAD = ["SL No.", "Particulars", "Status", "Pending From", "Additional Requirement"];

  // every checklist row of one record -> [sl, particulars, status, pending from, additional]
  const rowsOf = (rec) =>
    ROWS.map((r) => {
      const it = (rec.items || []).find((i) => i.slNo === r.sl) || {};
      const status = r.type === "keyin" ? it.keyIn : it.status;
      const extra = [
        r.keyIn && it.keyIn ? `${r.keyIn}: ${it.keyIn}` : "",
        it.attachment?.name ? `Attachment: ${it.attachment.name}` : "",
      ].filter(Boolean).join(" | ");
      return [r.sl, r.label, status || "-", it.pendingFrom || "-", extra || "-"];
    });

  const safeName = (s) => String(s || "Customer").replace(/[^a-zA-Z0-9]+/g, "_");

  const exportExcel = (recs, fileName) => {
    if (!recs.length) return showAlert("No records to export", "warning");
    const aoa = [["Customer", ...EXPORT_HEAD, "Last Updated"]];
    recs.forEach((rec) => {
      const upd = rec.updatedAt ? new Date(rec.updatedAt).toLocaleDateString("en-IN") : "-";
      rowsOf(rec).forEach((row) => aoa.push([rec.customerName, ...row, upd]));
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 26 }, { wch: 8 }, { wch: 48 }, { wch: 28 }, { wch: 16 }, { wch: 50 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customer Onboarding");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `${fileName}.xlsx`);
  };

  const exportPdf = (recs, fileName) => {
    if (!recs.length) return showAlert("No records to export", "warning");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    recs.forEach((rec, idx) => {
      if (idx > 0) doc.addPage();
      doc.setFontSize(15);
      doc.text(`Customer Onboarding - ${rec.customerName}`, 40, 36);
      autoTable(doc, {
        startY: 50,
        head: [EXPORT_HEAD],
        body: rowsOf(rec),
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 4, valign: "middle", textColor: [0, 0, 0] },
        headStyles: { fillColor: [6, 76, 115], textColor: 255 },
        columnStyles: { 0: { cellWidth: 45, halign: "center" }, 1: { cellWidth: 230 } },
      });
    });
    doc.save(`${fileName}.pdf`);
  };

  /* ---------------- additional requirement cell ---------------- */
  const renderAdditional = (r) => {
    const it = items[r.sl];

    if (r.type === "keyin") return null;

    const showKeyIn = r.keyIn && it.status === r.keyInWhen;
    const showAttach = r.attachWhen && (r.attachWhen === "*" || it.status === r.attachWhen);

    return (
      <div className="d-flex flex-column gap-1">


        {showKeyIn && (
          <input
            className="form-control form-control-sm"
            placeholder={`Key in ${r.keyIn}`}
            value={it.keyIn}
            onChange={(e) => setField(r.sl, "keyIn", e.target.value)}
          />
        )}



        {showAttach && (
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <label className="btn btn-sm btn-outline-primary mb-0">
              <FiPaperclip /> {it.file || it.attachment ? "Replace" : "Attach"}
              <input
                type="file"
                hidden
                onChange={(e) => setField(r.sl, "file", e.target.files?.[0] || null)}
              />
            </label>
            {it.file && <small className="text-success">{it.file.name}</small>}
            {!it.file && it.attachment && (
              <a href={`${BASE_URL}${it.attachment.url}`} target="_blank" rel="noreferrer" className="small">
                <FiDownload /> {it.attachment.name}
              </a>
            )}
          </div>
        )}


      </div>
    );
  };

  /* ---------------- render ---------------- */
  return (
    <div className="container mt-2 customer-onboarding-page">

      <style>{`
        .co-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin:12px 0; }
        .co-head h4 { margin:0; font-weight:800; letter-spacing:.3px; }
        .co-table th { background:#064c73; color:#fff; font-size:.8rem; white-space:nowrap; vertical-align:middle; }
        .co-table td { font-size:.84rem; vertical-align:middle; }
        .co-sl { width:56px; text-align:center; font-weight:700; }
        .co-form-table td:nth-child(3), .co-form-table td:nth-child(4) { min-width:190px; }
        .co-form-table td:nth-child(5) { min-width:260px; }
      `}</style>

      <div className="co-head">
      
        <div className="d-flex gap-2">
          <div className="input-group input-group-sm" style={{ width: 240 }}>
            <span className="input-group-text"><FiSearch /></span>
            <input
              className="form-control"
              placeholder="Search customer"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-sm btn-success" onClick={() => exportExcel(filtered, "Customer_Onboarding")} title="Export all listed customers">
            <FiDownload /> Excel
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => exportPdf(filtered, "Customer_Onboarding")} title="Export all listed customers">
            <FiFileText /> PDF
          </button>
          {!showForm && (
            <button className="btn btn-sm btn-primary" onClick={openNew}>
              <FiPlus /> New Onboarding
            </button>
          )}
        </div>
      </div>

      {/* ============ FORM ============ */}
      {showForm && (
        <div className="card shadow-sm mb-4" ref={formRef}>
          <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <strong>{editingId ? "Edit Onboarding" : "New Onboarding"}</strong>
            <button className="btn btn-sm btn-light" onClick={closeForm}><FiX /> Close</button>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-bordered table-sm mb-0 co-table co-form-table">
                <thead>
                  <tr>
                    <th className="co-sl">SL No.</th>
                    <th>Particulars</th>
                    <th>Status</th>
                    <th>Pending From</th>
                    <th>Additional Requirement</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => {
                    const it = items[r.sl];
                    return (
                      <tr key={r.sl}>
                        <td className="co-sl">{r.sl}</td>
                        <td className="fw-semibold">{r.label}</td>

                        {/* Dropdown 1: Status */}
                        <td>
                          {r.type === "keyin" ? (
                            <input
                              className="form-control form-control-sm"
                              placeholder="Key in customer name"
                              value={it.keyIn}
                              onChange={(e) => setField(r.sl, "keyIn", e.target.value)}
                            />
                          ) : r.combo ? (
                            <>
                              <input
                                className="form-control form-control-sm"
                                list={`opts-${r.sl}`}
                                placeholder="Select or key in CRM Code"
                                value={it.status}
                                onChange={(e) => setField(r.sl, "status", e.target.value)}
                              />
                              <datalist id={`opts-${r.sl}`}>
                                {r.status.map((o) => <option key={o} value={o} />)}
                              </datalist>
                            </>
                          ) : r.status ? (
                            <select
                              className="form-select form-select-sm"
                              value={it.status}
                              onChange={(e) => setField(r.sl, "status", e.target.value)}
                            >
                              <option value="">-- Select --</option>
                              {r.status.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>

                        {/* Dropdown 2: Pending From */}
                        <td>
                          {r.pending ? (
                            <select
                              className="form-select form-select-sm"
                              value={it.pendingFrom}
                              onChange={(e) => setField(r.sl, "pendingFrom", e.target.value)}
                            >
                              <option value="">-- Select --</option>
                              {r.pending.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>

                        {/* Additional requirement */}
                        <td>{renderAdditional(r)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-footer d-flex justify-content-end gap-2">
            <button className="btn btn-secondary btn-sm" onClick={closeForm}>Cancel</button>
            <button className="btn btn-success btn-sm" onClick={handleSave} disabled={saving}>
              <FiSave /> {saving ? "Saving..." : editingId ? "Update" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* ============ LIST ============ */}
      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-bordered table-hover table-sm mb-0 co-table">
            <thead>
              <tr>
                <th className="co-sl">#</th>
                <th>Customer Name</th>
                <th>Progress</th>
                <th>CRM Code</th>
                <th>Updated</th>
                <th style={{ width: 190 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-3">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-3 text-muted">No records found</td></tr>
              ) : (
                filtered.map((rec, idx) => {
                  const crm = rec.items?.find((i) => i.slNo === 8)?.status || "-";

                  return (
                    <tr key={rec._id}>
                      <td className="co-sl">{idx + 1}</td>
                      <td className="fw-semibold">{rec.customerName}</td>
                      <td>{progressOf(rec)}</td>
                      <td>{crm}</td>
                      <td>{rec.updatedAt ? new Date(rec.updatedAt).toLocaleDateString("en-IN") : "-"}</td>
                      <td>
                        <button className="btn btn-sm btn-outline-success me-1" onClick={() => exportExcel([rec], `Onboarding_${safeName(rec.customerName)}`)} title="Export Excel"><FiDownload /></button>
                        <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => exportPdf([rec], `Onboarding_${safeName(rec.customerName)}`)} title="Export PDF"><FiFileText /></button>
                        <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openEdit(rec)} title="Edit"><FiEdit2 /></button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(rec._id)} title="Delete"><FiTrash2 /></button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}