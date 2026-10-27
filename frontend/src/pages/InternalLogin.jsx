import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import {
  FaArrowRight,
  FaEye,
  FaEyeSlash,
  FaSun,
  FaMoon,
  FaUser,
  FaLock,
  FaExclamationTriangle,
  FaShieldAlt,
  FaFingerprint,
  FaTag,
  FaTimes,
} from "react-icons/fa";
import BASE_URL from "../config/api";
import useDelayedLoading from "../hooks/useDelayedLoading";
import LoadingOverlay from "../components/LoadingOverlay";
import "../styles/Internallogin.css";

const BASE = import.meta.env.BASE_URL;

const ROLE_ROUTES = {
  ADMIN: "/internal-register",
  PLANNER: "/planner",
  SUPERVISOR: "/waste",
  PRODUCTION: "/production",
  "PURCHASE ORDER": "/customer-dashboard",
  DISPATCH: "/dispatch",
  KAS: "/print",
  SCANNER: "/manual-box",
  INDENTER: "/new-in",
  PREPRESS: "/preprocess",
};

const TICKER_SPEED = { fast: "12s", normal: "18s", slow: "28s" };

function InternalLogin() {
  const navigate = useNavigate();

  // ---- ORIGINAL STATE (unchanged) ----
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const showLoader = useDelayedLoading(loading, 10);

  const [rawAnnouncement, setRawAnnouncement] = useState("");
  const [loginMarqueePaused, setLoginMarqueePaused] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // ---- DESIGN-ONLY STATE (theme + canvas) ----
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("theme") === "dark"
  );
  const canvasRef = useRef(null);

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem("theme", newMode ? "dark" : "light");
  };

  // ---- GLOBAL PAYMENT NETWORK ANIMATION (design only) ----
  // A slowly rotating dotted globe with luminous arcs and traveling
  // pulses between nodes, like transactions moving across the world.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let animationFrameId;
    let width = 0;
    let height = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      width = parent.offsetWidth;
      height = parent.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Palette
    const pal = darkMode
      ? {
          dot: "203, 213, 225",
          gold: "232, 196, 120",
          blue: "96, 165, 250",
          ring: "148, 163, 184",
        }
      : {
          dot: "30, 41, 59",
          gold: "176, 126, 36",
          blue: "37, 99, 235",
          ring: "71, 85, 105",
        };

    // Fibonacci sphere of dots
    const NUM = 460;
    const nodes = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < NUM; i++) {
      const y = 1 - (i / (NUM - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = golden * i;
      nodes.push({ x: Math.cos(t) * r, y, z: Math.sin(t) * r, tw: Math.random() * Math.PI * 2 });
    }

    let rotY = 0.6;
    const tilt = 0.38;
    let targetTiltX = 0;
    let targetTiltY = 0;
    let curTiltX = 0;
    let curTiltY = 0;

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      targetTiltY = ((e.clientX - rect.left) / rect.width - 0.5) * 0.35;
      targetTiltX = ((e.clientY - rect.top) / rect.height - 0.5) * 0.25;
    };
    window.addEventListener("mousemove", onMove);

    const rotate = (v, ry, rx) => {
      const cy = Math.cos(ry), sy = Math.sin(ry);
      const x1 = v.x * cy - v.z * sy;
      const z1 = v.z * cy + v.x * sy;
      const cx = Math.cos(rx), sx = Math.sin(rx);
      const y2 = v.y * cx - z1 * sx;
      const z2 = z1 * cx + v.y * sx;
      return { x: x1, y: y2, z: z2 };
    };

    const FOV = 3.2;
    const project = (v, R, cx, cy) => {
      const s = FOV / (FOV + v.z * 0.9 + 0.6);
      return { x: cx + v.x * R * s, y: cy + v.y * R * s, s, z: v.z };
    };

    // Arcs between random nodes
    const MAX_ARCS = 7;
    const arcs = [];
    const newArc = () => {
      const a = nodes[Math.floor(Math.random() * NUM)];
      let b = nodes[Math.floor(Math.random() * NUM)];
      let guard = 0;
      while (
        (a === b || a.x * b.x + a.y * b.y + a.z * b.z > 0.85 || a.x * b.x + a.y * b.y + a.z * b.z < -0.3) &&
        guard++ < 30
      ) {
        b = nodes[Math.floor(Math.random() * NUM)];
      }
      const mx = a.x + b.x, my = a.y + b.y, mz = a.z + b.z;
      const ml = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
      const lift = 1.25 + Math.random() * 0.35;
      return {
        a,
        b,
        c: { x: (mx / ml) * lift, y: (my / ml) * lift, z: (mz / ml) * lift },
        t: -Math.random() * 0.6,
        speed: 0.0042 + Math.random() * 0.003,
        gold: Math.random() > 0.45,
      };
    };
    for (let i = 0; i < MAX_ARCS; i++) arcs.push(newArc());

    const bez = (arc, t) => {
      const u = 1 - t;
      return {
        x: u * u * arc.a.x + 2 * u * t * arc.c.x + t * t * arc.b.x,
        y: u * u * arc.a.y + 2 * u * t * arc.c.y + t * t * arc.b.y,
        z: u * u * arc.a.z + 2 * u * t * arc.c.z + t * t * arc.b.z,
      };
    };

    let time = 0;

    const render = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      if (!reduceMotion) rotY += 0.0022;
      curTiltX += (targetTiltX - curTiltX) * 0.04;
      curTiltY += (targetTiltY - curTiltY) * 0.04;

      const ry = rotY + curTiltY;
      const rx = tilt + curTiltX;

      const R = Math.min(width, height) * 0.36;
      const cx = width / 2;
      const cy = height * 0.46;

      // Atmosphere glow
      const glow = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.5);
      glow.addColorStop(0, `rgba(${pal.blue}, ${darkMode ? 0.1 : 0.07})`);
      glow.addColorStop(0.6, `rgba(${pal.gold}, ${darkMode ? 0.05 : 0.04})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Globe outline
      ctx.strokeStyle = `rgba(${pal.ring}, ${darkMode ? 0.22 : 0.25})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // Orbit rings
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.38);
      ctx.strokeStyle = `rgba(${pal.gold}, ${darkMode ? 0.28 : 0.35})`;
      ctx.setLineDash([2, 8]);
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 1.22, R * 0.34, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(${pal.ring}, 0.14)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 1.42, R * 0.46, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Satellite on the orbit
      const sa = time * 0.011;
      const sx = Math.cos(sa) * R * 1.22;
      const sy = Math.sin(sa) * R * 0.34;
      ctx.fillStyle = `rgba(${pal.gold}, 0.95)`;
      ctx.shadowColor = `rgba(${pal.gold}, 0.9)`;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      // Dots
      for (let i = 0; i < NUM; i++) {
        const n = nodes[i];
        const v = rotate(n, ry, rx);
        const p = project(v, R, cx, cy);
        const depth = (v.z + 1) / 2; // 0 back, 1 front
        const twinkle = 0.75 + 0.25 * Math.sin(time * 0.03 + n.tw);
        const alpha = (0.08 + depth * 0.7) * twinkle;
        const size = (0.6 + depth * 1.3) * p.s * 1.2;
        ctx.fillStyle = `rgba(${pal.dot}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Arcs + pulses
      for (let i = 0; i < arcs.length; i++) {
        const arc = arcs[i];
        arc.t += arc.speed;
        if (arc.t > 1.25) {
          arcs[i] = newArc();
          continue;
        }
        const col = arc.gold ? pal.gold : pal.blue;
        const tt = Math.max(0, Math.min(1, arc.t));
        // Fade envelope
        const env = arc.t < 0 ? 0 : arc.t > 1 ? Math.max(0, 1 - (arc.t - 1) * 4) : Math.min(1, arc.t * 4);

        // Drawn portion of the arc (up to head)
        const STEPS = 28;
        ctx.lineWidth = 1.1;
        let prev = null;
        for (let s = 0; s <= STEPS; s++) {
          const t = (s / STEPS) * Math.min(1, tt);
          const p = project(rotate(bez(arc, t), ry, rx), R, cx, cy);
          if (prev) {
            const behind = (prev.z + p.z) / 2 < -0.15;
            const trail = s / STEPS;
            ctx.strokeStyle = `rgba(${col}, ${(behind ? 0.05 : 0.12 + trail * 0.5) * env})`;
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
          prev = p;
        }

        // Head
        if (arc.t >= 0 && arc.t <= 1) {
          const head = project(rotate(bez(arc, tt), ry, rx), R, cx, cy);
          if (head.z > -0.2) {
            ctx.fillStyle = `rgba(${col}, 0.95)`;
            ctx.shadowColor = `rgba(${col}, 0.95)`;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(head.x, head.y, 2.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }

        // Landing ripple at destination
        if (arc.t > 0.95 && arc.t < 1.25) {
          const land = project(rotate(arc.b, ry, rx), R, cx, cy);
          if (land.z > -0.1) {
            const k = (arc.t - 0.95) / 0.3;
            ctx.strokeStyle = `rgba(${col}, ${(1 - k) * 0.7})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(land.x, land.y, 3 + k * 16, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, [darkMode]);

  // ---- ORIGINAL ANNOUNCEMENT LOGIC (unchanged) ----
  const announcementData = useMemo(() => {
    if (!rawAnnouncement) return null;
    try {
      const parsed = JSON.parse(rawAnnouncement);
      if (parsed && typeof parsed === "object" && parsed.text) {
        return {
          text: parsed.text,
          type: parsed.type || "broadcast",
          badge: parsed.badge || (parsed.type === "critical" ? "CRITICAL ALERT" : "BULLETIN"),
          speed: parsed.speed || "normal",
        };
      }
    } catch {
      // Legacy string
    }
    return { text: rawAnnouncement, type: "broadcast", badge: "SYSTEM BULLETIN", speed: "normal" };
  }, [rawAnnouncement]);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/auth/announcement/public`);
        setRawAnnouncement(res.data?.text || "");
      } catch {
        setRawAnnouncement("");
      }
    };
    fetchAnnouncement();
    const interval = setInterval(fetchAnnouncement, 15000);
    return () => clearInterval(interval);
  }, []);

  // ---- ORIGINAL HANDLERS (unchanged) ----
  const handleChange = (e) => {
    const value = e.target.value.trim();
    setForm({ ...form, [e.target.name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post(`${BASE_URL}/api/auth/internal/login`, form);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);

      const role = res.data.role;

      if (!role) {
        setError("No role is assigned to this account. Contact your administrator.");
        setLoading(false);
        return;
      }

      const roleTarget = ROLE_ROUTES[role];

      // Modules assigned by admin (same source the dashboard sidebar uses)
      let assigned = [];
      try {
        assigned = jwtDecode(res.data.token).modules || [];
      } catch {
        assigned = [];
      }

      let target = roleTarget;
      if (role !== "ADMIN" && assigned.length > 0) {
        target = assigned.includes(roleTarget) ? roleTarget : assigned[0];
      }

      if (target) navigate(target);
      else setError("Your role is not recognised. Contact your administrator.");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials. Check your details and try again.");
    }

    setLoading(false);
  };

  const hasBar = Boolean(announcementData?.text);
  const accent = announcementData?.type === "critical" ? "#ef4444" : "#ffb000";
  const themeVars = {
    "--ann-accent": accent,
    "--ann-ticker-speed": TICKER_SPEED[announcementData?.speed] || TICKER_SPEED.normal,
  };

  return (
    <div
      className={`portal-container ${darkMode ? "dark-theme" : "light-theme"}${
        hasBar ? " portal-container--with-bar" : ""
      }`}
      style={themeVars}
    >
      {showLoader && <LoadingOverlay />}

      {/* ANNOUNCEMENT BAR */}
      {hasBar && (
        <div className="ann-bar">
          <div className="ann-bar__badge">
            <span className="ann-bar__dot" />
            <span>{announcementData.badge}</span>
          </div>

          <div
            className="ann-bar__viewport"
            onMouseEnter={() => setLoginMarqueePaused(true)}
            onMouseLeave={() => setLoginMarqueePaused(false)}
            onClick={() => setShowDetailModal(true)}
            title="Click to view announcement in full"
          >
            <div className={`ann-bar__track${loginMarqueePaused ? " ann-bar__track--paused" : ""}`}>
              {[0, 1].map((i) => (
                <div key={i} className="ann-bar__item">
                  <span className="ann-bar__text">{announcementData.text}</span>
                  <span className="ann-bar__sep">❖</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ambient aurora + grain */}
      <div className="ambient-spotlight spot-1" />
      <div className="ambient-spotlight spot-2" />
      <div className="ambient-spotlight spot-3" />
      <div className="ambient-grid" />

      <div className="portal-frame">
        {/* LEFT: ANIMATED SHOWCASE */}
        <div className="portal-showcase-panel">
          <div className="showcase-grid" />
          <canvas ref={canvasRef} className="telemetry-canvas" />

          <div className="telemetry-top">
            <div className="live-status-pill">
              <span className="pulse-dot" />
              <span>MPI</span>
            </div>
            <div className="security-tag">
              <FaFingerprint /> Secure Access
            </div>
          </div>

          <div className="showcase-content">
            <span className="showcase-rule" />
            <h1 className="showcase-title">Manipal Payment and Identity Solutions</h1>
            <p className="showcase-sub">
              Role-based access, live status tracking and clear reports for every team.
            </p>
          </div>

          <div className="telemetry-footer">
            <div className="protocol-badge">
              <FaShieldAlt className="shield-active" />
              <span>Encrypted connection</span>
            </div>
          </div>
        </div>

        {/* RIGHT: SIGN IN FORM */}
        <div className="portal-auth-panel">
          <div className="auth-header-bar">
            <div className="brand-lockup">
              <img src={`${BASE}Logo.png`} alt="MPI logo" className="brand-logo-img" />
              <span className="brand-name">Enterprise Gateway</span>
            </div>

            <button
              type="button"
              className="theme-switch-btn"
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              title={`Switch to ${darkMode ? "Light" : "Dark"} Mode`}
            >
              {darkMode ? <FaSun className="icon-sun" /> : <FaMoon className="icon-moon" />}
            </button>
          </div>

          <div className="credentials-box">
            <div className="auth-lead">
              <h2 className="auth-heading">Sign In</h2>
              <p className="auth-desc">Use your domain password if you have a domain account, otherwise your portal password</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-field-group">
                <label className="field-label-text" htmlFor="mpi-lgn-email">
                  Email or Username
                </label>
                <div className="field-input-box">
                  <FaUser className="field-prefix-icon" />
                  <input
                    id="mpi-lgn-email"
                    name="email"
                    type="text"
                    className="portal-input"
                    placeholder="name@company.com"
                    autoComplete="username"
                    autoFocus
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-field-group">
                <label className="field-label-text" htmlFor="mpi-lgn-password">
                  Password
                </label>
                <div className="field-input-box">
                  <FaLock className="field-prefix-icon" />
                  <input
                    id="mpi-lgn-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    className="portal-input password-type"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    onChange={handleChange}
                    required
                  />
                  <button
                    type="button"
                    className="password-reveal-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={`auth-action-btn ${loading ? "is-loading" : ""}`}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="btn-spinner" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <FaArrowRight className="action-arrow" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="release-badge-bar">
            <span className="release-pill">
              <FaTag /> V1.1.6
            </span>
            <p className="ann-copyright">© 2026 Manipal Payment and Identity Solutions</p>
          </div>
        </div>
      </div>

      {/* ERROR MODAL */}
      {error && (
        <div className="modal-backdrop" onClick={() => setError("")}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="alert">
            <div className="modal-icon-badge">
              <FaExclamationTriangle />
            </div>
            <h3 className="modal-title">Authentication Failed</h3>
            <p className="modal-desc">{error}</p>
            <button className="modal-dismiss-btn" onClick={() => setError("")}>
              Dismiss &amp; Retry
            </button>
          </div>
        </div>
      )}

      {/* ANNOUNCEMENT MODAL */}
      {showDetailModal && hasBar && (
        <div className="modal-backdrop" onClick={() => setShowDetailModal(false)}>
          <div
            className="modal-card ann-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ann-modal__head">
              <span className="ann-modal__badge">{announcementData.badge}</span>
              <button
                type="button"
                className="ann-modal__close"
                onClick={() => setShowDetailModal(false)}
                aria-label="Close announcement"
              >
                <FaTimes />
              </button>
            </div>
            <p className="modal-desc ann-modal__text">{announcementData.text}</p>
            <button className="ann-modal__action" onClick={() => setShowDetailModal(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default InternalLogin;