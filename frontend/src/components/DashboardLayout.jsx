import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useMemo, useRef } from "react";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import BASE_URL from "../config/api";
import menuItems from "../config/menuItems";

// 6 Organized Categories for the 3D App Launcher Grid (Admin Only)
const APP_CATEGORIES = [
  {
    title: "Admin & Setup",
    icon: "bi-shield-lock",
    color: "#0e7490",
    bgLight: "#ecfeff",
    borderGlow: "#a5f3fc",
    routes: ["/internal-register", "/admin"]
  },
  {
    title: "Planning & Prepress",
    icon: "bi-calendar2-range",
    color: "#2563eb",
    bgLight: "#eff6ff",
    borderGlow: "#bfdbfe",
    routes: ["/customer-dashboard", "/planner", "/scheduler", "/print", "/preprocess", "/plate-request", "/kas"]
  },
  {
    title: "Production",
    icon: "bi-gear-wide-connected",
    color: "#0369a1",
    bgLight: "#f0f9ff",
    borderGlow: "#bae6fd",
    routes: ["/new-in", "/production", "/production-real", "/perso", "/ocr-scan", "/shredding", "/click-report"]
  },
  {
    title: "Reports & Analytics",
    icon: "bi-bar-chart-line",
    color: "#db2777",
    bgLight: "#fdf2f8",
    borderGlow: "#fbcfe8",
    routes: ["/waste", "/summary", "/production-report", "/perso-report", "/perso-machine-report", "/billing-report", "/welcome-board", "/production-portal"]
  },
  {
    title: "Inward & Quality Control",
    icon: "bi-clipboard2-check",
    color: "#059669",
    bgLight: "#ecfdf5",
    borderGlow: "#a7f3d0",
    routes: ["/inward-register", "/receiving-inspection", "/inventory-dashboard", "/calibration", "/new-inspection", "/certificate-numbering"]
  },
  {
    title: "Dispatch & Logistics",
    icon: "bi-truck",
    color: "#7c3aed",
    bgLight: "#f5f3ff",
    borderGlow: "#ddd6fe",
    routes: ["/dispatch", "/manual-box", "/po-details", "/scan"]
  }
];

// Helper: Department branding & icon for non-admin roles (100% offline)
const getRoleTheme = (role) => {
  const r = (role || "").toLowerCase();
  if (r.includes("plan") || r.includes("sched")) {
    return { department: "Planning & Prepress", icon: "bi-calendar2-range-fill" };
  }
  if (r.includes("prod") || r.includes("operat")) {
    return { department: "Production Division", icon: "bi-gear-wide-connected" };
  }
  if (r.includes("disp") || r.includes("logis")) {
    return { department: "Dispatch & Logistics", icon: "bi-truck" };
  }
  if (r.includes("qc") || r.includes("qual") || r.includes("inspect")) {
    return { department: "Quality Inspection", icon: "bi-clipboard2-check-fill" };
  }
  if (r.includes("store") || r.includes("inven")) {
    return { department: "Inventory & Store", icon: "bi-boxes" };
  }
  if (r.includes("prep") || r.includes("print")) {
    return { department: "Prepress & Printing", icon: "bi-printer-fill" };
  }
  if (r.includes("perso")) {
    return { department: "Personalization Bureau", icon: "bi-credit-card-2-front-fill" };
  }
  if (r.includes("account") || r.includes("bill") || r.includes("report")) {
    return { department: "Reports & Accounts", icon: "bi-bar-chart-line-fill" };
  }
  if (r.includes("waste") || r.includes("shred")) {
    return { department: "Disposal & Shredding", icon: "bi-trash3-fill" };
  }
  return { department: "Operations Console", icon: "bi-person-workspace" };
};

// Crystal Synth Ambient Chime (Native Web Audio API, Zero dependencies)
const playChimeAudio = (type = "broadcast") => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const freqs = type === "critical" ? [880, 587.33, 880] : [587.33, 880, 1174.66];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.0001, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.08, now + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.45);
    });
  } catch {
    // Silent ignore if audio is blocked
  }
};

