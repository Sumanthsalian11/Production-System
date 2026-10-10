import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaUserTie } from "react-icons/fa";
import { MdEmail } from "react-icons/md";
import { FaUserSecret } from "react-icons/fa";
import { RiLockPasswordFill } from "react-icons/ri";
import BASE_URL from "../config/api";
import { getModulesForRole, getModuleLabel, getAllModules } from "../config/menuItems";

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

  // Announcement Studio States
  const [dashboardComment, setDashboardComment] = useState("");
  const [commentSuccess, setCommentSuccess] = useState("");
  const [announcementType, setAnnouncementType] = useState("broadcast");
  const [customBadge, setCustomBadge] = useState("");
  const [marqueeSpeed, setMarqueeSpeed] = useState("normal");
  const [enableSound, setEnableSound] = useState(true);
  const [isCurrentlyActive, setIsCurrentlyActive] = useState(false);
  const [previewPaused, setPreviewPaused] = useState(false);

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

  useEffect(() => {
    fetchLocations();
  }, []);

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
    ADMIN: { bg: "#f59e0b", text: "#422006" },
    PLANNER: { bg: "#fde68a", text: "#78350f" },
    SUPERVISOR: { bg: "#fed7aa", text: "#7c2d12" },
    PRODUCTION: { bg: "#bbf7d0", text: "#14532d" },
    INDENTER: { bg: "#bbf7d0", text: "#0487c4" },
    "PURCHASE ORDER": { bg: "#fef3c7", text: "#713f12" },
    DISPATCH: { bg: "#fecaca", text: "#7f1d1d" },
    KAS: { bg: "#fbcfe8", text: "#831843" },
    SCANNER: { bg: "#e7e5e4", text: "#292524" },
    PREPRESS: { bg: "#c7d2fe", text: "#3730a3" }
  };

  const currentTheme = ANNOUNCEMENT_THEMES.find((t) => t.id === announcementType) || ANNOUNCEMENT_THEMES[0];
  const inputShadow = "inset 0 2px 5px rgba(10, 80, 130, 0.1)";

  const styles = {
    pageContainer: {
      minHeight: "100vh",
      background:
        "radial-gradient(circle at 12% 6%, rgba(255,255,255,0.9) 0, rgba(255,255,255,0) 30%), radial-gradient(circle at 88% 18%, rgba(160,222,250,0.7) 0, rgba(160,222,250,0) 32%), radial-gradient(circle at 50% 100%, rgba(255,255,255,0.7) 0, rgba(255,255,255,0) 45%), linear-gradient(165deg, #eaf8ff 0%, #d2eefb 45%, #bde5f7 80%, #dff4fd 100%)",
      backgroundAttachment: "fixed",
      fontFamily: "'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif",
      padding: "0.8rem 1rem 2rem",
      color: "#0b2f4f"
    },
    container: {
      maxWidth: "100%",
      margin: "0 auto"
    },
    card: {
      background: "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(228,246,255,0.9) 100%)",
      borderRadius: "22px",
      boxShadow: "0 14px 32px rgba(40,120,170,0.16), inset 0 1px 0 #fff",
      marginBottom: "0.9rem",
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.95)"
    },
    cardHeader: {
      background: "linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%)",
      padding: "0.5rem 1.1rem",
      display: "flex",
      gap: "0.75rem",
      borderBottom: "1px solid #86c6e8",
      textAlign: "center",
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column"
    },
    cardBody: {
      padding: "0.8rem 1.1rem 0.9rem"
    },
    formGroup: {
      display: "flex",
      flexDirection: "column",
      gap: "0.25rem"
    },
    formLabel: {
      fontSize: "0.74rem",
      fontWeight: "800",
      color: "#0b2f4f",
      display: "flex",
      alignItems: "center",
      gap: "0.4rem"
    },
    formInput: {
      width: "100%",
      padding: "0.42rem 0.7rem",
      fontSize: "0.87rem",
      fontWeight: "600",
      border: "1.5px solid #9ccbe6",
      borderRadius: "12px",
      outline: "none",
      transition: "all 0.2s ease",
      background: "#fff",
      color: "#0b2f4f",
      boxShadow: inputShadow,
      boxSizing: "border-box"
    },
    formInputFocus: {
      borderColor: "#1b9be0",
      background: "#fff",
      boxShadow: "0 0 0 4px rgba(27, 155, 224, 0.2), 0 6px 14px rgba(27, 155, 224, 0.12)"
    },
    formSelect: {
      width: "100%",
      padding: "0.42rem 0.7rem",
      fontSize: "0.87rem",
      fontWeight: "600",
      border: "1.5px solid #9ccbe6",
      borderRadius: "12px",
      outline: "none",
      transition: "all 0.2s ease",
      background: "#fff",
      color: "#0b2f4f",
      cursor: "pointer",
      boxShadow: inputShadow,
      boxSizing: "border-box"
    },
    passwordWrapper: {
      position: "relative"
    },
    passwordToggle: {
      position: "absolute",
      right: "8px",
      top: "50%",
      transform: "translateY(-50%)",
      background: "#eaf8ff",
      border: "1px solid #9fcfe9",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "0.85rem",
      padding: "0.15rem 0.35rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#075985"
    },
    locationsSection: {
      gridColumn: "1 / -1",
      background: "rgba(255,255,255,0.7)",
      border: "1px solid #cfe8f6",
      borderRadius: "16px",
      padding: "0.45rem 0.8rem 0.55rem",
      boxShadow: "inset 0 1px 0 #fff"
    },
    locationsGrid: {
      display: "flex",
      flexWrap: "wrap",
      gap: "0.4rem",
      marginTop: "0.15rem"
    },
    locationChip: {
      display: "flex",
      alignItems: "center",
      gap: "0.35rem",
      padding: "0.25rem 0.7rem",
      borderRadius: "999px",
      cursor: "pointer",
      transition: "all 0.2s ease",
      fontSize: "0.77rem",
      fontWeight: "700",
      border: "1px solid #9fcfe9",
      background: "linear-gradient(180deg, #ffffff 0%, #eaf7ff 100%)",
      color: "#0a4f8c"
    },
    locationChipActive: {
      background: "linear-gradient(180deg, #d6f0fd 0%, #9ed6f4 100%)",
      borderColor: "#5fb4de",
      color: "#08406b",
      boxShadow: "0 4px 10px rgba(40,120,170,0.2)"
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
      border: "1.5px solid #9ccbe6",
      borderRadius: "12px",
      background: "#fff",
      color: "#0b2f4f",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      boxSizing: "border-box",
      boxShadow: inputShadow,
      fontWeight: "600"
    },
    moduleDropdownMenu: {
      position: "absolute",
      top: "calc(100% + 6px)",
      left: 0,
      right: 0,
      background: "#fff",
      border: "1px solid #9fcfe9",
      borderRadius: "14px",
      boxShadow: "0 14px 30px rgba(40, 120, 170, 0.22)",
      maxHeight: "260px",
      overflowY: "auto",
      zIndex: 30,
      padding: "0.5rem"
    },
    moduleDropdownItem: {
      display: "flex",
      alignItems: "center",
      gap: "0.6rem",
      padding: "0.5rem 0.6rem",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "0.84rem",
      color: "#0b2f4f",
      transition: "background 0.15s ease"
    },
    moduleDropdownCheckbox: {
      width: "16px",
      height: "16px",
      accentColor: "#0ea5e9",
      cursor: "pointer",
      flexShrink: 0
    },
    moduleDropdownFooter: {
      padding: "0.5rem 0.6rem 0.2rem",
      fontSize: "0.75rem",
      color: "#2f6d96",
      borderTop: "1px solid #e0f2fe",
      marginTop: "0.35rem"
    },
    moduleAdminLocked: {
      width: "100%",
      padding: "0.42rem 0.7rem",
      fontSize: "0.78rem",
      fontWeight: "700",
      border: "1px dashed #f3c35a",
      borderRadius: "12px",
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
      fontWeight: "700",
      border: "1px dashed #f3c35a",
      borderRadius: "8px",
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
      color: "#0b2f4f"
    },
    submitBtn: {
      background: "linear-gradient(180deg, #d6f0fd 0%, #9ed6f4 100%)",
      color: "#08406b",
      border: "1px solid #7fc3e8",
      padding: "0.42rem 1.1rem",
      borderRadius: "10px",
      fontSize: "0.82rem",
      fontWeight: "800",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: "0.45rem",
      transition: "all 0.2s ease",
      boxShadow: "0 2px 0 #7fbbe0, 0 5px 10px rgba(40, 120, 170, 0.15), inset 0 1px 0 rgba(255,255,255,0.8)"
    },
    alert: {
      padding: "0.55rem 0.9rem",
      borderRadius: "12px",
      marginBottom: "0.6rem",
      display: "flex",
      alignItems: "center",
      gap: "0.7rem",
      fontSize: "0.88rem",
      fontWeight: "700"
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
      background: "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(228,246,255,0.9) 100%)",
      borderRadius: "20px",
      boxShadow: "0 14px 32px rgba(40,120,170,0.16), inset 0 1px 0 #fff",
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.95)"
    },
    tableHeader: {
      background: "linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%)",
      padding: "0.45rem 1rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: "1px solid #86c6e8",
      flexWrap: "wrap",
      gap: "8px"
    },
    tableHeaderLeft: {
      display: "flex",
      alignItems: "center",
      gap: "0.65rem",
      color: "#08406b"
    },
    tableHeaderIcon: {
      width: "28px",
      height: "28px",
      background: "radial-gradient(circle at 30% 25%, #ffffff 0%, #d6effc 55%, #b3dff5 100%)",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "0.9rem",
      border: "1px solid #a9d9f2"
    },
    tableHeaderTitle: {
      fontSize: "0.98rem",
      fontWeight: "800",
      margin: 0
    },
    userCount: {
      background: "linear-gradient(180deg, #ffffff 0%, #d6effc 100%)",
      border: "1px solid #a9d9f2",
      padding: "0.2rem 0.65rem",
      borderRadius: "999px",
      color: "#08406b",
      fontSize: "0.76rem",
      fontWeight: "800"
    },
    tableWrapper: {
      overflowX: "auto"
    },
    table: {
      width: "100%",
      borderCollapse: "collapse"
    },
    th: {
      padding: "0.45rem 0.85rem",
      textAlign: "left",
      fontSize: "0.7rem",
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      color: "#08406b",
      background: "linear-gradient(180deg, #d9effc 0%, #b7e0f6 100%)",
      borderBottom: "1px solid #86c6e8"
    },
    td: {
      padding: "0.36rem 0.85rem",
      borderBottom: "1px solid #d3e8f4",
      fontSize: "0.86rem",
      color: "#0b2f4f",
      verticalAlign: "middle"
    },
    userInfo: {
      display: "flex",
      alignItems: "center",
      gap: "0.65rem",
      minWidth: "200px"
    },
    userAvatar: {
      width: "31px",
      height: "31px",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      fontSize: "0.76rem",
      fontWeight: "800",
      color: "#f0f9ff"
    },
    userName: {
      fontWeight: "800",
      fontSize: "0.88rem",
      lineHeight: 1.2,
      color: "#0b2f4f"
    },
    userEmail: {
      fontSize: "0.75rem",
      lineHeight: 1.2,
      color: "#4a6f8c",
      fontWeight: "600"
    },
    roleBadge: {
      display: "inline-flex",
      alignItems: "center",
      padding: "0.2rem 0.7rem",
      borderRadius: "999px",
      fontSize: "0.7rem",
      fontWeight: "800",
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
      background: "linear-gradient(180deg, #ffffff 0%, #e4f4fd 100%)",
      color: "#0a4f8c",
      padding: "0.14rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: "700",
      border: "1px solid #a9d9f2"
    },
    passwordMask: {
      fontFamily: "monospace",
      fontSize: "0.98rem",
      letterSpacing: "1.5px",
      color: "#4a6f8c",
      fontWeight: "700"
    },
    actionBtns: {
      display: "flex",
      gap: "0.45rem",
      justifyContent: "center",
      flexWrap: "wrap"
    },
    actionBtn: {
      padding: "0.26rem 0.7rem",
      borderRadius: "10px",
      border: "1px solid transparent",
      fontSize: "0.77rem",
      fontWeight: "800",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "0.35rem",
      transition: "all 0.2s ease"
    },
    editBtn: {
      background: "linear-gradient(180deg, #ffffff 0%, #d6effc 100%)",
      color: "#08406b",
      borderColor: "#7fc3e8"
    },
    deleteBtn: {
      background: "linear-gradient(180deg, #ffffff 0%, #fee2e2 100%)",
      color: "#b91c1c",
      borderColor: "#f3a5a5"
    },
    emptyState: {
      textAlign: "center",
      padding: "2.2rem 1rem",
      color: "#4a6f8c",
      fontWeight: "600"
    },
    emptyIcon: {
      fontSize: "2.6rem",
      marginBottom: "0.8rem"
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
    const colors = ["#0ea5e9", "#0284c7", "#0369a1", "#38bdf8", "#0c4a6e", "#0891b2", "#0e7490"];
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
    e.target.style.borderColor = "#9ccbe6";
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
          50% { transform: scale(1.2); opacity: 1; filter: drop-shadow(0 0 6px #22c55e); }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
        .ur-overlay {
          position: fixed; inset: 0; z-index: 2000;
          display: flex; align-items: center; justify-content: center; padding: 16px;
          background: rgba(40, 90, 130, 0.38); backdrop-filter: blur(6px);
          animation: urFade 0.18s ease;
        }
        @keyframes urFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes urPop { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: none; } }
        .ur-modal {
          position: relative; display: flex; width: 100%; max-width: 1000px; max-height: 92vh;
          background: #f7fcff; border-radius: 34px; overflow: hidden;
          border: 1px solid #fff;
          box-shadow: 0 30px 70px rgba(30, 70, 110, 0.35);
          animation: urPop 0.22s ease;
          font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif;
        }
        .ur-bmodal {
          position: relative; width: 100%; max-width: 920px; max-height: 92vh; overflow-y: auto;
          background: #f7fcff; border-radius: 30px; border: 1px solid #fff;
          box-shadow: 0 30px 70px rgba(30, 70, 110, 0.35);
          animation: urPop 0.22s ease;
        }
        .ur-left {
          position: relative; flex: 0 0 41%; margin: 14px 0 14px 14px; padding: 18px 22px 20px;
          display: flex; flex-direction: column; justify-content: space-between; overflow: hidden;
          border-radius: 28px; border: 5px solid #fff; color: #08406b;
          background:
            radial-gradient(circle at 20% 15%, rgba(255,255,255,0.85) 0, rgba(255,255,255,0) 40%),
            radial-gradient(circle at 80% 85%, rgba(255,214,150,0.55) 0, rgba(255,214,150,0) 45%),
            linear-gradient(160deg, #bfe5f8 0%, #8fd0f0 55%, #6fbbe8 100%);
          box-shadow: 0 10px 30px rgba(40, 120, 170, 0.25), inset 0 2px 0 rgba(255,255,255,0.7);
        }
        .ur-left::after {
          content: ""; position: absolute; right: -70px; top: -12%; height: 124%; width: 120px;
          background: #f7fcff; border-radius: 50%;
        }
        .ur-left-top { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .ur-left-label { font-size: 13px; font-weight: 800; letter-spacing: 0.3px; }
        .ur-left-pill {
          font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 999px;
          background: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.9); color: #0a4f8c;
        }
        .ur-left-center { position: relative; z-index: 2; text-align: center; padding-right: 26px; }
        .ur-left-emblem {
          width: 84px; height: 84px; margin: 0 auto 12px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; font-size: 38px; color: #0a6fb8;
          background: radial-gradient(circle at 30% 25%, #ffffff 0%, #e4f5ff 55%, #b6e0f6 100%);
          border: 2px solid #fff;
          box-shadow: 0 14px 30px rgba(10, 80, 130, 0.28), inset 0 3px 5px rgba(255,255,255,0.9);
        }
        .ur-left-center h2 { margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px; color: #07406b; }
        .ur-left-center p { margin: 6px auto 0; max-width: 230px; font-size: 12.5px; font-weight: 600; color: #1c5a85; line-height: 1.45; }
        .ur-left-bottom {
          position: relative; z-index: 2; align-self: flex-start;
          display: flex; align-items: center; gap: 10px; padding: 6px 16px 6px 6px; border-radius: 999px;
          background: rgba(255,255,255,0.75); border: 1px solid rgba(255,255,255,0.95);
          box-shadow: 0 6px 16px rgba(40,120,170,0.18);
        }
        .ur-left-avatar {
          width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px;
          background: linear-gradient(145deg, #fff0d1, #ffc978);
        }
        .ur-left-bottom b { display: block; font-size: 13px; font-weight: 800; color: #07406b; line-height: 1.1; }
        .ur-left-bottom small { font-size: 10.5px; font-weight: 600; color: #2f6d96; }
        .ur-planet { position: absolute; border-radius: 50%; z-index: 1; }
        .ur-planet-1 { width: 120px; height: 120px; right: 10px; top: 52px; background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(255,255,255,0.05) 70%); }
        .ur-planet-2 { width: 54px; height: 54px; left: 22px; bottom: 90px; background: radial-gradient(circle at 30% 30%, #ffe3b0, #ffb347 80%); opacity: 0.85; box-shadow: 0 6px 14px rgba(255,160,0,0.3); }
        .ur-planet-3 { width: 18px; height: 18px; left: 40%; top: 30%; background: radial-gradient(circle at 30% 30%, #fff, #bfe5f8); }

        .ur-right { position: relative; flex: 1; min-width: 0; overflow-y: auto; padding: 22px 34px 24px 12px; }
        .ur-close {
          position: absolute; top: 14px; right: 16px; width: 32px; height: 32px; border-radius: 50%;
          border: 1px solid #a9d9f2; background: linear-gradient(180deg, #ffffff, #e4f4fd); color: #08406b;
          font-size: 13px; font-weight: 800; cursor: pointer;
        }
        .ur-close:hover { background: #d6effc; }
        .ur-right-brand { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 800; color: #0a4f8c; margin-bottom: 8px; }
        .ur-mini-emblem {
          width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; color: #0a6fb8;
          background: radial-gradient(circle at 30% 25%, #ffffff 0%, #bfe5f8 55%, #8fd0f0 100%); border: 1px solid #86c6e8;
        }
        .ur-title { margin: 6px 0 0; text-align: center; font-size: 26px; font-weight: 900; letter-spacing: -0.4px; color: #0b2f4f; }
        .ur-sub { margin: 2px 0 12px; text-align: center; font-size: 12.5px; font-weight: 600; color: #4a6f8c; }
        .ur-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; }
        .ur-primary {
          display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-top: 14px; padding: 11px;
          border-radius: 14px; border: 1px solid #ee8f8f; cursor: pointer;
          background: linear-gradient(180deg, #ffe3df 0%, #f7a79f 100%); color: #8f1414; font-size: 14.5px; font-weight: 900;
          box-shadow: 0 3px 0 #e08a8a, 0 10px 18px rgba(220, 38, 38, 0.22), inset 0 1px 0 rgba(255,255,255,0.8);
          transition: all 0.15s ease;
        }
        .ur-primary:hover { transform: translateY(-1px); }
        .ur-primary:active { transform: translateY(2px); }
        .ur-secondary {
          display: block; width: 100%; margin-top: 8px; padding: 9px; border-radius: 14px; cursor: pointer;
          border: 1px solid #aac3d4; background: linear-gradient(180deg, #ffffff, #e3eef6); color: #34526b;
          font-size: 13px; font-weight: 800;
        }
        .ur-secondary:hover { background: #e4f4fd; }

        .ur-toast {
          position: fixed; top: 18px; right: 18px; z-index: 2100; max-width: 340px;
          padding: 11px 16px; border-radius: 14px; font-size: 13px; font-weight: 700;
          box-shadow: 0 10px 26px rgba(40, 120, 170, 0.22); display: flex; align-items: center; gap: 10px;
        }
        .ur-toast-ok { background: #effcf5; border: 1px solid #86efac; color: #15803d; }
        .ur-toast-err { background: #fff1f1; border: 1px solid #fca5a5; color: #b91c1c; }
        .ur-toast-x { border: none; background: transparent; color: inherit; font-weight: 900; cursor: pointer; }

        @media (max-width: 860px) {
          .ur-left { display: none; }
          .ur-right { padding: 20px 20px 22px; }
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

      {/* BROADCAST STUDIO MODAL */}
      {showBroadcastModal && (
        <div className="ur-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowBroadcastModal(false); }}>
          <div className="ur-bmodal">
            <button type="button" className="ur-close" style={{ zIndex: 5 }} onClick={() => setShowBroadcastModal(false)} aria-label="Close">✕</button>
            <div style={{ ...styles.card, marginBottom: 0, boxShadow: "none" }}>
              <div
                style={{
                  ...styles.cardHeader,
                  background: "linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%)",
                  color: "#08406b",
                  borderBottom: "1px solid #86c6e8",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  padding: "0.5rem 3.4rem 0.5rem 1.2rem"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", textAlign: "left" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "linear-gradient(180deg, #ffe9a8 0%, #ffc04d 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.1rem",
                      boxShadow: "0 4px 10px rgba(255, 160, 0, 0.3), inset 0 2px 3px rgba(255,255,255,0.8)"
                    }}
                  >
                    📡
                  </div>
                  <div>
                    <h2 style={{ fontSize: "1rem", fontWeight: "800", margin: 0, color: "#08406b", letterSpacing: "0.3px" }}>
                      Enterprise Broadcast Studio
                    </h2>
                    <p style={{ fontSize: "0.76rem", color: "#2f6d96", margin: 0, fontWeight: 600 }}>
                      High-priority real-time announcements broadcast across all user portals & logins
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: isCurrentlyActive ? "rgba(34, 197, 94, 0.15)" : "rgba(255, 255, 255, 0.7)",
                    border: `1px solid ${isCurrentlyActive ? "#22c55e" : "#9fcfe9"}`,
                    padding: "4px 14px",
                    borderRadius: "999px"
                  }}
                >
                  <span
                    style={{
                      width: "9px",
                      height: "9px",
                      borderRadius: "50%",
                      background: isCurrentlyActive ? "#22c55e" : "#8fb0c8",
                      boxShadow: isCurrentlyActive ? "0 0 8px #22c55e" : "none",
                      animation: isCurrentlyActive ? "pulseDot 1.6s infinite" : "none"
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.74rem",
                      fontWeight: "800",
                      color: isCurrentlyActive ? "#15803d" : "#4a6f8c",
                      letterSpacing: "0.5px"
                    }}
                  >
                    {isCurrentlyActive ? "BROADCAST LIVE" : "IDLE / NO BROADCAST"}
                  </span>
                </div>
              </div>

              <div style={{ ...styles.cardBody, backgroundColor: "rgba(244, 251, 255, 0.6)" }}>
                {commentSuccess && (
                  <div style={{ ...styles.alert, ...styles.alertSuccess, boxShadow: "0 4px 12px rgba(34, 197, 94, 0.15)" }}>
                    <span>✓</span>
                    {commentSuccess}
                  </div>
                )}

                {/* LIVE SIMULATOR BAR */}
                <div style={{ marginBottom: "0.8rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "0.74rem", fontWeight: "800", color: "#4a6f8c", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      🖥️ Live Ticker Simulator (Real-Time Preview)
                    </span>
                    <span style={{ fontSize: "0.72rem", color: "#4a6f8c", fontWeight: "600" }}>
                      Speed: {marqueeSpeed.toUpperCase()} • Theme: {currentTheme.label}
                    </span>
                  </div>

                  <div
                    style={{
                      height: "34px",
                      backgroundColor: "#ffffff",
                      borderRadius: "12px",
                      border: `1.5px solid ${currentTheme.color}`,
                      boxShadow: `0 4px 15px ${currentTheme.color}33`,
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
                        fontWeight: "900",
                        letterSpacing: "0.6px",
                        textTransform: "uppercase",
                        flexShrink: 0,
                        zIndex: 2,
                        boxShadow: "4px 0 10px rgba(0,0,0,0.15)"
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
                      <span>🎨</span> Choose Announcement Category & Visual Theme
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
                            padding: "5px 12px",
                            borderRadius: "12px",
                            fontSize: "0.8rem",
                            fontWeight: "800",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            border: `1.5px solid ${announcementType === theme.id ? theme.color : "#cbd5e1"}`,
                            background: announcementType === theme.id ? theme.bg : "#ffffff",
                            color: announcementType === theme.id ? theme.color : "#475569",
                            boxShadow: announcementType === theme.id ? `0 4px 12px ${theme.color}26` : "none",
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
                        <span>✍️</span> Broadcast Message Body
                      </label>
                      <span style={{ fontSize: "0.74rem", color: "#4a6f8c", fontWeight: "600" }}>
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
                        <span style={{ fontSize: "0.74rem", color: "#4a6f8c", fontWeight: "700" }}>Add Icon:</span>
                        {["🚨", "⚠️", "⚡", "🔥", "📢", "🛠️", "🎉", "📦", "🕒", "🔒"].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => insertEmoji(emoji)}
                            style={{
                              background: "#ffffff",
                              border: "1px solid #bfe0f2",
                              borderRadius: "8px",
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
                        <span style={{ fontSize: "0.74rem", color: "#4a6f8c", fontWeight: "700" }}>Presets:</span>
                        {PRESET_TEMPLATES.map((tpl) => (
                          <button
                            key={tpl.label}
                            type="button"
                            onClick={() => applyTemplate(tpl)}
                            style={{
                              background: "linear-gradient(180deg, #ffffff 0%, #e4f4fd 100%)",
                              border: "1px solid #a9d9f2",
                              borderRadius: "999px",
                              padding: "2px 10px",
                              fontSize: "0.72rem",
                              color: "#08406b",
                              fontWeight: "700",
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
                      padding: "8px 12px",
                      background: "rgba(255,255,255,0.75)",
                      borderRadius: "14px",
                      border: "1px solid #cfe8f6",
                      marginBottom: "0.8rem"
                    }}
                  >
                    <div>
                      <label style={{ fontSize: "0.74rem", fontWeight: "800", color: "#0b2f4f", display: "block", marginBottom: "3px" }}>
                        🏷️ Custom Badge Label
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
                      <label style={{ fontSize: "0.74rem", fontWeight: "800", color: "#0b2f4f", display: "block", marginBottom: "3px" }}>
                        ⏩ Marquee Scroll Speed
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
                      <label style={{ fontSize: "0.74rem", fontWeight: "800", color: "#0b2f4f", display: "block", marginBottom: "3px" }}>
                        🔔 Ambient Sci-Fi Chime
                      </label>
                      <div
                        onClick={() => setEnableSound(!enableSound)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "0.38rem 0.7rem",
                          borderRadius: "12px",
                          border: "1.5px solid #9ccbe6",
                          cursor: "pointer",
                          background: enableSound ? "#e4f4fd" : "#ffffff",
                          fontSize: "0.83rem",
                          fontWeight: "700",
                          color: enableSound ? "#0a4f8c" : "#4a6f8c"
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
                        background: "linear-gradient(180deg, #fff0c4 0%, #fcd477 100%)",
                        color: "#7a4f00",
                        border: "1px solid #f3c35a",
                        boxShadow: "0 3px 0 #e9b845, 0 7px 12px rgba(245, 158, 11, 0.18), inset 0 1px 0 rgba(255,255,255,0.8)",
                        padding: "0.5rem 1.4rem"
                      }}
                    >
                      <span>🚀</span> Launch Broadcast Now
                    </button>

                    <button
                      type="button"
                      onClick={handleCommentClear}
                      style={{
                        ...styles.submitBtn,
                        background: "linear-gradient(180deg, #ffffff 0%, #fee2e2 100%)",
                        border: "1px solid #f3a5a5",
                        color: "#b91c1c",
                        boxShadow: "none",
                        padding: "0.5rem 1.3rem"
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

              <span className="ur-planet ur-planet-1"></span>
              <span className="ur-planet ur-planet-2"></span>
              <span className="ur-planet ur-planet-3"></span>
            </div>

            <div className="ur-right">
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
                    <label style={styles.formLabel}>
                      <span>🎭</span> Role
                    </label>
                    <select
                      name="role"
                      value={form.role}
                      style={styles.formSelect}
                      onChange={(e) => {
                        handleChange(e);
                        if (e.target.value === "ADMIN") {
                          setSelectedModules([]);
                        }
                      }}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="PLANNER">Planner</option>
                      <option value="INDENTER">Indenter</option>
                      <option value="SUPERVISOR">Supervisor</option>
                      <option value="PRODUCTION">Production</option>
                      <option value="PURCHASE ORDER">Purchase Order</option>
                      <option value="DISPATCH">Dispatch</option>
                      <option value="KAS">KAS</option>
                      <option value="SCANNER">Scanner</option>
                      <option value="PREPRESS">Prepress</option>
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
                          <div style={{ ...styles.moduleDropdownMenu, maxHeight: "190px" }}>
                            {getAllModules().map((item) => (
                              <label
                                key={item.to}
                                style={styles.moduleDropdownItem}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#eaf8ff")}
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

                  <div style={{ ...styles.formGroup, ...styles.locationsSection }}>
                    <label style={styles.formLabel}>
                      <span>📍</span> Assign Locations
                    </label>
                    <div style={styles.locationsGrid}>
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
          {/* Integrated Header: Title + User Count + Action Buttons together */}
          <div style={styles.tableHeader}>
            <div style={styles.tableHeaderLeft}>
              <div style={styles.tableHeaderIcon}>👥</div>
              <h2 style={styles.tableHeaderTitle}>User Management</h2>
              <div style={styles.userCount}>{filteredUsers.length} Users</div>
            </div>

            {/* Embedded Action Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                style={{
                  ...styles.submitBtn,
                  background: "linear-gradient(180deg, #fff0c4 0%, #fcd477 100%)",
                  color: "#7a4f00",
                  border: "1px solid #f3c35a",
                  boxShadow: "0 2px 0 #e9b845, 0 4px 8px rgba(245, 158, 11, 0.18), inset 0 1px 0 rgba(255,255,255,0.8)"
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
                      boxShadow: "0 0 8px #22c55e",
                      animation: "pulseDot 1.6s infinite"
                    }}
                  />
                )}
              </button>

              <button
                type="button"
                style={{
                  ...styles.submitBtn,
                  background: "linear-gradient(180deg, #ffe3df 0%, #f7a79f 100%)",
                  color: "#8f1414",
                  border: "1px solid #ee8f8f",
                  boxShadow: "0 2px 0 #e08a8a, 0 4px 8px rgba(220, 38, 38, 0.18), inset 0 1px 0 rgba(255,255,255,0.8)"
                }}
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
              padding: "0.32rem 1rem",
              background: "rgba(255,255,255,0.7)",
              borderBottom: "1px solid #cfe8f6"
            }}
          >
            <input
              type="text"
              placeholder="🔍 Filter by username..."
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              style={{ ...styles.formInput, maxWidth: "185px", padding: "0.2rem 0.6rem", fontSize: "0.76rem", borderRadius: "10px", height: "28px" }}
            />

            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              style={{ ...styles.formSelect, maxWidth: "150px", padding: "0.2rem 0.5rem", fontSize: "0.76rem", borderRadius: "10px", height: "28px" }}
            >
              <option value="">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="PLANNER">Planner</option>
              <option value="INDENTER">Indenter</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="PRODUCTION">Production</option>
              <option value="PURCHASE ORDER">Purchase Order</option>
              <option value="DISPATCH">Dispatch</option>
              <option value="KAS">KAS</option>
              <option value="SCANNER">Scanner</option>
              <option value="PREPRESS">Prepress</option>
            </select>

            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              style={{ ...styles.formSelect, maxWidth: "165px", padding: "0.2rem 0.5rem", fontSize: "0.76rem", borderRadius: "10px", height: "28px" }}
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
                  fontSize: "0.72rem",
                  height: "28px",
                  background: "linear-gradient(180deg, #ffffff 0%, #e3eef6 100%)",
                  color: "#08406b",
                  border: "1px solid #9fcfe9"
                }}
              >
                ✕ Clear Filters
              </button>
            )}
          </div>

          <div style={styles.tableWrapper}>
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
                        transition: "background 0.2s ease",
                        background: editUserId === user._id ? "#eaf8ff" : "transparent"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#eaf8ff")}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = editUserId === user._id ? "#eaf8ff" : "transparent")
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
                              style={{ ...styles.moduleDropdownButton, padding: "0.26rem 0.65rem", fontSize: "0.78rem", borderRadius: "10px" }}
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
                              <div style={styles.moduleDropdownMenu}>
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
                              <span style={{ color: "#4a6f8c", fontSize: "0.875rem", fontWeight: "500" }}>
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
                              style={{ ...styles.moduleDropdownButton, padding: "0.26rem 0.65rem", fontSize: "0.78rem", borderRadius: "10px" }}
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
                              <div style={styles.moduleDropdownMenu}>
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