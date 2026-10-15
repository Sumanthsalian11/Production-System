import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaUserTie } from "react-icons/fa";
import { MdEmail } from "react-icons/md";
import { FaUserSecret } from "react-icons/fa";
import { RiLockPasswordFill } from "react-icons/ri";
import BASE_URL from "../config/api";
import { getModulesForRole, getModuleLabel, getAllModules, BASE_ROLES } from "../config/menuItems";

// Announcement Theme Presets
const ANNOUNCEMENT_THEMES = [
  { id: "broadcast", label: "⚡ Live Operations", icon: "⚡", badge: "LIVE BROADCAST", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  { id: "critical", label: "🚨 Critical Alert", icon: "🚨", badge: "CRITICAL ALERT", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  { id: "maintenance", label: "🛠️ Maintenance", icon: "🛠️", badge: "SYSTEM NOTICE", color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd" },
  { id: "celebration", label: "🎉 Milestone", icon: "🎉", badge: "CELEBRATION", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  { id: "info", label: "📢 Notice", icon: "📢", badge: "BULLETIN", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" }
];

const PRESET_TEMPLATES = [
  { label: "Target Achieved", text: "🏆 Outstanding achievement! Today's production target reached ahead of schedule across all shifts." },
  { label: "Maintenance Notice", text: "🛠️ Scheduled system maintenance tonight at 10:00 PM IST. Please complete open batch entries before 09:45 PM." },
  { label: "Material Arrival", text: "📦 Fresh shipment of raw materials inspected and logged into Inward Register. Ready for indenting." },
  { label: "Quality Reminder", text: "⚠️ Mandatory QC audit underway for all dispatched cartons. Ensure 100% barcode verification." }
];

// Simple, flat colour tokens (same teal / soft-orange look as the other pages)
const C = {
  page: "#f4f6f8",
  surface: "#ffffff",
  line: "#e3e7ec",
  field: "#cfd6de",
  ink: "#1f2937",
  soft: "#5b6676",
  teal: "#0f5560",
  tealDark: "#0b3a45",
  tealSoft: "#e3f1f4",
  head: "#a9d0d9",
  headLine: "#8fbcc7",
  brandSoft: "#fde3d8",
  brandLine: "#f5b9a1",
  danger: "#b42323",
  dangerSoft: "#fdecec",
  dangerLine: "#f3c1c1"
};

function InternalRegister() {
  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [filterName, setFilterName] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [editUserId, setEditUserId] = useState(null);
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [locations, setLocations] = useState([]);
  const [masterRoles, setMasterRoles] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [selectedModules, setSelectedModules] = useState([]);
  const [moduleDropdownOpen, setModuleDropdownOpen] = useState(false);
  const [viewModulesOpenId, setViewModulesOpenId] = useState(null);
  const [viewLocationsOpenId, setViewLocationsOpenId] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const moduleDropdownRef = useRef(null);
  const viewModulesRef = useRef(null);
  const viewLocationsRef = useRef(null);
  const formCardRef = useRef(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "ADMIN"
  });

  // NEW: centered pop-up message (user created / broadcast launched)
  const [popup, setPopup] = useState(null);

  // Announcement Studio States
  const [dashboardComment, setDashboardComment] = useState("");
  const [commentSuccess, setCommentSuccess] = useState("");
  const [announcementType, setAnnouncementType] = useState("broadcast");
  const [customBadge, setCustomBadge] = useState("");
  const [marqueeSpeed, setMarqueeSpeed] = useState("normal");
  const [enableSound, setEnableSound] = useState(true);
  const [isCurrentlyActive, setIsCurrentlyActive] = useState(false);
  const [previewPaused, setPreviewPaused] = useState(false);

  // NEW: auto close the pop-up after 3 seconds
  useEffect(() => {
    if (!popup) return;
    const t = setTimeout(() => setPopup(null), 3000);
    return () => clearTimeout(t);
  }, [popup]);

  const fetchCurrentAnnouncement = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${BASE_URL}/api/auth/announcement`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.text) {
        setIsCurrentlyActive(true);
        try {
          const parsed = JSON.parse(res.data.text);
          if (parsed && typeof parsed === "object" && parsed.text) {
            setDashboardComment(parsed.text);
            setAnnouncementType(parsed.type || "broadcast");
            setCustomBadge(parsed.badge || "");
            setMarqueeSpeed(parsed.speed || "normal");
            setEnableSound(parsed.sound !== false);
            return;
          }
        } catch {
          setDashboardComment(res.data.text);
        }
      } else {
        setIsCurrentlyActive(false);
      }
    } catch {
      setIsCurrentlyActive(false);
    }
  };

  useEffect(() => {
    fetchCurrentAnnouncement();
  }, []);

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!dashboardComment.trim()) {
      setError("Please type a message before broadcasting!");
      return;
    }
    const token = localStorage.getItem("token");

    const richPayload = JSON.stringify({
      text: dashboardComment.trim(),
      type: announcementType,
      badge: customBadge.trim() || undefined,
      speed: marqueeSpeed,
      sound: enableSound,
      timestamp: new Date().toISOString()
    });

    try {
      await axios.post(
        `${BASE_URL}/api/auth/announcement`,
        { text: richPayload },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCommentSuccess("📢 Broadcast live on all dashboards!");
      setIsCurrentlyActive(true);
      setTimeout(() => setCommentSuccess(""), 3000);

      // NEW: pop-up for broadcast
      setPopup({
        icon: currentTheme.icon,
        title: "Broadcast Launched!",
        message: "Your announcement is now live on all user dashboards.",
        detail: dashboardComment.trim().length > 90
          ? dashboardComment.trim().slice(0, 90) + "…"
          : dashboardComment.trim()
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update comment");
    }
  };

  const handleCommentClear = async () => {
    if (!window.confirm("Clear the live broadcast from all dashboards?")) return;
    const token = localStorage.getItem("token");
    try {
      await axios.delete(`${BASE_URL}/api/auth/announcement`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboardComment("");
      setIsCurrentlyActive(false);
      setCommentSuccess("Broadcast cleared successfully");
      setTimeout(() => setCommentSuccess(""), 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to clear announcement");
    }
  };

  const insertEmoji = (emoji) => {
    setDashboardComment((prev) => prev + " " + emoji);
  };

  const applyTemplate = (tpl) => {
    setDashboardComment(tpl.text);
  };

  const fetchUsers = async () => {
    const token = localStorage.getItem("token");
    const res = await axios.get(`${BASE_URL}/api/auth/internal/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setUsers(res.data);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value.trim() });
  };

  const validateForm = () => {
    const { email, password, confirmPassword } = form;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(email)) return "Invalid email";
    if (password !== confirmPassword) return "Passwords do not match";
    return null;
  };

  const fetchLocations = async () => {
    const token = localStorage.getItem("token");
    const res = await axios.get(`${BASE_URL}/api/master/locations`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setLocations(res.data);
  };

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${BASE_URL}/api/master/roles`, { headers: { Authorization: `Bearer ${token}` } });
      setMasterRoles(res.data || []);
    } catch {
      setMasterRoles([]);
    }
  };

  useEffect(() => {
    fetchLocations();
    fetchRoles();
  }, []);

  const [showNewRole, setShowNewRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleModules, setNewRoleModules] = useState([]);

  const saveNewRole = async () => {
    const name = newRoleName.trim().toUpperCase();
    if (!name) {
      setError("Enter a role name");
      return;
    }
    if (newRoleModules.length === 0) {
      setError("Select at least one module for the new role");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${BASE_URL}/api/master/roles`,
        { name, modules: newRoleModules },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchRoles();
      setForm((f) => ({ ...f, role: name }));
      setSelectedModules(newRoleModules);
      setNewRoleName("");
      setNewRoleModules([]);
      setShowNewRole(false);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save role");
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (moduleDropdownRef.current && !moduleDropdownRef.current.contains(e.target)) {
        setModuleDropdownOpen(false);
      }
      if (viewModulesRef.current && !viewModulesRef.current.contains(e.target)) {
        setViewModulesOpenId(null);
      }
      if (viewLocationsRef.current && !viewLocationsRef.current.contains(e.target)) {
        setViewLocationsOpenId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLocationChange = (name) => {
    setSelectedLocations((prev) =>
      prev.includes(name) ? prev.filter((loc) => loc !== name) : [...prev, name]
    );
  };

  const handleModuleChange = (to) => {
    setSelectedModules((prev) =>
      prev.includes(to) ? prev.filter((m) => m !== to) : [...prev, to]
    );
  };

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "ADMIN"
    });
    setSelectedLocations([]);
    setSelectedModules([]);
    setEditUserId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (editUserId) {
      if (form.password && form.password !== form.confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      const token = localStorage.getItem("token");
      const payload = {
        name: form.name,
        role: form.role,
        locations: selectedLocations,
        modules: form.role === "ADMIN" ? [] : selectedModules
      };
      if (form.password) payload.password = form.password;

      try {
        await axios.put(
          `${BASE_URL}/api/auth/internal/user/${editUserId}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess("User updated successfully ✅");
        setTimeout(() => setSuccess(""), 2000);
        resetForm();
        setShowUserModal(false);
        fetchUsers();
      } catch (err) {
        setError(err.response?.data?.message || "Failed to update user");
      }
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const emailExists = users.some(
      (u) => u.email.toLowerCase() === form.email.toLowerCase()
    );

    if (emailExists) {
      setError("User with this email already exists");
      return;
    }

    // NEW: keep details for the pop-up before the form is reset
    const createdName = form.name;
    const createdEmail = form.email;
    const createdRole = form.role;

    try {
      await axios.post(`${BASE_URL}/api/auth/internal/register`, {
        ...form,
        locations: selectedLocations,
        modules: selectedModules
      });
      setSuccess("User registered successfully ✅");
      setTimeout(() => setSuccess(""), 2000);
      resetForm();
      setShowUserModal(false);
      fetchUsers();

      // NEW: pop-up for user created
      setPopup({
        icon: "🎉",
        title: "User Created!",
        message: `${createdName} has been registered successfully.`,
        detail: `${createdEmail} • ${createdRole}`
      });
    } catch (err) {
      setError(err.response?.data?.message || "Error");
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    const token = localStorage.getItem("token");
    await axios.delete(`${BASE_URL}/api/auth/internal/user/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchUsers();
  };

  const startEdit = (user) => {
    setEditUserId(user._id);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      confirmPassword: "",
      role: user.role
    });
    setSelectedLocations(user.locations || []);
    setSelectedModules(user.modules || []);
    setError("");
    setSuccess("");
    setShowUserModal(true);
  };

  const cancelEdit = () => {
    resetForm();
    setError("");
    setShowUserModal(false);
  };

  const roleColors = {
    ADMIN: { bg: "#fde3d8", text: "#7c2d12" },
    PLANNER: { bg: "#fff3d6", text: "#78350f" },
    SUPERVISOR: { bg: "#fed7aa", text: "#7c2d12" },
    PRODUCTION: { bg: "#d9f2e6", text: "#14532d" },
    INDENTER: { bg: "#e3f1f4", text: "#0b3a45" },
    "PURCHASE ORDER": { bg: "#fef3c7", text: "#713f12" },
    DISPATCH: { bg: "#fbdcdc", text: "#7f1d1d" },
    KAS: { bg: "#fbcfe8", text: "#831843" },
    SCANNER: { bg: "#e7e5e4", text: "#292524" },
    PREPRESS: { bg: "#dbe4ff", text: "#3730a3" }
  };

  const currentTheme = ANNOUNCEMENT_THEMES.find((t) => t.id === announcementType) || ANNOUNCEMENT_THEMES[0];
  const roleOptions = [
    ...BASE_ROLES,
    ...masterRoles
      .map((r) => ({ value: String(r.name).toUpperCase(), label: r.name, modules: r.modules || [] }))
      .filter((r) => !BASE_ROLES.some((b) => b.value === r.value)),
  ];
  const inputShadow = "none";

  const styles = {
    pageContainer: {
      minHeight: "100vh",
      background: C.page,
      fontFamily: "'Noto Sans', 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif",
      padding: "1rem 1.25rem 2rem",
      color: C.ink
    },
    container: {
      maxWidth: "100%",
      margin: "0 auto"
    },
    card: {
      background: C.surface,
      borderRadius: "8px",
      border: `1px solid ${C.line}`,
      marginBottom: "0.9rem",
      overflow: "hidden"
    },
    cardHeader: {
      background: C.surface,
      padding: "0.6rem 1.1rem",
      display: "flex",
      gap: "0.75rem",
      borderBottom: `1px solid ${C.line}`,
      textAlign: "center",
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column"
    },
    cardBody: {
      padding: "0.9rem 1.1rem 1rem"
    },
    formGroup: {
      display: "flex",
      flexDirection: "column",
      gap: "0.25rem"
    },
    formLabel: {
      fontSize: "0.75rem",
      fontWeight: "600",
      color: C.ink,
      display: "flex",
      alignItems: "center",
      gap: "0.4rem"
    },
    formInput: {
      width: "100%",
      padding: "0.42rem 0.7rem",
      fontSize: "0.86rem",
      fontWeight: "500",
      border: `1px solid ${C.field}`,
      borderRadius: "6px",
      outline: "none",
      transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      background: "#fff",
      color: C.ink,
      boxShadow: inputShadow,
      boxSizing: "border-box"
    },
    formInputFocus: {
      borderColor: C.teal,
      background: "#fff",
      boxShadow: "0 0 0 3px rgba(15, 85, 96, 0.15)"
    },
    formSelect: {
      width: "100%",
      padding: "0.42rem 0.7rem",
      fontSize: "0.86rem",
      fontWeight: "500",
      border: `1px solid ${C.field}`,
      borderRadius: "6px",
      outline: "none",
      transition: "border-color 0.15s ease",
      background: "#fff",
      color: C.ink,
      cursor: "pointer",
      boxShadow: inputShadow,
      boxSizing: "border-box"
    },
    passwordWrapper: {
      position: "relative"
    },
    passwordToggle: {
      position: "absolute",
      right: "6px",
      top: "50%",
      transform: "translateY(-50%)",
      background: "transparent",
      border: "none",
      cursor: "pointer",
      fontSize: "0.85rem",
      padding: "0.15rem 0.35rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: C.soft
    },
    locationsSection: {
      gridColumn: "1 / -1",
      background: "#fafbfc",
      border: `1px solid ${C.line}`,
      borderRadius: "8px",
      padding: "0.5rem 0.8rem 0.6rem"
    },
    locationsGrid: {
      display: "flex",
      flexWrap: "wrap",
      gap: "0.4rem",
      marginTop: "0.15rem",
      maxHeight: "120px",
      overflowY: "auto"
    },
    locationChip: {
      display: "flex",
      alignItems: "center",
      gap: "0.35rem",
      padding: "0.22rem 0.7rem",
      borderRadius: "999px",
      cursor: "pointer",
      transition: "all 0.15s ease",
      fontSize: "0.77rem",
      fontWeight: "600",
      border: `1px solid ${C.field}`,
      background: "#fff",
      color: C.ink
    },
    locationChipActive: {
      background: C.tealSoft,
      borderColor: C.teal,
      color: C.tealDark
    },
    locationCheckbox: {
      display: "none"
    },
    moduleDropdown: {
      position: "relative",
      width: "100%"
    },
    moduleDropdownButton: {
      width: "100%",
      padding: "0.42rem 0.7rem",
      fontSize: "0.85rem",
      border: `1px solid ${C.field}`,
      borderRadius: "6px",
      background: "#fff",
      color: C.ink,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      boxSizing: "border-box",
      boxShadow: inputShadow,
      fontWeight: "500"
    },
    moduleDropdownMenu: {
      position: "absolute",
      top: "calc(100% + 4px)",
      left: 0,
      right: 0,
      background: "#fff",
      border: `1px solid ${C.field}`,
      borderRadius: "8px",
      boxShadow: "0 8px 20px rgba(16, 24, 40, 0.14)",
      maxHeight: "260px",
      overflowY: "auto",
      zIndex: 30,
      padding: "0.4rem"
    },
    moduleDropdownItem: {
      display: "flex",
      alignItems: "center",
      gap: "0.6rem",
      padding: "0.45rem 0.6rem",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "0.84rem",
      color: C.ink,
      transition: "background 0.15s ease"
    },
    moduleDropdownCheckbox: {
      width: "16px",
      height: "16px",
      accentColor: C.teal,
      cursor: "pointer",
      flexShrink: 0
    },
    moduleDropdownFooter: {
      padding: "0.5rem 0.6rem 0.2rem",
      fontSize: "0.75rem",
      color: C.soft,
      borderTop: `1px solid ${C.line}`,
      marginTop: "0.35rem"
    },
    moduleAdminLocked: {
      width: "100%",
      padding: "0.42rem 0.7rem",
      fontSize: "0.78rem",
      fontWeight: "600",
      border: "1px dashed #f3c35a",
      borderRadius: "6px",
      background: "#fffbeb",
      color: "#92400e",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      boxSizing: "border-box"
    },
    moduleAdminLockedSmall: {
      padding: "0.26rem 0.6rem",
      fontSize: "0.74rem",
      fontWeight: "600",
      border: "1px dashed #f3c35a",
      borderRadius: "6px",
      background: "#fffbeb",
      color: "#92400e",
      display: "flex",
      alignItems: "center",
      gap: "0.4rem"
    },
    moduleViewItem: {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      padding: "0.4rem 0.6rem",
      fontSize: "0.82rem",
      color: C.ink
    },
    submitBtn: {
      background: C.brandSoft,
      color: C.ink,
      border: `1px solid ${C.brandLine}`,
      padding: "0.42rem 1.1rem",
      borderRadius: "6px",
      fontSize: "0.82rem",
      fontWeight: "600",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: "0.45rem",
      transition: "all 0.15s ease",
      boxShadow: "none"
    },
    alert: {
      padding: "0.5rem 0.9rem",
      borderRadius: "6px",
      marginBottom: "0.6rem",
      display: "flex",
      alignItems: "center",
      gap: "0.7rem",
      fontSize: "0.86rem",
      fontWeight: "600"
    },
    alertError: {
      background: "#fff1f1",
      border: "1px solid #fecaca",
      color: "#b91c1c"
    },
    alertSuccess: {
      background: "#effcf5",
      border: "1px solid #bbf7d0",
      color: "#15803d"
    },
    tableCard: {
      background: C.surface,
      borderRadius: "8px",
      border: `1px solid ${C.line}`,
      boxShadow: "0 1px 3px rgba(16, 24, 40, 0.06)",
      overflow: "hidden"
    },
    tableHeader: {
      background: C.surface,
      padding: "0.65rem 1rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: `1px solid ${C.line}`,
      flexWrap: "wrap",
      gap: "8px"
    },
    tableHeaderLeft: {
      display: "flex",
      alignItems: "center",
      gap: "0.65rem",
      color: C.ink
    },
    tableHeaderIcon: {
      width: "30px",
      height: "30px",
      background: C.brandSoft,
      borderRadius: "6px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "0.9rem",
      border: `1px solid ${C.brandLine}`
    },
    tableHeaderTitle: {
      fontSize: "1rem",
      fontWeight: "700",
      margin: 0
    },
    userCount: {
      background: C.page,
      border: `1px solid ${C.line}`,
      padding: "0.15rem 0.7rem",
      borderRadius: "999px",
      color: C.ink,
      fontSize: "0.75rem",
      fontWeight: "600"
    },
    // scrollable table area (vertical + horizontal)
    tableWrapper: {
      overflow: "auto",
      maxHeight: "calc(100vh - 230px)",
      minHeight: "200px"
    },
    table: {
      width: "100%",
      borderCollapse: "collapse"
    },
    th: {
      position: "sticky",
      top: 0,
      zIndex: 2,
      padding: "0.55rem 0.85rem",
      textAlign: "left",
      fontSize: "0.72rem",
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      color: "#000",
      background: C.head,
      borderBottom: `1px solid ${C.headLine}`,
      whiteSpace: "nowrap"
    },
    td: {
      padding: "0.4rem 0.85rem",
      borderBottom: `1px solid ${C.line}`,
      fontSize: "0.85rem",
      color: C.ink,
      verticalAlign: "middle"
    },
    userInfo: {
      display: "flex",
      alignItems: "center",
      gap: "0.65rem",
      minWidth: "200px"
    },
    userAvatar: {
      width: "30px",
      height: "30px",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      fontSize: "0.74rem",
      fontWeight: "700",
      color: "#fff"
    },
    userName: {
      fontWeight: "600",
      fontSize: "0.87rem",
      lineHeight: 1.2,
      color: C.ink
    },
    userEmail: {
      fontSize: "0.75rem",
      lineHeight: 1.2,
      color: C.soft,
      fontWeight: "500"
    },
    roleBadge: {
      display: "inline-flex",
      alignItems: "center",
      padding: "0.18rem 0.65rem",
      borderRadius: "4px",
      fontSize: "0.7rem",
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: "0.025em"
    },
    locationTags: {
      display: "flex",
      flexWrap: "wrap",
      gap: "0.25rem",
      maxWidth: "320px"
    },
    locationTag: {
      background: C.tealSoft,
      color: C.tealDark,
      padding: "0.12rem 0.55rem",
      borderRadius: "4px",
      fontSize: "0.72rem",
      fontWeight: "600"
    },
    passwordMask: {
      fontFamily: "monospace",
      fontSize: "0.95rem",
      letterSpacing: "1.5px",
      color: C.soft
    },
    actionBtns: {
      display: "flex",
      gap: "0.4rem",
      justifyContent: "center",
      flexWrap: "wrap"
    },
    actionBtn: {
      padding: "0.24rem 0.7rem",
      borderRadius: "6px",
      border: "1px solid transparent",
      fontSize: "0.77rem",
      fontWeight: "600",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "0.35rem",
      transition: "all 0.15s ease"
    },
    editBtn: {
      background: C.tealSoft,
      color: C.tealDark,
      borderColor: "#b9d6dd"
    },
    deleteBtn: {
      background: C.dangerSoft,
      color: C.danger,
      borderColor: C.dangerLine
    },
    emptyState: {
      textAlign: "center",
      padding: "2.2rem 1rem",
      color: C.soft,
      fontWeight: "500"
    },
    emptyIcon: {
      fontSize: "2.4rem",
      marginBottom: "0.6rem"
    }
  };

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name) => {
    const colors = ["#0f5560", "#0b3a45", "#1f7a8c", "#2a6f97", "#0e7490", "#0891b2", "#3d6b73"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const filteredUsers = users.filter((user) => {
    const matchesName = (user.name || "")
      .toLowerCase()
      .includes(filterName.toLowerCase());
    const matchesRole = filterRole === "" || user.role === filterRole;
    const matchesLocation =
      filterLocation === "" || (user.locations || []).includes(filterLocation);
    return matchesName && matchesRole && matchesLocation;
  });

  const resetBlur = (e) => {
    e.target.style.borderColor = C.field;
    e.target.style.background = "#fff";
    e.target.style.boxShadow = inputShadow;
  };

  return (
    <div style={styles.pageContainer}>
      <style>{`
        @keyframes studioMarquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes pulseDot {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }

        /* ===== Scrollbars (table, modals, dropdowns, location chips) ===== */
        .ur-scroll,
        .ur-scroll * {
          scrollbar-width: thin;
          scrollbar-color: #b5c0cb #f1f3f6;
        }
        .ur-scroll::-webkit-scrollbar,
        .ur-scroll *::-webkit-scrollbar { width: 9px; height: 9px; }
        .ur-scroll::-webkit-scrollbar-track,
        .ur-scroll *::-webkit-scrollbar-track { background: #f1f3f6; border-radius: 8px; }
        .ur-scroll::-webkit-scrollbar-thumb,
        .ur-scroll *::-webkit-scrollbar-thumb {
          background: #b5c0cb; border-radius: 8px; border: 2px solid #f1f3f6;
        }
        .ur-scroll::-webkit-scrollbar-thumb:hover,
        .ur-scroll *::-webkit-scrollbar-thumb:hover { background: #8fa0b0; }
        .ur-scroll::-webkit-scrollbar-corner,
        .ur-scroll *::-webkit-scrollbar-corner { background: #f1f3f6; }

        .ur-overlay {
          position: fixed; inset: 0; z-index: 2000;
          display: flex; align-items: center; justify-content: center; padding: 16px;
          background: rgba(15, 30, 40, 0.45);
          animation: urFade 0.15s ease;
        }
        @keyframes urFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes urPop { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

        .ur-modal {
          position: relative; display: flex; width: 100%; max-width: 980px; max-height: 92vh;
          background: #ffffff; border-radius: 10px; overflow: hidden;
          border: 1px solid ${C.line};
          box-shadow: 0 20px 50px rgba(16, 24, 40, 0.3);
          animation: urPop 0.2s ease;
          font-family: 'Noto Sans', 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif;
        }
        .ur-bmodal {
          position: relative; width: 100%; max-width: 900px; max-height: 92vh; overflow-y: auto;
          background: #ffffff; border-radius: 10px; border: 1px solid ${C.line};
          box-shadow: 0 20px 50px rgba(16, 24, 40, 0.3);
          animation: urPop 0.2s ease;
        }

        /* left info panel (same teal panel as the other pages) */
        .ur-left {
          position: relative; flex: 0 0 34%; padding: 22px 22px;
          display: flex; flex-direction: column; justify-content: space-between; overflow: hidden;
          color: #ffffff;
          background: linear-gradient(170deg, ${C.tealDark} 0%, ${C.teal} 100%);
        }
        .ur-left-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .ur-left-label { font-size: 12px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #ffb59c; }
        .ur-left-pill {
          font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 4px;
          background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.28); color: #fff;
        }
        .ur-left-center { text-align: center; }
        .ur-left-emblem {
          width: 72px; height: 72px; margin: 0 auto 12px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center; font-size: 32px; color: #ffb59c;
          background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2);
        }
        .ur-left-center h2 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.3px; color: #fff; }
        .ur-left-center p { margin: 6px auto 0; max-width: 230px; font-size: 12.5px; font-weight: 500; color: #c9dde1; line-height: 1.45; }
        .ur-left-bottom {
          align-self: flex-start; display: flex; align-items: center; gap: 10px; padding: 5px 14px 5px 5px; border-radius: 999px;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.22);
        }
        .ur-left-avatar {
          width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px;
          background: #e4572e;
        }
        .ur-left-bottom b { display: block; font-size: 13px; font-weight: 600; color: #fff; line-height: 1.1; }
        .ur-left-bottom small { font-size: 10.5px; font-weight: 500; color: #9fc0c7; }

        .ur-right { position: relative; flex: 1; min-width: 0; overflow-y: auto; padding: 22px 28px 24px 24px; background: #fff; }
        .ur-close {
          position: absolute; top: 12px; right: 14px; width: 30px; height: 30px; border-radius: 6px;
          border: 1px solid ${C.field}; background: #fff; color: ${C.ink};
          font-size: 13px; font-weight: 700; cursor: pointer;
        }
        .ur-close:hover { background: ${C.brandSoft}; border-color: ${C.brandLine}; }
        .ur-right-brand { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: ${C.teal}; margin-bottom: 6px; }
        .ur-mini-emblem {
          width: 26px; height: 26px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; color: ${C.teal};
          background: ${C.tealSoft};
        }
        .ur-title { margin: 4px 0 0; text-align: center; font-size: 22px; font-weight: 700; color: ${C.ink}; }
        .ur-sub { margin: 2px 0 14px; text-align: center; font-size: 12.5px; font-weight: 500; color: ${C.soft}; }
        .ur-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; }
        .ur-primary {
          display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-top: 14px; padding: 10px;
          border-radius: 6px; border: 1px solid ${C.brandLine}; cursor: pointer;
          background: ${C.brandSoft}; color: #000; font-size: 14px; font-weight: 700;
          transition: background 0.15s ease;
        }
        .ur-primary:hover { background: #fbd0bf; }
        .ur-secondary {
          display: block; width: 100%; margin-top: 8px; padding: 9px; border-radius: 6px; cursor: pointer;
          border: 1px solid ${C.field}; background: #fff; color: ${C.ink};
          font-size: 13px; font-weight: 600;
        }
        .ur-secondary:hover { background: ${C.page}; }

        .ur-toast {
          position: fixed; top: 18px; right: 18px; z-index: 2100; max-width: 340px;
          padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
          box-shadow: 0 8px 22px rgba(16, 24, 40, 0.18); display: flex; align-items: center; gap: 10px;
        }
        .ur-toast-ok { background: #effcf5; border: 1px solid #86efac; color: #15803d; }
        .ur-toast-err { background: #fff1f1; border: 1px solid #fca5a5; color: #b91c1c; }
        .ur-toast-x { border: none; background: transparent; color: inherit; font-weight: 900; cursor: pointer; }

        /* NEW: centered pop-up message */
        .ur-popup-overlay {
          position: fixed; inset: 0; z-index: 3000;
          display: flex; align-items: center; justify-content: center; padding: 16px;
          background: rgba(15, 30, 40, 0.45);
          animation: urFade 0.15s ease;
        }
        @keyframes urPopBounce {
          0% { opacity: 0; transform: scale(0.85) translateY(10px); }
          60% { opacity: 1; transform: scale(1.03); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes urPopBar { from { width: 100%; } to { width: 0%; } }
        .ur-popup {
          position: relative; width: 100%; max-width: 380px; text-align: center;
          background: #ffffff; border-radius: 12px; border: 1px solid ${C.line};
          box-shadow: 0 24px 60px rgba(16, 24, 40, 0.35);
          padding: 26px 24px 20px; overflow: hidden;
          animation: urPopBounce 0.3s ease;
          font-family: 'Noto Sans', 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif;
        }
        .ur-popup-icon {
          width: 64px; height: 64px; margin: 0 auto 12px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; font-size: 30px;
          background: ${C.brandSoft}; border: 1px solid ${C.brandLine};
        }
        .ur-popup h3 { margin: 0 0 6px; font-size: 20px; font-weight: 700; color: ${C.ink}; }
        .ur-popup p { margin: 0; font-size: 13.5px; font-weight: 500; color: ${C.soft}; line-height: 1.5; }
        .ur-popup-detail {
          margin: 12px 0 0; padding: 8px 12px; border-radius: 6px; font-size: 12.5px; font-weight: 600;
          background: ${C.tealSoft}; color: ${C.tealDark}; border: 1px solid #b9d6dd; word-break: break-word;
        }
        .ur-popup-btn {
          margin-top: 16px; width: 100%; padding: 9px; border-radius: 6px; cursor: pointer;
          border: 1px solid ${C.brandLine}; background: ${C.brandSoft}; color: #000;
          font-size: 13.5px; font-weight: 700; transition: background 0.15s ease;
        }
        .ur-popup-btn:hover { background: #fbd0bf; }
        .ur-popup-bar {
          position: absolute; left: 0; bottom: 0; height: 4px; background: ${C.teal};
          animation: urPopBar 3s linear forwards;
        }

        @media (max-width: 860px) {
          .ur-left { display: none; }
          .ur-right { padding: 20px 18px 22px; }
        }
        @media (max-width: 560px) {
          .ur-form-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Floating notices */}
      {success && (
        <div className="ur-toast ur-toast-ok">✓ {success}</div>
      )}
      {error && !showUserModal && (
        <div className="ur-toast ur-toast-err">
          ⚠️ {error}
          <button type="button" className="ur-toast-x" onClick={() => setError("")}>✕</button>
        </div>
      )}

      {/* NEW: CENTERED POP-UP (user created / broadcast launched) */}
      {popup && (
        <div
          className="ur-popup-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setPopup(null); }}
        >
          <div className="ur-popup" role="alertdialog" aria-live="polite">
            <div className="ur-popup-icon">{popup.icon}</div>
            <h3>{popup.title}</h3>
            <p>{popup.message}</p>
            {popup.detail && <div className="ur-popup-detail">{popup.detail}</div>}
            <button type="button" className="ur-popup-btn" onClick={() => setPopup(null)}>
              OK
            </button>
            <div className="ur-popup-bar" />
          </div>
        </div>
      )}

      {/* BROADCAST STUDIO MODAL */}
      {showBroadcastModal && (
        <div className="ur-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowBroadcastModal(false); }}>
          <div className="ur-bmodal ur-scroll">
            <button type="button" className="ur-close" style={{ zIndex: 5 }} onClick={() => setShowBroadcastModal(false)} aria-label="Close">✕</button>
            <div style={{ ...styles.card, marginBottom: 0, border: "none", borderRadius: 0 }}>
              <div
                style={{
                  ...styles.cardHeader,
                  background: "#ffffff",
                  color: C.ink,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  padding: "0.7rem 3.4rem 0.7rem 1.2rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", textAlign: "left" }}>
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "6px",
                      background: C.brandSoft,
                      border: `1px solid ${C.brandLine}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1rem"
                    }}
                  >
                    📡
                  </div>
                  <div>
                    <h2 style={{ fontSize: "1rem", fontWeight: "700", margin: 0, color: C.ink }}>
                      Broadcast Studio
                    </h2>
                    <p style={{ fontSize: "0.76rem", color: C.soft, margin: 0, fontWeight: 500 }}>
                      Send a live announcement to all user dashboards
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: isCurrentlyActive ? "#effcf5" : C.page,
                    border: `1px solid ${isCurrentlyActive ? "#86efac" : C.line}`,
                    padding: "3px 12px",
                    borderRadius: "999px"
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: isCurrentlyActive ? "#22c55e" : "#9aa7b4",
                      animation: isCurrentlyActive ? "pulseDot 1.6s infinite" : "none"
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: "700",
                      color: isCurrentlyActive ? "#15803d" : C.soft,
                      letterSpacing: "0.4px"
                    }}
                  >
                    {isCurrentlyActive ? "BROADCAST LIVE" : "NO BROADCAST"}
                  </span>
                </div>
              </div>

              <div style={{ ...styles.cardBody, backgroundColor: "#fafbfc" }}>
                {commentSuccess && (
                  <div style={{ ...styles.alert, ...styles.alertSuccess }}>
                    <span>✓</span>
                    {commentSuccess}
                  </div>
                )}

                {/* LIVE SIMULATOR BAR */}
                <div style={{ marginBottom: "0.8rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px", flexWrap: "wrap", gap: "4px" }}>
                    <span style={{ fontSize: "0.74rem", fontWeight: "700", color: C.soft }}>
                      Live ticker preview
                    </span>
                    <span style={{ fontSize: "0.72rem", color: C.soft, fontWeight: "500" }}>
                      Speed: {marqueeSpeed.toUpperCase()} • Theme: {currentTheme.label}
                    </span>
                  </div>

                  <div
                    style={{
                      height: "34px",
                      backgroundColor: "#ffffff",
                      borderRadius: "6px",
                      border: `1px solid ${currentTheme.color}`,
                      display: "flex",
                      alignItems: "center",
                      overflow: "hidden",
                      position: "relative"
                    }}
                  >
                    <div
                      style={{
                        background: currentTheme.color,
                        color: "#0c0c0e",
                        padding: "0 14px",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "0.75rem",
                        fontWeight: "800",
                        letterSpacing: "0.5px",
                        textTransform: "uppercase",
                        flexShrink: 0,
                        zIndex: 2
                      }}
                    >
                      <span>{currentTheme.icon}</span>
                      <span>{customBadge || currentTheme.badge}</span>
                    </div>

                    <div
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        position: "relative"
                      }}
                      onMouseEnter={() => setPreviewPaused(true)}
                      onMouseLeave={() => setPreviewPaused(false)}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          color: currentTheme.color,
                          fontWeight: "700",
                          fontSize: "0.85rem",
                          animation: `studioMarquee ${
                            marqueeSpeed === "fast" ? "10s" : marqueeSpeed === "slow" ? "24s" : "16s"
                          } linear infinite`,
                          animationPlayState: previewPaused ? "paused" : "running",
                          paddingLeft: "15px"
                        }}
                      >
                        {dashboardComment || "Type an announcement below to preview live scrolling..."}
                      </span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleCommentSubmit}>
                  {/* Theme Selectors */}
                  <div style={{ marginBottom: "0.7rem" }}>
                    <label style={{ ...styles.formLabel, marginBottom: "6px" }}>
                      <span>🎨</span> Announcement category
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {ANNOUNCEMENT_THEMES.map((theme) => (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => {
                            setAnnouncementType(theme.id);
                            if (!customBadge) setCustomBadge(theme.badge);
                          }}
                          style={{
                            padding: "4px 12px",
                            borderRadius: "6px",
                            fontSize: "0.8rem",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            border: `1px solid ${announcementType === theme.id ? theme.color : C.field}`,
                            background: announcementType === theme.id ? theme.bg : "#ffffff",
                            color: announcementType === theme.id ? theme.color : "#475569",
                            transition: "all 0.15s ease"
                          }}
                        >
                          <span>{theme.icon}</span>
                          <span>{theme.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message Input & Templates */}
                  <div style={{ marginBottom: "0.7rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label style={styles.formLabel}>
                        <span>✍️</span> Message
                      </label>
                      <span style={{ fontSize: "0.74rem", color: C.soft, fontWeight: "500" }}>
                        {dashboardComment.length} characters
                      </span>
                    </div>

                    <textarea
                      rows="2"
                      value={dashboardComment}
                      onChange={(e) => setDashboardComment(e.target.value)}
                      placeholder="Enter high-impact announcement to broadcast across all departments..."
                      style={{
                        ...styles.formInput,
                        fontFamily: "inherit",
                        resize: "vertical",
                        fontSize: "0.9rem",
                        borderColor: currentTheme.color
                      }}
                      required
                    />

                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.74rem", color: C.soft, fontWeight: "600" }}>Add icon:</span>
                        {["🚨", "⚠️", "⚡", "🔥", "📢", "🛠️", "🎉", "📦", "🕒", "🔒"].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => insertEmoji(emoji)}
                            style={{
                              background: "#ffffff",
                              border: `1px solid ${C.field}`,
                              borderRadius: "6px",
                              padding: "1px 7px",
                              fontSize: "0.85rem",
                              cursor: "pointer"
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.74rem", color: C.soft, fontWeight: "600" }}>Presets:</span>
                        {PRESET_TEMPLATES.map((tpl) => (
                          <button
                            key={tpl.label}
                            type="button"
                            onClick={() => applyTemplate(tpl)}
                            style={{
                              background: C.tealSoft,
                              border: "1px solid #b9d6dd",
                              borderRadius: "999px",
                              padding: "2px 10px",
                              fontSize: "0.72rem",
                              color: C.tealDark,
                              fontWeight: "600",
                              cursor: "pointer"
                            }}
                          >
                            {tpl.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Advanced Options */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "10px",
                      padding: "10px 12px",
                      background: "#ffffff",
                      borderRadius: "8px",
                      border: `1px solid ${C.line}`,
                      marginBottom: "0.8rem"
                    }}
                  >
                    <div>
                      <label style={{ fontSize: "0.74rem", fontWeight: "600", color: C.ink, display: "block", marginBottom: "3px" }}>
                        🏷️ Badge label
                      </label>
                      <input
                        type="text"
                        value={customBadge}
                        onChange={(e) => setCustomBadge(e.target.value)}
                        placeholder={currentTheme.badge}
                        style={{ ...styles.formInput, padding: "0.38rem 0.7rem", fontSize: "0.84rem" }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: "0.74rem", fontWeight: "600", color: C.ink, display: "block", marginBottom: "3px" }}>
                        ⏩ Scroll speed
                      </label>
                      <select
                        value={marqueeSpeed}
                        onChange={(e) => setMarqueeSpeed(e.target.value)}
                        style={{ ...styles.formSelect, padding: "0.38rem 0.7rem", fontSize: "0.84rem" }}
                      >
                        <option value="slow">Slow & Steady (24s cycle)</option>
                        <option value="normal">Standard Ticker (16s cycle)</option>
                        <option value="fast">Rapid Priority (10s cycle)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: "0.74rem", fontWeight: "600", color: C.ink, display: "block", marginBottom: "3px" }}>
                        🔔 Chime
                      </label>
                      <div
                        onClick={() => setEnableSound(!enableSound)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "0.38rem 0.7rem",
                          borderRadius: "6px",
                          border: `1px solid ${C.field}`,
                          cursor: "pointer",
                          background: enableSound ? C.tealSoft : "#ffffff",
                          fontSize: "0.83rem",
                          fontWeight: "600",
                          color: enableSound ? C.tealDark : C.soft
                        }}
                      >
                        <span>{enableSound ? "🔊 Sound Enabled" : "🔇 Silent Notice"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button
                      type="submit"
                      style={{
                        ...styles.submitBtn,
                        padding: "0.48rem 1.4rem"
                      }}
                    >
                      <span>🚀</span> Launch Broadcast Now
                    </button>

                    <button
                      type="button"
                      onClick={handleCommentClear}
                      style={{
                        ...styles.submitBtn,
                        background: C.dangerSoft,
                        border: `1px solid ${C.dangerLine}`,
                        color: C.danger,
                        padding: "0.48rem 1.3rem"
                      }}
                    >
                      <span>🗑️</span> Clear / Mute All
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* USER MODAL */}
      {showUserModal && (
        <div className="ur-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) cancelEdit(); }}>
          <div className="ur-modal" ref={formCardRef}>
            <div className="ur-left">
              <div className="ur-left-top">
                <span className="ur-left-label">User Management</span>
                <span className="ur-left-pill">Role-based access</span>
              </div>

              <div className="ur-left-center">
                <div className="ur-left-emblem"><FaUserTie /></div>
                <h2>{editUserId ? "Edit User" : "Add New User"}</h2>
                <p>
                  {editUserId
                    ? "Update this account's details"
                    : "Create an account, assign modules and locations in one go"}
                </p>
              </div>

              <div className="ur-left-bottom">
                <div className="ur-left-avatar">👥</div>
                <div>
                  <b>{users.length} users</b>
                  <small>registered in the system</small>
                </div>
              </div>
            </div>

            <div className="ur-right ur-scroll">
              <button type="button" className="ur-close" onClick={cancelEdit} aria-label="Close">✕</button>

              <div className="ur-right-brand">
                <span className="ur-mini-emblem"><FaUserTie /></span>
                <span>User Management</span>
              </div>

              <h3 className="ur-title">{editUserId ? "Edit User" : "Add New User"}</h3>
              <p className="ur-sub">
                {editUserId
                  ? "Update this account's details below"
                  : "Fill in the details to create a new account"}
              </p>

              {error && (
                <div style={{ ...styles.alert, ...styles.alertError }}>
                  <span>⚠️</span>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="ur-form-grid">
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>
                      <FaUserSecret /> Full Name
                    </label>
                    <input
                      name="name"
                      value={form.name}
                      style={styles.formInput}
                      placeholder="Enter full name"
                      onChange={handleChange}
                      onFocus={(e) => Object.assign(e.target.style, styles.formInputFocus)}
                      onBlur={resetBlur}
                      required
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>
                      <MdEmail /> Email Address
                    </label>
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      style={styles.formInput}
                      placeholder="Enter email address"
                      onChange={handleChange}
                      onFocus={(e) => Object.assign(e.target.style, styles.formInputFocus)}
                      onBlur={resetBlur}
                      disabled={!!editUserId}
                      required
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>
                      <RiLockPasswordFill /> {editUserId ? "New Password (optional)" : "Password"}
                    </label>
                    <div style={styles.passwordWrapper}>
                      <input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        style={{ ...styles.formInput, paddingRight: "2.6rem" }}
                        placeholder={editUserId ? "Leave blank to keep current password" : "Enter password"}
                        onChange={handleChange}
                        onFocus={(e) => Object.assign(e.target.style, styles.formInputFocus)}
                        onBlur={resetBlur}
                        required={!editUserId}
                      />
                      <button
                        type="button"
                        style={styles.passwordToggle}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>
                      <RiLockPasswordFill /> Confirm {editUserId ? "New " : ""}Password
                    </label>
                    <div style={styles.passwordWrapper}>
                      <input
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={form.confirmPassword}
                        style={{ ...styles.formInput, paddingRight: "2.6rem" }}
                        placeholder="Confirm password"
                        onChange={handleChange}
                        onFocus={(e) => Object.assign(e.target.style, styles.formInputFocus)}
                        onBlur={resetBlur}
                        required={!editUserId}
                      />
                      <button
                        type="button"
                        style={styles.passwordToggle}
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </div>

                  <div style={styles.formGroup}>
                    <div style={{ ...styles.formLabel, justifyContent: "space-between" }}>
                      <span><span>🎭</span> Role</span>
                      <button
                        type="button"
                        onClick={() => setShowNewRole((o) => !o)}
                        style={{ background: "none", border: "none", color: C.teal, fontSize: "0.74rem", fontWeight: 700, cursor: "pointer", padding: 0 }}
                      >
                        {showNewRole ? "✕ Close" : "+ New Role"}
                      </button>
                    </div>
                    <select
                      name="role"
                      value={form.role}
                      style={styles.formSelect}
                      onChange={(e) => {
                        handleChange(e);
                        if (e.target.value === "ADMIN") {
                          setSelectedModules([]);
                        } else {
                          const r = roleOptions.find((o) => o.value === e.target.value);
                          if (r?.modules) setSelectedModules(r.modules);
                        }
                      }}
                    >
                      {roleOptions.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>
                      <span>🧩</span> Assign Modules
                    </label>
                    {form.role === "ADMIN" ? (
                      <div style={styles.moduleAdminLocked}>
                        <span>🔓</span> Admin has access to all modules
                      </div>
                    ) : (
                      <div style={styles.moduleDropdown} ref={moduleDropdownRef}>
                        <button
                          type="button"
                          style={styles.moduleDropdownButton}
                          onClick={() => setModuleDropdownOpen((o) => !o)}
                        >
                          <span>
                            {selectedModules.length === 0
                              ? "All role modules (default)"
                              : `${selectedModules.length} module${selectedModules.length > 1 ? "s" : ""} selected`}
                          </span>
                          <span
                            style={{
                              transform: moduleDropdownOpen ? "rotate(180deg)" : "none",
                              transition: "transform 0.15s ease"
                            }}
                          >
                            ▾
                          </span>
                        </button>

                        {moduleDropdownOpen && (
                          <div className="ur-scroll" style={{ ...styles.moduleDropdownMenu, maxHeight: "190px" }}>
                            {getAllModules().map((item) => (
                              <label
                                key={item.to}
                                style={styles.moduleDropdownItem}
                                onMouseEnter={(e) => (e.currentTarget.style.background = C.tealSoft)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              >
                                <input
                                  type="checkbox"
                                  style={styles.moduleDropdownCheckbox}
                                  checked={selectedModules.includes(item.to)}
                                  onChange={() => handleModuleChange(item.to)}
                                />
                                {item.label}
                              </label>
                            ))}
                            <div style={styles.moduleDropdownFooter}>
                              Leave empty to give access to every module available for this role.
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {showNewRole && (
                    <div style={{ gridColumn: "1 / -1", background: "#fffbeb", border: "1px dashed #f3c35a", borderRadius: "8px", padding: "0.6rem 0.8rem" }}>
                      <label style={styles.formLabel}>Create new role</label>
                      <input
                        style={{ ...styles.formInput, marginBottom: "0.5rem" }}
                        placeholder="Role name (e.g. CEO)"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                      />
                      <div className="ur-scroll" style={{ ...styles.locationsGrid, maxHeight: "110px" }}>
                        {getAllModules()
                          .filter((m) => m.to !== "/internal-register" && m.to !== "/admin")
                          .map((m) => (
                            <label
                              key={m.to}
                              style={{ ...styles.locationChip, ...(newRoleModules.includes(m.to) ? styles.locationChipActive : {}) }}
                            >
                              <input
                                type="checkbox"
                                style={styles.locationCheckbox}
                                checked={newRoleModules.includes(m.to)}
                                onChange={() =>
                                  setNewRoleModules((prev) =>
                                    prev.includes(m.to) ? prev.filter((x) => x !== m.to) : [...prev, m.to]
                                  )
                                }
                              />
                              {newRoleModules.includes(m.to) ? "✓" : "○"} {m.label}
                            </label>
                          ))}
                      </div>
                      <button type="button" className="ur-secondary" style={{ marginTop: "0.5rem" }} onClick={saveNewRole}>
                        💾 Save Role
                      </button>
                    </div>
                  )}

                  <div style={{ ...styles.formGroup, ...styles.locationsSection }}>
                    <label style={styles.formLabel}>
                      <span>📍</span> Assign Locations
                    </label>
                    <div className="ur-scroll" style={styles.locationsGrid}>
                      {locations.map((loc) => (
                        <label
                          key={loc._id}
                          style={{
                            ...styles.locationChip,
                            ...(selectedLocations.includes(loc.locationName) ? styles.locationChipActive : {})
                          }}
                        >
                          <input
                            type="checkbox"
                            style={styles.locationCheckbox}
                            checked={selectedLocations.includes(loc.locationName)}
                            onChange={() => handleLocationChange(loc.locationName)}
                          />
                          {selectedLocations.includes(loc.locationName) ? "✓" : "○"} {loc.locationName}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <button type="submit" className="ur-primary">
                  <span>{editUserId ? "💾" : "✨"}</span>{" "}
                  {editUserId ? "Update User Account" : "Create User Account"}
                </button>
                <button type="button" className="ur-secondary" onClick={cancelEdit}>
                  {editUserId ? "✕ Cancel Edit" : "Cancel"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MAIN TABLE CARD ===================== */}
      <div style={styles.container}>
        <div style={styles.tableCard}>
          {/* Header: Title + User Count + Action Buttons */}
          <div style={styles.tableHeader}>
            <div style={styles.tableHeaderLeft}>
              <div style={styles.tableHeaderIcon}>👥</div>
              <h2 style={styles.tableHeaderTitle}>User Management</h2>
              <div style={styles.userCount}>{filteredUsers.length} Users</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                style={{
                  ...styles.submitBtn,
                  background: "#fff3d6",
                  border: "1px solid #f2d291"
                }}
                onClick={() => setShowBroadcastModal(true)}
              >
                <span>📢</span> Broadcast Studio
                {isCurrentlyActive && (
                  <span
                    title="A broadcast is live"
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#22c55e",
                      animation: "pulseDot 1.6s infinite"
                    }}
                  />
                )}
              </button>

              <button
                type="button"
                style={styles.submitBtn}
                onClick={() => {
                  resetForm();
                  setError("");
                  setSuccess("");
                  setShowUserModal(true);
                }}
              >
                <span>➕</span> Add New User
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              alignItems: "center",
              padding: "0.5rem 1rem",
              background: "#fafbfc",
              borderBottom: `1px solid ${C.line}`
            }}
          >
            <input
              type="text"
              placeholder="🔍 Filter by username..."
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              style={{ ...styles.formInput, maxWidth: "200px", padding: "0.2rem 0.6rem", fontSize: "0.78rem", height: "30px" }}
            />

            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              style={{ ...styles.formSelect, maxWidth: "150px", padding: "0.2rem 0.5rem", fontSize: "0.78rem", height: "30px" }}
            >
              <option value="">All Roles</option>
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              style={{ ...styles.formSelect, maxWidth: "170px", padding: "0.2rem 0.5rem", fontSize: "0.78rem", height: "30px" }}
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc._id} value={loc.locationName}>
                  {loc.locationName}
                </option>
              ))}
            </select>

            {(filterName || filterRole || filterLocation) && (
              <button
                type="button"
                onClick={() => {
                  setFilterName("");
                  setFilterRole("");
                  setFilterLocation("");
                }}
                style={{
                  ...styles.actionBtn,
                  padding: "0.15rem 0.6rem",
                  fontSize: "0.74rem",
                  height: "30px",
                  background: "#fff",
                  color: C.ink,
                  border: `1px solid ${C.field}`
                }}
              >
                ✕ Clear Filters
              </button>
            )}
          </div>

          {/* Scrollable table area */}
          <div className="ur-scroll" style={styles.tableWrapper}>
            {filteredUsers.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>👥</div>
                <p>No users found. Create your first user above!</p>
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>User</th>
                    <th style={styles.th}>Role</th>
                    <th style={styles.th}>Locations</th>
                    <th style={styles.th}>Modules</th>
                    <th style={styles.th}>Password</th>
                    <th style={{ ...styles.th, textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user._id}
                      style={{
                        transition: "background 0.15s ease",
                        background: editUserId === user._id ? C.tealSoft : "transparent"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f8fa")}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = editUserId === user._id ? C.tealSoft : "transparent")
                      }
                    >
                      <td style={styles.td}>
                        <div style={styles.userInfo}>
                          <div
                            style={{
                              ...styles.userAvatar,
                              background: getAvatarColor(user.name)
                            }}
                          >
                            {getInitials(user.name)}
                          </div>
                          <div>
                            <div style={styles.userName}>{user.name}</div>
                            <div style={styles.userEmail}>{user.email}</div>
                          </div>
                        </div>
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.roleBadge,
                            background: roleColors[user.role]?.bg || "#e7e5e4",
                            color: roleColors[user.role]?.text || "#292524"
                          }}
                        >
                          {user.role}
                        </span>
                      </td>

                      <td style={styles.td}>
                        {user.locations?.length > 1 ? (
                          <div
                            style={{ ...styles.moduleDropdown, minWidth: "150px" }}
                            ref={viewLocationsOpenId === user._id ? viewLocationsRef : null}
                          >
                            <button
                              type="button"
                              style={{ ...styles.moduleDropdownButton, padding: "0.26rem 0.65rem", fontSize: "0.78rem" }}
                              onClick={() => setViewLocationsOpenId((prev) => (prev === user._id ? null : user._id))}
                            >
                              <span>{`📍 ${user.locations.length} locations`}</span>
                              <span
                                style={{
                                  transform: viewLocationsOpenId === user._id ? "rotate(180deg)" : "none",
                                  transition: "transform 0.15s ease"
                                }}
                              >
                                ▾
                              </span>
                            </button>

                            {viewLocationsOpenId === user._id && (
                              <div className="ur-scroll" style={styles.moduleDropdownMenu}>
                                {user.locations.map((loc, idx) => (
                                  <div key={idx} style={styles.moduleViewItem}>
                                    ✓ {loc}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={styles.locationTags}>
                            {user.locations?.length === 1 ? (
                              <span style={styles.locationTag}>{user.locations[0]}</span>
                            ) : (
                              <span style={{ color: C.soft, fontSize: "0.85rem", fontWeight: "500" }}>
                                No locations
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td style={styles.td}>
                        {user.role === "ADMIN" ? (
                          <div style={styles.moduleAdminLockedSmall}>🔓 All modules (Admin)</div>
                        ) : (
                          <div
                            style={{ ...styles.moduleDropdown, minWidth: "165px" }}
                            ref={viewModulesOpenId === user._id ? viewModulesRef : null}
                          >
                            <button
                              type="button"
                              style={{ ...styles.moduleDropdownButton, padding: "0.26rem 0.65rem", fontSize: "0.78rem" }}
                              onClick={() => setViewModulesOpenId((prev) => (prev === user._id ? null : user._id))}
                            >
                              <span>
                                {user.modules?.length > 0
                                  ? `${user.modules.length} module${user.modules.length > 1 ? "s" : ""}`
                                  : "All role modules"}
                              </span>
                              <span
                                style={{
                                  transform: viewModulesOpenId === user._id ? "rotate(180deg)" : "none",
                                  transition: "transform 0.15s ease"
                                }}
                              >
                                ▾
                              </span>
                            </button>

                            {viewModulesOpenId === user._id && (
                              <div className="ur-scroll" style={styles.moduleDropdownMenu}>
                                {user.modules?.length > 0 ? (
                                  user.modules.map((to, idx) => (
                                    <div key={idx} style={styles.moduleViewItem}>
                                      ✓ {getModuleLabel(to)}
                                    </div>
                                  ))
                                ) : (
                                  <div style={styles.moduleDropdownFooter}>
                                    Full access to every module available for this role.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td style={styles.td}>
                        <span style={styles.passwordMask}>••••••••</span>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.actionBtns}>
                          <button
                            style={{ ...styles.actionBtn, ...styles.editBtn }}
                            onClick={() => startEdit(user)}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            style={{ ...styles.actionBtn, ...styles.deleteBtn }}
                            onClick={() => deleteUser(user._id)}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default InternalRegister;