export default function DashboardLayout() {
  const [loggedInUser, setLoggedInUser] = useState("");
  const [userModules, setUserModules] = useState([]);
  const [userName, setUserName] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // App Launcher State (Admin only)
  const [showAppLauncher, setShowAppLauncher] = useState(false);
  const [launcherSearch, setLauncherSearch] = useState("");
  const searchInputRef = useRef(null);

  // Change Password State
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [cpForm, setCpForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [cpErrors, setCpErrors] = useState({});
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Role filter state
  const [selectedRole, setSelectedRole] = useState("all");

  // Focus & hover states
  const [focusedInput, setFocusedInput] = useState(null);
  const [toggleHover, setToggleHover] = useState(false);
  const [profileHover, setProfileHover] = useState(false);
  const [cpItemHover, setCpItemHover] = useState(false);
  const [logoutItemHover, setLogoutItemHover] = useState(false);
  const [cpFormHover, setCpFormHover] = useState(false);
  const [cpCancelHover, setCpCancelHover] = useState(false);
  const [eyeCurrentHover, setEyeCurrentHover] = useState(false);
  const [eyeNewHover, setEyeNewHover] = useState(false);
  const [eyeConfirmHover, setEyeConfirmHover] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = loggedInUser === "admin";
  const roleTheme = useMemo(() => getRoleTheme(loggedInUser), [loggedInUser]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setCollapsed(true);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setLoggedInUser((decoded.role || "user").toLowerCase());
        setUserName(decoded.name || decoded.username || decoded.userName || decoded.email || "");
        setUserModules(decoded.modules || []);
      } catch {
        setLoggedInUser("user");
      }
    }

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Smooth scroll lock when launcher is open
  useEffect(() => {
    if (showAppLauncher) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showAppLauncher]);

  // Keyboard shortcut: Ctrl + K or / toggles the 3D App Launcher (Admin only)
  useEffect(() => {
    if (!isAdmin) return;

    const handleKeyDown = (e) => {
      if ((e.ctrlKey && e.key === "k") || (e.key === "/" && document.activeElement.tagName !== "INPUT")) {
        e.preventDefault();
        setShowAppLauncher((prev) => !prev);
      } else if (e.key === "Escape") {
        setShowAppLauncher(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && showAppLauncher) {
      setTimeout(() => searchInputRef.current?.focus(), 120);
    } else {
      setLauncherSearch("");
    }
  }, [showAppLauncher, isAdmin]);

  // ==========================================
  // ANNOUNCEMENT STATE
  // ==========================================
  const [rawAnnouncement, setRawAnnouncement] = useState("");
  const [tickerPaused, setTickerPaused] = useState(false);
  const [isTickerMuted, setIsTickerMuted] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const lastAnnouncedTextRef = useRef("");

  const announcementData = useMemo(() => {
    if (!rawAnnouncement) return null;
    try {
      const parsed = JSON.parse(rawAnnouncement);
      if (parsed && typeof parsed === "object" && parsed.text) {
        return {
          text: parsed.text,
          type: parsed.type || "broadcast",
          badge: parsed.badge || (parsed.type === "critical" ? "CRITICAL ALERT" : "LIVE BROADCAST"),
          speed: parsed.speed || "normal",
          sound: parsed.sound !== false,
          timestamp: parsed.timestamp || null
        };
      }
    } catch {
      // Legacy plain text fallback
    }
    return {
      text: rawAnnouncement,
      type: "broadcast",
      badge: "LIVE BROADCAST",
      speed: "normal",
      sound: true,
      timestamp: null
    };
  }, [rawAnnouncement]);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${BASE_URL}/api/auth/announcement`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const newText = res.data?.text || "";
        setRawAnnouncement(newText);

        if (newText && newText !== lastAnnouncedTextRef.current) {
          lastAnnouncedTextRef.current = newText;
          if (!isTickerMuted) {
            playChimeAudio(announcementData?.type || "broadcast");
          }
        }
      } catch {
        setRawAnnouncement("");
      }
    };

    fetchAnnouncement();
    const interval = setInterval(fetchAnnouncement, 15000);
    return () => clearInterval(interval);
  }, [isTickerMuted, announcementData?.type]);

  const themeColors = useMemo(() => {
    const t = announcementData?.type || "broadcast";
    switch (t) {
      case "critical":
        return { primary: "#ef4444", secondary: "#b91c1c", glow: "rgba(239, 68, 68, 0.4)" };
      case "maintenance":
        return { primary: "#0ea5e9", secondary: "#0369a1", glow: "rgba(14, 165, 233, 0.4)" };
      case "celebration":
        return { primary: "#22c55e", secondary: "#15803d", glow: "rgba(34, 197, 94, 0.4)" };
      case "info":
        return { primary: "#a855f7", secondary: "#7e22ce", glow: "rgba(168, 85, 247, 0.4)" };
      default:
        return { primary: "#3b82f6", secondary: "#1d4ed8", glow: "rgba(59, 130, 246, 0.4)" };
    }
  }, [announcementData?.type]);

  const baseDuration = useMemo(() => {
    const sp = announcementData?.speed || "normal";
    if (sp === "fast") return 12;
    if (sp === "slow") return 30;
    return 20;
  }, [announcementData?.speed]);

  const actualDuration = baseDuration / speedMultiplier;

  const cycleSpeed = () => {
    setSpeedMultiplier((prev) => (prev === 1 ? 1.5 : prev === 1.5 ? 0.6 : 1));
  };

  const copyAnnouncement = () => {
    if (announcementData?.text) {
      navigator.clipboard.writeText(announcementData.text);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2000);
    }
  };

  const handleChangePassword = async () => {
    const newErrors = {};
    if (!cpForm.currentPassword) newErrors.currentPassword = "Required";
    if (!cpForm.newPassword) newErrors.newPassword = "Required";
    else if (cpForm.newPassword.length < 12) newErrors.newPassword = "Min 12 characters";
    if (!cpForm.confirmPassword) newErrors.confirmPassword = "Required";
    else if (cpForm.newPassword !== cpForm.confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    setCpErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${BASE_URL}/api/auth/change-password`,
        { currentPassword: cpForm.currentPassword, newPassword: cpForm.newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Password changed successfully!");
      setCpForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setCpErrors({});
      setShowChangePassword(false);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to change password");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const sidebarWidth = collapsed ? "64px" : "220px";

  const allowedModules = useMemo(() => {
    return menuItems.filter((item) => {
      const hasRole = !loggedInUser || loggedInUser === "admin" || item.roles.includes(loggedInUser);
      if (!hasRole) return false;
      if (loggedInUser !== "admin" && userModules.length > 0 && !userModules.includes(item.to)) {
        return false;
      }
      if (selectedRole !== "all" && !item.roles.includes(selectedRole)) {
        return false;
      }
      return true;
    });
  }, [loggedInUser, userModules, selectedRole]);

  const sidebarItems = useMemo(() => {
    if (!isAdmin) {
      return allowedModules;
    }
    const activeCategory = APP_CATEGORIES.find((cat) =>
      cat.routes.some((r) => location.pathname === r || location.pathname.startsWith(r + "/"))
    );
    if (activeCategory) {
      return allowedModules.filter((m) => activeCategory.routes.includes(m.to));
    }
    return allowedModules.slice(0, 6);
  }, [isAdmin, allowedModules, location.pathname]);

  // Current page info for the header
  const currentPage = useMemo(() => {
    const path = location.pathname;
    const match = menuItems.find((m) => path === m.to || path.startsWith(m.to + "/"));
    const cat = APP_CATEGORIES.find((c) =>
      c.routes.some((r) => path === r || path.startsWith(r + "/"))
    );
    return {
      title: match?.label || "Dashboard",
      icon: match?.icon || "bi-speedometer2",
      color: cat?.color || "#1d4ed8"
    };
  }, [location.pathname]);

  const inputStyle = (inputName, hasError) => {
    const isFocused = focusedInput === inputName;
    return {
      backgroundColor: "#eff6ff",
      border: "1.5px solid",
      borderColor: hasError ? "#ef4444" : isFocused ? "#3b82f6" : "#bfdbfe",
      color: "#1e3a5f",
      boxShadow: isFocused ? "0 0 0 3px rgba(59, 130, 246, 0.15)" : "none",
      transition: "all 0.2s ease",
      borderRadius: "8px 0 0 8px"
    };
  };

  const eyeButtonStyle = (hoverState) => ({
    backgroundColor: "#eff6ff",
    border: "1.5px solid #bfdbfe",
    borderLeft: "none",
    color: hoverState ? "#1d4ed8" : "#93c5fd",
    transition: "all 0.2s ease",
    borderRadius: "0 8px 8px 0"
  });

  const displayName = userName || loggedInUser || "User";
  const firstLetter = displayName.charAt(0).toUpperCase();
  const topOffset = isMobile ? 52 : 0;

  return (
    <div className="d-flex" style={{ overflowX: "hidden" }}>
      <style>{`
        @keyframes moltenFlow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes underlinePulse {
          0% { box-shadow: 0 2px 0 rgba(30, 60, 120, 0.2), 0 2px 8px rgba(59, 130, 246, 0.3); transform: scaleX(0.98); }
          50% { box-shadow: 0 3px 0 rgba(30, 60, 120, 0.2), 0 6px 18px rgba(29, 78, 216, 0.45); transform: scaleX(1.02); }
          100% { box-shadow: 0 2px 0 rgba(30, 60, 120, 0.2), 0 2px 8px rgba(59, 130, 246, 0.3); transform: scaleX(0.98); }
        }

        /* Seamless Dual-Track Infinite Loop */
        @keyframes infiniteTicker {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }

        @keyframes pulsePingLive {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.4; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes cyberScanbeam {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }

        /* Shining Gleam animation for Highlighted Logo */
        @keyframes logoShimmer {
          0% { transform: translateX(-150%) skewX(-25deg); opacity: 0; }
          25% { opacity: 0.75; }
          50% { transform: translateX(180%) skewX(-25deg); opacity: 0.85; }
          75% { opacity: 0.2; }
          100% { transform: translateX(250%) skewX(-25deg); opacity: 0; }
        }

        @keyframes logoGlowPulse {
          0%, 100% {
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.25), 0 2px 8px rgba(14, 165, 233, 0.15), inset 0 1px 1px #ffffff;
            border-color: #93c5fd;
          }
          50% {
            box-shadow: 0 0 18px rgba(37, 99, 235, 0.45), 0 4px 14px rgba(56, 189, 248, 0.35), inset 0 1px 2px #ffffff;
            border-color: #3b82f6;
          }
        }

        /* Continuous Holographic Shining Lightbeam for Sidebar Shield */
        @keyframes cyberShieldGleam {
          0% { transform: translateX(-120%) rotate(25deg); opacity: 0; }
          20% { opacity: 0.8; }
          50% { transform: translateX(140%) rotate(25deg); opacity: 0.9; }
          80% { opacity: 0.2; }
          100% { transform: translateX(200%) rotate(25deg); opacity: 0; }
        }

        @keyframes orbPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 12px rgba(59, 130, 246, 0.6), inset 0 0 8px rgba(255, 255, 255, 0.7); }
          50% { transform: scale(1.05); box-shadow: 0 0 22px rgba(14, 165, 233, 0.9), inset 0 0 12px rgba(255, 255, 255, 0.9); }
        }

        /* ===== ALWAYS-CENTERED EXECUTIVE HEADER ===== */
        .page-header-bar {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 20px;
          min-height: 58px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.97) 0%, rgba(240, 249, 255, 0.94) 50%, rgba(224, 242, 254, 0.95) 100%);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1.5px solid #bfdbfe;
          box-shadow: 0 3px 18px rgba(59, 130, 246, 0.08);
          overflow: visible;
        }

        /* Bottom reflective glow border */
        .page-header-bar::after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 1.5px;
          background: linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.5) 50%, transparent 100%);
        }

        /* ===== HIGHLIGHTED PREMIUM LOGO DOCK ===== */
        .header-logo-highlight {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%);
          border: 1.8px solid #93c5fd;
          border-radius: 12px;
          padding: 4px 12px;
          animation: logoGlowPulse 4s infinite ease-in-out;
          overflow: hidden;
          transition: all 0.25s ease;
          cursor: pointer;
        }
        .header-logo-highlight::after {
          content: "";
          position: absolute;
          top: -10px;
          left: -40px;
          width: 32px;
          height: 60px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.9), transparent);
          animation: logoShimmer 3.2s infinite;
          pointer-events: none;
        }
        .header-logo-highlight:hover {
          transform: translateY(-1.5px) scale(1.02);
          border-color: #2563eb;
          box-shadow: 0 0 20px rgba(37, 99, 235, 0.5), inset 0 1px 2px #ffffff;
        }

        /* Always dead-center title & icon */
        .page-header-center-anchor {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          max-width: 48%;
          pointer-events: none;
        }

        /* Refined, compact icon medallion */
        .page-header-icon-box {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.95rem;
          flex-shrink: 0;
          box-shadow: 0 2.5px 8px rgba(29, 78, 216, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.5);
          pointer-events: auto;
        }

        /* CAPS Header Title */
        .page-header-title {
          margin: 0;
          font-size: 1.3rem;
          font-weight: 900;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: #0f2d4a;
          line-height: 1.2;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
          pointer-events: auto;
        }

        /* ===== CLICK-TO-LOGOUT USER PILL WITH HOVER LOGOUT ICON ===== */
        .header-user-logout-pill {
          display: inline-flex;
          align-items: center;
          background: #ffffff;
          border: 1.5px solid #bfdbfe;
          border-radius: 50px;
          padding: 4px 10px 4px 4px;
          gap: 8px;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          user-select: none;
        }

        .header-user-logout-pill:hover {
          border-color: #ef4444;
          background: #fef2f2;
          box-shadow: 0 4px 14px rgba(239, 68, 68, 0.25);
          transform: translateY(-1px);
        }

        .user-avatar-badge {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, #60a5fa 0%, #1d4ed8 100%);
          color: #ffffff;
          font-weight: 800;
          font-size: 0.78rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(29, 78, 216, 0.35);
          transition: all 0.25s ease;
        }

        .header-user-logout-pill:hover .user-avatar-badge {
          background: linear-gradient(135deg, #f87171 0%, #dc2626 100%);
          box-shadow: 0 2px 8px rgba(220, 38, 38, 0.45);
        }

        /* Avatar swaps from Initial Letter to Logout Icon on Hover */
        .avatar-initial {
          display: block;
        }
        .avatar-logout-icon {
          display: none;
          font-size: 0.82rem;
        }
        .header-user-logout-pill:hover .avatar-initial {
          display: none;
        }
        .header-user-logout-pill:hover .avatar-logout-icon {
          display: block;
        }

        .header-user-meta {
          display: flex;
          flex-direction: column;
          line-height: 1.1;
          text-align: left;
        }

        .header-user-name {
          font-size: 0.78rem;
          font-weight: 800;
          color: #1e3a5f;
          max-width: 110px;
          transition: color 0.2s ease;
        }

        .header-user-logout-pill:hover .header-user-name {
          color: #dc2626;
        }

        .header-user-subtext {
          font-size: 0.62rem;
          font-weight: 700;
          color: #16a34a;
          letter-spacing: 0.3px;
          transition: color 0.2s ease;
        }

        .header-user-logout-pill:hover .header-user-subtext {
          color: #ef4444;
        }

        /* ===== SHINING SIDEBAR BRAND SHIELD ===== */
        .sidebar-brand-shield {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #0284c7 0%, #1e40af 50%, #4338ca 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-size: 1.25rem;
          overflow: hidden;
          box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.7);
          animation: orbPulse 3.5s ease-in-out infinite;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.4);
        }

        .sidebar-brand-shield::after {
          content: "";
          position: absolute;
          top: -20px;
          left: -40px;
          width: 35px;
          height: 90px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.85), transparent);
          animation: cyberShieldGleam 2.8s infinite;
          pointer-events: none;
        }

        @media (max-width: 767px) {
          .page-header-bar { padding: 6px 10px; min-height: 50px; }
          .page-header-center-anchor { max-width: 58%; gap: 6px; }
          .page-header-title { font-size: 0.95rem; letter-spacing: 0.8px; }
          .page-header-icon-box { width: 26px; height: 26px; font-size: 0.8rem; border-radius: 6px; }
          .header-user-meta { display: none; }
          .header-logo-highlight { padding: 2px 6px; }
          .header-logo-highlight img { height: 24px !important; }
        }

        /* 3D Trigger Button (Sidebar & Topbar) */
        .launcher-btn-3d {
          background: linear-gradient(180deg, #60a5fa 0%, #1d4ed8 100%);
          border: none;
          color: #ffffff;
          font-weight: 800;
          font-size: 0.82rem;
          padding: 7px 15px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          box-shadow: 0 3px 0 #1e3a8a, 0 5px 12px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.4);
          transform: translateY(0);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .launcher-btn-3d:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 0 #1e3a8a, 0 8px 18px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.5);
          color: #ffffff;
        }

        .role-hub-card {
          position: relative;
          background: linear-gradient(165deg, #ffffff 0%, #eff6ff 100%);
          border: 1.5px solid #bfdbfe;
          border-top: 2px solid #60a5fa;
          border-bottom: 3px solid #6d98cb;
          border-radius: 12px;
          padding: 9px 11px;
          box-shadow: 0 6px 18px rgba(59, 130, 246, 0.18), 0 0 14px rgba(59, 130, 246, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .role-medallion-3d {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: linear-gradient(180deg, #60a5fa 0%, #1d4ed8 100%);
          border: 1px solid #93c5fd;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2.5px 0 #1e3a8a, 0 3px 8px rgba(29, 78, 216, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.6);
          flex-shrink: 0;
        }

        .sidebar-nav-scroll::-webkit-scrollbar { width: 8px; height: 0; }
        .sidebar-nav-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-nav-scroll::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
        .sidebar-nav-scroll::-webkit-scrollbar-thumb { background: #e3f4ff; border-radius: 8px; border: 1px solid rgba(56, 189, 248, 0.25); }
        .sidebar-nav-scroll::-webkit-scrollbar-thumb:hover { background: #83daff; }
        @supports (-moz-appearance: none) {
          .sidebar-nav-scroll { scrollbar-width: thin; scrollbar-color: #e3f4ff transparent; }
        }
        .sidebar-nav-scroll .nav-link { flex-shrink: 0; }

        .sidebar-nav-link {
          transition: transform 0.15s ease, background-color 0.15s ease, color 0.15s ease;
          border-left: 3px solid transparent;
        }
        .sidebar-nav-link:hover:not(.active-nav-link) {
          background-color: #f0f9ff !important;
          color: #3b82f6 !important;
          transform: translateX(3px);
        }
        .sidebar-nav-link.active-nav-link {
          border-left-color: #1d4ed8;
        }

        /* 3D Application Launcher Modal */
        .launcher-overlay-3d {
          position: fixed;
          inset: 0;
          background: rgba(29, 78, 216, 0.15);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: 1070;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .launcher-panel-3d-smooth {
          background: linear-gradient(175deg, #ffffff 0%, #f9fafb 55%, #f1f5f9 100%);
          border: 1.5px solid #cbd5e1;
          border-radius: 24px;
          width: 100%;
          max-width: 1140px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 35px 70px -15px rgba(0, 0, 0, 0.35), inset 0 2px 0 #ffffff;
          padding: 32px 36px;
          color: #0f172a;
        }
        .search-well-3d-smooth {
          position: relative;
          background: #ffffff;
          border-radius: 12px;
          border: 1.5px solid #cbd5e1;
          box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.07);
        }
        .search-well-3d-smooth input {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          padding: 10px 14px 10px 40px;
          color: #0f172a;
          font-size: 0.85rem;
          font-weight: 600;
        }
        .category-deck-3d {
          background: linear-gradient(180deg, #ffffff 0%, #fcfdfd 60%, #f8fafc 100%);
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          border-top: 2px solid #ffffff;
          border-bottom: 3.5px solid #cbd5e1;
          padding: 18px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .app-keycap-3d {
          background: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%);
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 9px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #334155;
          text-decoration: none;
          font-size: 0.83rem;
          font-weight: 600;
          box-shadow: 0 3.5px 0 #cbd5e1;
        }
        .app-keycap-3d:hover {
          color: #0f172a;
          background: #eff6ff;
          border-color: #93c5fd;
          transform: translateY(-2px);
        }
        .app-keycap-3d.active-3d {
          background: linear-gradient(180deg, #60a5fa 0%, #1d4ed8 100%);
          color: #ffffff !important;
          border-color: #1d4ed8;
        }
        .btn-round-3d-smooth {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Ticker Action Buttons (Admin Only) */
        .ticker-action-btn {
          background: #ffffff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          border-radius: 6px;
          padding: 2px 7px;
          font-size: 0.72rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s ease;
        }
        .ticker-action-btn:hover {
          background: rgba(59, 130, 246, 0.15);
          border-color: #3b82f6;
          color: #1d4ed8;
        }
      `}</style>

      {/* MOBILE OVERLAY */}
      {isMobile && !collapsed && (
        <div
          onClick={() => setCollapsed(true)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(29, 78, 216, 0.12)",
            backdropFilter: "blur(4px)",
            zIndex: 1040
          }}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className="position-fixed d-flex flex-column"
        style={{
          width: sidebarWidth,
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 1050,
          left: isMobile ? (collapsed ? "-260px" : "0") : "0",
          top: 0,
          height: "100vh",
          backgroundColor: "#a8eee5",
          color: "#1e3a5f",
          borderRight: "1.5px solid #bfdbfe",
          boxShadow: "4px 0 24px rgba(59, 130, 246, 0.08)"
        }}
      >
        {/* BRAND HEADER: SHINING HOLOGRAPHIC SHIELD + toggle */}
        <div
          className="d-flex align-items-center"
          style={{
            height: "70px",
            padding: collapsed ? "0" : "0 14px",
            justifyContent: collapsed ? "center" : "space-between",
            gap: "10px",
            borderBottom: "1.5px solid #6d98cb",
            background: "linear-gradient(135deg, #a8eee5 0%, #8fd9ee 100%)",
            flexShrink: 0
          }}
        >
          {!collapsed && (
            <div className="d-flex align-items-center gap-2">
              {/* Shining Cyber Shield Badge */}
              <div className="sidebar-brand-shield" title="MPI Enterprise">
                <i className="bi bi-shield-shaded"></i>
              </div>
              <div className="d-flex flex-column" style={{ lineHeight: 1.15 }}>
                <span className="fw-black text-uppercase" style={{ fontSize: "0.86rem", fontWeight: 900, color: "#0f2d4a", letterSpacing: "1.1px" }}>
                  MPI CONSOLE
                </span>
                <span style={{ fontSize: "0.62rem", color: "#1d4ed8", fontWeight: 700, letterSpacing: "0.8px" }}>
                  SECURE CORE
                </span>
              </div>
            </div>
          )}

          <button
            className="btn d-flex align-items-center justify-content-center"
            onClick={() => setCollapsed(!collapsed)}
            onMouseEnter={() => setToggleHover(true)}
            onMouseLeave={() => setToggleHover(false)}
            style={{
              backgroundColor: toggleHover ? "#eff6ff" : "#ffffff",
              borderColor: toggleHover ? "#3b82f6" : "#bfdbfe",
              borderWidth: "1.5px",
              borderStyle: "solid",
              color: toggleHover ? "#1d4ed8" : "#94a3b8",
              transition: "all 0.2s ease",
              padding: "8px 12px",
              borderRadius: "8px",
              boxShadow: toggleHover ? "0 0 8px rgba(124, 200, 228, 0.15)" : "none",
              flexShrink: 0
            }}
          >
            <i className="bi bi-list fs-5"></i>
          </button>
        </div>

        <div
          className="p-3 border-bottom"
          style={{ borderColor: "#6d98cb", background: "linear-gradient(135deg, #a8eee5 0%, #8fd9ee 100%)" }}
        >
          {isAdmin ? (
            collapsed ? (
              <button
                className="btn w-100 p-2 d-flex justify-content-center align-items-center rounded-3 shadow-sm"
                onClick={() => setShowAppLauncher(true)}
                title="Open 3D App Launcher (Ctrl+K)"
                style={{ background: "linear-gradient(180deg, #60a5fa 0%, #1d4ed8 100%)", border: "none", color: "#ffffff" }}
              >
                <i className="bi bi-grid-3x3-gap-fill fs-5"></i>
              </button>
            ) : (
              <button
                className="launcher-btn-3d w-100 justify-content-center"
                onClick={() => setShowAppLauncher(true)}
              >
                <i className="bi bi-grid-3x3-gap-fill fs-6"></i>
                <span>All Modules</span>
              </button>
            )
          ) : collapsed ? (
            <div className="d-flex justify-content-center">
              <div
                className="role-medallion-3d"
                style={{ width: "38px", height: "38px", borderRadius: "10px", cursor: "default" }}
                title={`${loggedInUser ? loggedInUser.toUpperCase() : "USER"} - ${roleTheme.department} (${allowedModules.length} Modules)`}
              >
                <i className={`bi ${roleTheme.icon} fs-5`}></i>
              </div>
            </div>
          ) : (
            <div className="role-hub-card">
              <div className="d-flex align-items-center gap-2 mb-2">
                <div className="role-medallion-3d">
                  <i className={`bi ${roleTheme.icon} fs-6`}></i>
                </div>
                <div className="overflow-hidden flex-grow-1" style={{ minWidth: 0 }}>
                  <div
                    className="fw-bold text-truncate text-uppercase"
                    style={{ fontSize: "0.82rem", letterSpacing: "0.6px", color: "#1e3a5f" }}
                  >
                    <span style={{ color: "#1d4ed8" }}>{loggedInUser || "User"}</span> Role
                  </div>
                  <div
                    className="text-truncate text-uppercase"
                    style={{ color: "#64748b", fontSize: "0.64rem", fontWeight: "600", letterSpacing: "0.4px" }}
                  >
                    {roleTheme.department}
                  </div>
                </div>
              </div>

              <div
                className="d-flex align-items-center justify-content-between pt-2 mt-1"
                style={{ borderTop: "1px solid #bfdbfe", fontSize: "0.66rem" }}
              >
                <div className="d-flex align-items-center gap-1">
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      backgroundColor: "#22c55e",
                      boxShadow: "0 0 6px #22c55e",
                      display: "inline-block"
                    }}
                  />
                  <span className="fw-bold" style={{ color: "#16a34a", letterSpacing: "0.4px", fontSize: "0.62rem" }}>
                    ONLINE
                  </span>
                </div>

                <span
                  className="badge"
                  style={{
                    fontSize: "0.63rem",
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    border: "1px solid #bfdbfe",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    fontWeight: 700
                  }}
                >
                  {allowedModules.length} {allowedModules.length === 1 ? "Module" : "Modules"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav
          className="nav flex-column flex-nowrap p-2 gap-1 flex-grow-1 w-100 sidebar-nav-scroll"
          style={{ overflowY: "auto", overflowX: "hidden", minHeight: 0 }}
        >
          {!collapsed && (
            <div className="d-flex align-items-center justify-content-between px-2 py-1 mb-1">
              <div
                className="small fw-bold text-uppercase d-flex align-items-center gap-1"
                style={{ fontSize: "0.68rem", letterSpacing: "0.5px", color: "#1e3a5f" }}
              >
                <i className="bi bi-grid-fill" style={{ color: "#1d4ed8", fontSize: "0.7rem" }}></i>
                <span>{isAdmin ? "Active Category" : "Assigned Modules"}</span>
              </div>
              <span
                className="badge rounded-pill"
                style={{
                  backgroundColor: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                  fontSize: "0.62rem",
                  padding: "2px 6px"
                }}
              >
                {sidebarItems.length}
              </span>
            </div>
          )}

          {sidebarItems.map((item) => {
            const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => isMobile && setCollapsed(true)}
                className={`nav-link py-2 px-3 rounded d-flex align-items-center gap-3 mb-1 sidebar-nav-link ${isActive ? "active-nav-link" : ""}`}
                style={{
                  backgroundColor: isActive ? "#eff6ff" : "transparent",
                  color: isActive ? "#1d4ed8" : "#000000",
                  fontSize: "0.84rem",
                  fontWeight: isActive ? "700" : "500",
                  ...(isActive
                    ? {
                        boxShadow: "0 2px 10px rgba(59, 130, 246, 0.15)"
                      }
                    : {})
                }}
              >
                <i className={`bi ${item.icon}`} style={{ fontSize: "1rem" }}></i>
                {!collapsed && <span className="text-truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer: user menu (Change Password / Logout) */}
        <div
          className="p-3 border-top"
          style={{ borderColor: "#6d98cb", backgroundColor: "#a6cde7" }}
        >
          <div className="dropup">
            {collapsed ? (
              <div className="d-flex justify-content-center">
                <button
                  className="btn d-flex align-items-center justify-content-center fw-bold"
                  data-bs-toggle="dropdown"
                  title={displayName}
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    padding: 0,
                    background: "linear-gradient(135deg, #60a5fa 0%, #1d4ed8 100%)",
                    color: "#ffffff",
                    border: "none",
                    boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)"
                  }}
                >
                  {firstLetter}
                </button>
              </div>
            ) : (
              <button
                className="btn d-flex align-items-center gap-2 w-100 text-start"
                data-bs-toggle="dropdown"
                onMouseEnter={() => setProfileHover(true)}
                onMouseLeave={() => setProfileHover(false)}
                style={{
                  backgroundColor: profileHover ? "#eff6ff" : "#ffffff",
                  border: "1.5px solid",
                  borderColor: profileHover ? "#3b82f6" : "#bfdbfe",
                  borderRadius: "12px",
                  padding: "8px",
                  transition: "all 0.2s ease",
                  boxShadow: profileHover ? "0 0 8px rgba(59, 130, 246, 0.15)" : "0 1px 4px rgba(59, 130, 246, 0.08)"
                }}
              >
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                  style={{
                    width: "32px",
                    height: "32px",
                    background: "linear-gradient(135deg, #60a5fa 0%, #1d4ed8 100%)",
                    color: "#ffffff",
                    fontSize: "0.85rem",
                    boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
                    flexShrink: 0
                  }}
                >
                  {firstLetter}
                </div>
                <div className="text-truncate flex-grow-1" style={{ minWidth: 0 }}>
                  <div className="fw-bold text-capitalize text-truncate" style={{ fontSize: "0.8rem", color: "#1e3a5f" }}>
                    {displayName}
                  </div>
                  <div className="small" style={{ fontSize: "0.65rem", color: "#16a34a", fontWeight: 600 }}>
                    ● ONLINE
                  </div>
                </div>
                <i className="bi bi-chevron-up" style={{ color: "#94a3b8", fontSize: "0.8rem" }}></i>
              </button>
            )}

            <ul
              className="dropdown-menu py-2"
              style={{
                backgroundColor: "#ffffff",
                minWidth: "200px",
                borderRadius: "12px",
                border: "1.5px solid #bfdbfe",
                boxShadow: "0 8px 30px rgba(59, 130, 246, 0.12)",
                padding: "10px 6px"
              }}
            >
              <li
                className="dropdown-item-text fw-semibold text-capitalize mb-2 px-3 py-2 rounded"
                style={{ color: "#1d4ed8", fontSize: "0.95rem", backgroundColor: "#eff6ff" }}
              >
                <div className="small fw-normal" style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Signed In As
                </div>
                <div className="d-flex align-items-center gap-2 mt-1">
                  <i className="bi bi-shield-check" style={{ color: "#3b82f6" }}></i>
                  <span>{displayName}</span>
                </div>
              </li>

              <li>
                <hr className="dropdown-divider" style={{ borderColor: "#bfdbfe" }} />
              </li>

              <li>
                <button
                  className="dropdown-item d-flex align-items-center gap-2 rounded"
                  onClick={() => setShowChangePassword(true)}
                  onMouseEnter={() => setCpItemHover(true)}
                  onMouseLeave={() => setCpItemHover(false)}
                  style={{
                    color: cpItemHover ? "#1d4ed8" : "#475569",
                    backgroundColor: cpItemHover ? "#eff6ff" : "transparent",
                    transition: "all 0.2s ease",
                    padding: "10px 16px",
                    fontWeight: "500"
                  }}
                >
                  <i className="bi bi-key-fill" style={{ color: "#3b82f6" }}></i> Change Password
                </button>
              </li>

              <li>
                <button
                  className="dropdown-item text-danger d-flex align-items-center gap-2 rounded"
                  onClick={logout}
                  onMouseEnter={() => setLogoutItemHover(true)}
                  onMouseLeave={() => setLogoutItemHover(false)}
                  style={{
                    color: logoutItemHover ? "#dc2626" : "#f87171",
                    backgroundColor: logoutItemHover ? "rgba(239, 68, 68, 0.15)" : "transparent",
                    transition: "all 0.2s ease",
                    padding: "10px 16px",
                    fontWeight: "500"
                  }}
                >
                  <i className="bi bi-box-arrow-right"></i> Logout
                </button>
              </li>
            </ul>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div
        className="flex-grow-1"
        style={{
          marginLeft: isMobile ? "0" : sidebarWidth,
          transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          width: "100%",
          minHeight: "100vh",
          overflowX: "hidden"
        }}
      >
        {/* Mobile only: floating button to open the sidebar */}
        {isMobile && collapsed && (
          <button
            className="btn d-flex align-items-center justify-content-center"
            onClick={() => setCollapsed(false)}
            style={{
              position: "fixed",
              top: "8px",
              left: "8px",
              zIndex: 1045,
              backgroundColor: "#ffffff",
              border: "1.5px solid #bfdbfe",
              color: "#1d4ed8",
              padding: "8px 12px",
              borderRadius: "8px",
              boxShadow: "0 2px 10px rgba(59, 130, 246, 0.2)"
            }}
          >
            <i className="bi bi-list fs-5"></i>
          </button>
        )}

        {/* =========================================================================
            ANNOUNCEMENT TICKER (CONTROLS VISIBLE ONLY TO ADMIN)
            ========================================================================= */}
        {announcementData?.text && !isMinimized && (
          <div
            style={{
              position: "fixed",
              top: `${topOffset}px`,
              left: isMobile ? 0 : sidebarWidth,
              right: 0,
              height: "36px",
              backgroundColor: "#eff6ff",
              borderBottom: `1.5px solid ${themeColors.primary}`,
              boxShadow: `0 4px 18px ${themeColors.glow}`,
              zIndex: 1029,
              display: "flex",
              alignItems: "center",
              overflow: "hidden",
              transition: "all 0.3s ease"
            }}
          >
            {/* Cyber Scan Line Effect */}
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                width: "120px",
                background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.12), transparent)",
                animation: "cyberScanbeam 6s linear infinite",
                pointerEvents: "none",
                zIndex: 1
              }}
            />

            {/* Left 3D Glowing Badge */}
            <div
              style={{
                background: `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.secondary} 100%)`,
                color: "#ffffff",
                padding: "0 12px",
                height: "100%",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.74rem",
                fontWeight: "900",
                letterSpacing: "0.6px",
                textTransform: "uppercase",
                boxShadow: "4px 0 14px rgba(59, 130, 246, 0.25)",
                zIndex: 4,
                flexShrink: 0
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#ffffff",
                  animation: "pulsePingLive 1.4s infinite"
                }}
              />
              <span>{announcementData.badge}</span>
            </div>

            {/* Seamless Dual-Track Infinite Loop Container */}
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                height: "100%",
                display: "flex",
                alignItems: "center",
                position: "relative",
                cursor: isAdmin ? "pointer" : "default"
              }}
              onMouseEnter={() => setTickerPaused(true)}
              onMouseLeave={() => setTickerPaused(false)}
              onClick={() => {
                if (isAdmin) setShowDetailModal(true);
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: "max-content",
                  animation: `infiniteTicker ${actualDuration}s linear infinite`,
                  animationPlayState: tickerPaused ? "paused" : "running"
                }}
              >
                {/* Track 1 */}
                <div style={{ display: "flex", alignItems: "center", paddingRight: "60px" }}>
                  <span
                    style={{
                      color: themeColors.primary,
                      fontWeight: "700",
                      fontSize: "0.85rem",
                      letterSpacing: "0.3px",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {announcementData.text}
                  </span>
                  <span style={{ color: "#93c5fd", margin: "0 25px" }}>❖</span>
                </div>

                {/* Track 2 */}
                <div style={{ display: "flex", alignItems: "center", paddingRight: "60px" }}>
                  <span
                    style={{
                      color: themeColors.primary,
                      fontWeight: "700",
                      fontSize: "0.85rem",
                      letterSpacing: "0.3px",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {announcementData.text}
                  </span>
                  <span style={{ color: "#93c5fd", margin: "0 25px" }}>❖</span>
                </div>
              </div>
            </div>

            {/* Right Interactive Controls - ONLY FOR ADMIN */}
            {isAdmin && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "0 10px",
                  background: "linear-gradient(90deg, transparent 0%, #eff6ff 25%)",
                  height: "100%",
                  zIndex: 4,
                  flexShrink: 0
                }}
              >
                {/* Play / Pause Toggle */}
                <button
                  className="ticker-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTickerPaused(!tickerPaused);
                  }}
                  title={tickerPaused ? "Resume scrolling" : "Pause scrolling"}
                >
                  <i
                    className={`bi ${tickerPaused ? "bi-play-fill" : "bi-pause-fill"}`}
                    style={tickerPaused ? { color: "#3b82f6" } : undefined}
                  ></i>
                </button>

                {/* Speed Multiplier */}
                <button
                  className="ticker-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    cycleSpeed();
                  }}
                  title={`Current speed: ${speedMultiplier}x (Click to cycle)`}
                >
                  <span>{speedMultiplier}x</span>
                </button>

                {/* Audio Chime Mute/Unmute */}
                <button
                  className="ticker-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsTickerMuted(!isTickerMuted);
                    if (isTickerMuted) playChimeAudio(announcementData?.type);
                  }}
                  title={isTickerMuted ? "Sound chime muted" : "Sound chime active (Click to test)"}
                >
                  <i
                    className={`bi ${isTickerMuted ? "bi-volume-mute text-secondary" : "bi-volume-up"}`}
                    style={isTickerMuted ? undefined : { color: "#3b82f6" }}
                  ></i>
                </button>

                {/* View Details */}
                <button
                  className="ticker-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetailModal(true);
                  }}
                  title="Full Announcement Details"
                >
                  <i className="bi bi-arrows-fullscreen"></i>
                </button>

                {/* Minimize Strip */}
                <button
                  className="ticker-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(true);
                  }}
                  title="Minimize ticker"
                >
                  <i className="bi bi-dash-lg"></i>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Minimized Pill Restore Button (Only for Admin) */}
        {isAdmin && announcementData?.text && isMinimized && (
          <div
            onClick={() => setIsMinimized(false)}
            style={{
              position: "fixed",
              top: `${topOffset + 6}px`,
              right: "20px",
              zIndex: 1035,
              background: `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.secondary} 100%)`,
              color: "#ffffff",
              borderRadius: "999px",
              padding: "5px 12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              fontWeight: "800",
              fontSize: "0.74rem",
              boxShadow: `0 4px 15px ${themeColors.glow}`,
              border: "1px solid #ffffff"
            }}
            title="Click to restore broadcast ticker"
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#ffffff",
                animation: "pulsePingLive 1.4s infinite"
              }}
            />
            <span>RESTORE BULLETIN</span>
          </div>
        )}

        {/* Content Outlet */}
        <div
          className="p-3 p-md-0 bg-light"
          style={{
            minHeight: `calc(100vh - ${topOffset + (announcementData?.text && !isMinimized ? 36 : 0)}px)`,
            marginTop: `${topOffset + (announcementData?.text && !isMinimized ? 36 : 0)}px`,
            transition: "margin-top 0.2s ease"
          }}
        >
          {/* =========================================================================
              CLEAN ALWAYS-CENTERED PAGE HEADER (HIGHLIGHTED LOGO + CLICK-TO-LOGOUT USER)
              ========================================================================= */}
          <div
            className="page-header-bar"
            style={{
              position: "fixed",
              top: `${topOffset + (announcementData?.text && !isMinimized ? 36 : 0)}px`,
              left: isMobile ? 0 : sidebarWidth,
              right: 0,
              zIndex: 1028,
              transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1), top 0.2s ease",
              ...(isMobile ? { borderRadius: "14px", margin: "10px", padding: "8px 12px" } : {})
            }}
          >
            
            {/* LEFT SIDE: HIGHLIGHTED MPI LOGO WITH AMBIENT GLOW & SHIMMER */}
            <div className="header-logo-highlight" title="MPI Enterprise">
              <img
                src="Logo.png"
                alt="MPI Logo"
                style={{
                  height: "28px",
                  width: "auto",
                  maxWidth: "115px",
                  objectFit: "contain",
                  filter: "drop-shadow(0 2px 4px rgba(29, 78, 216, 0.25))"
                }}
              />
            </div>

            {/* ABSOLUTE CENTER TITLE & COMPACT ICON (Always perfectly dead-centered) */}
            <div className="page-header-center-anchor">
              <div
                className="page-header-icon-box"
                style={{
                  background: `linear-gradient(135deg, ${currentPage.color} 0%, #1e3a8a 100%)`
                }}
              >
                <i className={`bi ${currentPage.icon}`}></i>
              </div>
              <h1 className="page-header-title" title={currentPage.title}>
                {currentPage.title}
              </h1>
            </div>

            {/* RIGHT SIDE: CLICKABLE USER PILL (HOVER SHOWS LOGOUT ICON, CLICK LOGS OUT) */}
            <div className="d-flex align-items-center">
              <div
                className="header-user-logout-pill"
                onClick={logout}
                title={`Logged in as ${displayName} (${loggedInUser || "User"}) • Click to Logout`}
              >
                <div className="user-avatar-badge">
                  <span className="avatar-initial">{firstLetter}</span>
                  <i className="bi bi-box-arrow-right avatar-logout-icon"></i>
                </div>

                <div className="header-user-meta">
                  <span className="header-user-name text-truncate">
                    {displayName}
                  </span>
                  <span className="header-user-subtext text-capitalize">
                    ● {loggedInUser || "Online"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* spacer = height of the fixed header bar */}
          <div style={{ height: isMobile ? 70 : 58 }} />

          <Outlet />
        </div>
      </div>

      {/* ANNOUNCEMENT FULL DETAIL POPUP MODAL (ADMIN ONLY) */}
      {isAdmin && showDetailModal && announcementData?.text && (
        <>
          <div
            onClick={() => setShowDetailModal(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(29, 78, 216, 0.18)",
              backdropFilter: "blur(6px)",
              zIndex: 1080
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 1085,
              width: "92%",
              maxWidth: "520px",
              background: "linear-gradient(175deg, #ffffff 0%, #eff6ff 100%)",
              borderRadius: "18px",
              border: `2px solid ${themeColors.primary}`,
              boxShadow: `0 25px 60px rgba(59, 130, 246, 0.25), 0 0 30px ${themeColors.glow}`,
              padding: "26px",
              color: "#1e3a5f"
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2" style={{ borderColor: "#bfdbfe" }}>
              <div className="d-flex align-items-center gap-2">
                <span
                  className="badge"
                  style={{
                    background: themeColors.primary,
                    color: "#ffffff",
                    fontWeight: "900",
                    fontSize: "0.75rem",
                    padding: "5px 10px",
                    borderRadius: "6px"
                  }}
                >
                  {announcementData.badge}
                </span>
                <span className="small" style={{ color: "#64748b" }}>
                  {announcementData.timestamp ? new Date(announcementData.timestamp).toLocaleTimeString() : "Live Notice"}
                </span>
              </div>
              <button
                className="btn btn-sm btn-link p-0"
                onClick={() => setShowDetailModal(false)}
                style={{ color: "#64748b" }}
              >
                <i className="bi bi-x-lg fs-5"></i>
              </button>
            </div>

            <div
              style={{
                fontSize: "1.05rem",
                lineHeight: "1.6",
                color: "#1e3a5f",
                fontWeight: "500",
                background: "#eff6ff",
                padding: "16px",
                borderRadius: "12px",
                border: "1px solid #bfdbfe",
                marginBottom: "20px"
              }}
            >
              {announcementData.text}
            </div>

            <div className="d-flex gap-2 justify-content-end">
              <button
                className="btn btn-sm fw-bold d-flex align-items-center gap-2"
                onClick={copyAnnouncement}
                style={{
                  background: "#ffffff",
                  color: copiedNotification ? "#16a34a" : "#1d4ed8",
                  border: "1.5px solid #bfdbfe",
                  borderRadius: "8px",
                  padding: "8px 16px"
                }}
              >
                <i className={`bi ${copiedNotification ? "bi-check2" : "bi-clipboard"}`}></i>
                <span>{copiedNotification ? "Copied!" : "Copy Text"}</span>
              </button>
              <button
                className="btn btn-sm fw-bold"
                onClick={() => setShowDetailModal(false)}
                style={{
                  background: themeColors.primary,
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 20px"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* 3D LIGHT APPLICATION LAUNCHER MODAL */}
      {isAdmin && showAppLauncher && (
        <div className="launcher-overlay-3d" onClick={() => setShowAppLauncher(false)}>
          <div className="launcher-panel-3d-smooth" onClick={(e) => e.stopPropagation()}>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-3 border-bottom" style={{ borderColor: "#e2e8f0" }}>
              <div className="d-flex align-items-center gap-3">
                <div className="category-medallion-smooth" style={{ background: "#eff6ff", color: "#2563eb", borderColor: "#bfdbfe" }}>
                  <i className="bi bi-grid-3x3-gap-fill fs-5"></i>
                </div>
                <div>
                  <h5 className="mb-0 fw-bold text-dark text-uppercase" style={{ letterSpacing: "0.6px" }}>
                    MODULE LAUNCHER
                  </h5>
                  <div className="text-secondary small fw-semibold">
                    MPI Enterprise Modules Console (All 29 Services)
                  </div>
                </div>
              </div>

              <div className="search-well-3d-smooth" style={{ width: "340px" }}>
                <i
                  className="bi bi-search position-absolute text-muted"
                  style={{ left: "14px", top: "50%", transform: "translateY(-50%)" }}
                ></i>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Quick find module... (Type name or URL)"
                  value={launcherSearch}
                  onChange={(e) => setLauncherSearch(e.target.value)}
                />
              </div>

              <button
                className="btn-round-3d-smooth"
                onClick={() => setShowAppLauncher(false)}
                title="Close (Esc)"
              >
                <i className="bi bi-x-lg fs-6"></i>
              </button>
            </div>

            <div className="row g-3">
              {APP_CATEGORIES.map((cat) => {
                const q = launcherSearch.toLowerCase().trim();
                const catItems = allowedModules.filter((m) => {
                  if (!cat.routes.includes(m.to)) return false;
                  if (q) return m.label.toLowerCase().includes(q) || m.to.toLowerCase().includes(q);
                  return true;
                });

                if (catItems.length === 0) return null;

                return (
                  <div key={cat.title} className="col-lg-4 col-md-6">
                    <div className="category-deck-3d">
                      <div className="category-header-3d-smooth">
                        <div className="category-medallion-smooth" style={{ background: cat.bgLight, color: cat.color, borderColor: cat.borderGlow }}>
                          <i className={`bi ${cat.icon}`}></i>
                        </div>
                        <div className="fw-bold small text-uppercase" style={{ color: cat.color, letterSpacing: "0.5px" }}>
                          {cat.title}
                        </div>
                        <span className="badge bg-light border text-secondary ms-auto small px-2 py-1 rounded-pill">
                          {catItems.length}
                        </span>
                      </div>

                      <div className="d-flex flex-column gap-2 flex-grow-1">
                        {catItems.map((item) => {
                          const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                          return (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              onClick={() => setShowAppLauncher(false)}
                              className={`app-keycap-3d ${isActive ? "active-3d" : ""}`}
                            >
                              <i className={`bi ${item.icon}`} style={{ fontSize: "0.95rem" }}></i>
                              <span className="text-truncate">{item.label}</span>
                            </NavLink>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {showChangePassword && (
        <>
          <div
            onClick={() => setShowChangePassword(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(29, 78, 216, 0.08)",
              backdropFilter: "blur(4px)",
              zIndex: 1060
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 1065,
              width: "90%",
              maxWidth: "420px",
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              border: "2px solid #93c5fd",
              boxShadow: "0 12px 40px rgba(59, 130, 246, 0.18)",
              padding: "30px",
              color: "#1e3a5f"
            }}
          >
            <h5 className="text-center fw-bold mb-4" style={{ color: "#1d4ed8" }}>
              🔐 Change Password
            </h5>

            <div className="mb-3">
              <label className="form-label small fw-semibold" style={{ color: "#2563eb" }}>Current Password</label>
              <div className="input-group">
                <input
                  type={showCurrent ? "text" : "password"}
                  className={`form-control ${cpErrors.currentPassword ? "is-invalid" : ""}`}
                  style={inputStyle("currentPassword", cpErrors.currentPassword)}
                  onFocus={() => setFocusedInput("currentPassword")}
                  onBlur={() => setFocusedInput(null)}
                  value={cpForm.currentPassword}
                  onChange={(e) => setCpForm((p) => ({ ...p, currentPassword: e.target.value }))}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  className="btn"
                  onMouseEnter={() => setEyeCurrentHover(true)}
                  onMouseLeave={() => setEyeCurrentHover(false)}
                  onClick={() => setShowCurrent((p) => !p)}
                  style={eyeButtonStyle(eyeCurrentHover)}
                >
                  {showCurrent ? <i className="bi bi-eye"></i> : <i className="bi bi-eye-slash"></i>}
                </button>
                {cpErrors.currentPassword && <div className="invalid-feedback">{cpErrors.currentPassword}</div>}
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold" style={{ color: "#2563eb" }}>New Password</label>
              <div className="input-group">
                <input
                  type={showNew ? "text" : "password"}
                  className={`form-control ${cpErrors.newPassword ? "is-invalid" : ""}`}
                  style={inputStyle("newPassword", cpErrors.newPassword)}
                  onFocus={() => setFocusedInput("newPassword")}
                  onBlur={() => setFocusedInput(null)}
                  value={cpForm.newPassword}
                  onChange={(e) => setCpForm((p) => ({ ...p, newPassword: e.target.value }))}
                  placeholder="Min 12 characters"
                />
                <button
                  type="button"
                  className="btn"
                  onMouseEnter={() => setEyeNewHover(true)}
                  onMouseLeave={() => setEyeNewHover(false)}
                  onClick={() => setShowNew((p) => !p)}
                  style={eyeButtonStyle(eyeNewHover)}
                >
                  {showNew ? <i className="bi bi-eye"></i> : <i className="bi bi-eye-slash"></i>}
                </button>
                {cpErrors.newPassword && <div className="invalid-feedback">{cpErrors.newPassword}</div>}
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-semibold" style={{ color: "#2563eb" }}>Confirm New Password</label>
              <div className="input-group">
                <input
                  type={showConfirm ? "text" : "password"}
                  className={`form-control ${cpErrors.confirmPassword ? "is-invalid" : ""}`}
                  style={inputStyle("confirmPassword", cpErrors.confirmPassword)}
                  onFocus={() => setFocusedInput("confirmPassword")}
                  onBlur={() => setFocusedInput(null)}
                  value={cpForm.confirmPassword}
                  onChange={(e) => setCpForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="Re-enter new password"
                />
                <button
                  type="button"
                  className="btn"
                  onMouseEnter={() => setEyeConfirmHover(true)}
                  onMouseLeave={() => setEyeConfirmHover(false)}
                  onClick={() => setShowConfirm((p) => !p)}
                  style={eyeButtonStyle(eyeConfirmHover)}
                >
                  {showConfirm ? <i className="bi bi-eye"></i> : <i className="bi bi-eye-slash"></i>}
                </button>
                {cpErrors.confirmPassword && <div className="invalid-feedback">{cpErrors.confirmPassword}</div>}
              </div>
            </div>

            <div className="d-flex gap-2">
              <button
                className="btn w-100 fw-semibold"
                onClick={handleChangePassword}
                onMouseEnter={() => setCpFormHover(true)}
                onMouseLeave={() => setCpFormHover(false)}
                style={{
                  background: "linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  boxShadow: cpFormHover
                    ? "0 4px 20px rgba(59, 130, 246, 0.4)"
                    : "0 4px 10px rgba(59, 130, 246, 0.2)",
                  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  padding: "10px"
                }}
              >
                Update Password
              </button>
              <button
                className="btn w-100 fw-semibold"
                onClick={() => setShowChangePassword(false)}
                onMouseEnter={() => setCpCancelHover(true)}
                onMouseLeave={() => setCpCancelHover(false)}
                style={{
                  backgroundColor: "transparent",
                  border: "1.5px solid",
                  borderColor: cpCancelHover ? "#3b82f6" : "#bfdbfe",
                  color: cpCancelHover ? "#1d4ed8" : "#64748b",
                  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  borderRadius: "8px",
                  padding: "10px"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}