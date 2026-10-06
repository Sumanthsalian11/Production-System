import React from "react";

/**
 * Artworkshared.jsx
 * -------------------------------------------------------------------------
 * Shared design tokens + primitives for the Artwork Docket app.
 *
 * Design direction: this is a production tool for print/packaging teams
 * (Prepress ⇄ Key Account Sales) tracking artwork proofs and revisions.
 * Rather than a literal "print shop" pastiche (dashed rules, typewriter
 * mono everywhere), the system reads as a disciplined, modern ops
 * dashboard — the kind of quality bar you'd expect from Linear or Height —
 * with a single signature motif borrowed honestly from the domain: a
 * four-channel "separation" mark (the way a printed sheet carries small
 * registration dots per ink channel) used sparingly as the app's mark and
 * as a status rail on cards. Everything else stays quiet on purpose.
 * -------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// Color tokens
// ---------------------------------------------------------------------------
export const COLORS = {
  // Surfaces
  paper: "#F5F6F8",      // app background
  paperDim: "#ECEEF2",   // recessed / subtle fill
  surface: "#FFFFFF",    // cards, panels
  line: "#E2E4EA",       // hairline borders
  lineStrong: "#CBCFD8", // borders that need more presence

  // Text
  ink: "#151722",        // primary text
  inkSoft: "#6B7080",    // secondary text
  inkFaint: "#9DA2B0",   // tertiary / placeholder text

  // Brand accent — "proof blue", the C-channel of the separation mark
  accent: "#3457FF",
  accentSoft: "#EBEFFF",
  accentInk: "#1E3ADB",

  // Legacy aliases kept for role-tinting message bubbles
  cyan: "#0FA3B1",
  yellow: "#D98E04",

  // Status palette (open / in progress / review / closed)
  status: {
    open: { fg: "#B4740D", bg: "#FCF1DC", dot: "#E3A63D" },
    in_progress: { fg: "#1E3ADB", bg: "#EBEFFF", dot: "#3457FF" },
    changes_submitted: { fg: "#6D3FD1", bg: "#F1ECFD", dot: "#8B5CF6" },
    closed: { fg: "#12805E", bg: "#E6F6F0", dot: "#1FA37B" },
  },

  shadowSm: "0 1px 2px rgba(15, 18, 32, 0.06)",
  shadowMd: "0 4px 16px rgba(15, 18, 32, 0.08)",
  shadowLg: "0 12px 32px rgba(15, 18, 32, 0.12)",
};

export const STATUS = {
  open: "New",
  in_progress: "In progress",
  changes_submitted: "In review",
  closed: "Closed",
};

// ---------------------------------------------------------------------------
// Fonts + base styles
// Headings: Manrope (confident, geometric, built for product UI)
// Body: Inter (already in use, kept for continuity and legibility)
// Data / codes: JetBrains Mono (ticket IDs, material codes, timestamps)
// ---------------------------------------------------------------------------
export const FONT_IMPORT = `
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');

  * { box-sizing: border-box; }

  .awd-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
  .awd-scroll::-webkit-scrollbar-track { background: transparent; }
  .awd-scroll::-webkit-scrollbar-thumb { background: ${COLORS.lineStrong}; border-radius: 8px; }

  .awd-card {
    transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
  }
  .awd-card:hover {
    border-color: ${COLORS.lineStrong};
    box-shadow: ${COLORS.shadowMd};
    transform: translateY(-1px);
  }

  .awd-btn {
    transition: background-color 120ms ease, border-color 120ms ease, opacity 120ms ease, transform 120ms ease;
  }
  .awd-btn:hover:not(:disabled) { transform: translateY(-1px); }
  .awd-btn:active:not(:disabled) { transform: translateY(0); }
  .awd-btn:disabled { cursor: not-allowed; opacity: 0.5; }

  .awd-icon-btn {
    transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
  }
  .awd-icon-btn:hover:not(:disabled) {
    background: ${COLORS.paperDim} !important;
    border-color: ${COLORS.lineStrong} !important;
  }

  .awd-input {
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .awd-input:focus {
    border-color: ${COLORS.accent} !important;
    box-shadow: 0 0 0 3px ${COLORS.accentSoft};
  }

  .awd-tab {
    transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
  }

  .awd-fade-in {
    animation: awdFadeIn 180ms ease both;
  }
  @keyframes awdFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  :focus-visible {
    outline: 2px solid ${COLORS.accent};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .awd-card, .awd-btn, .awd-icon-btn, .awd-input, .awd-tab, .awd-fade-in {
      transition: none !important;
      animation: none !important;
    }
  }
`;

// ---------------------------------------------------------------------------
// formatTime
// ---------------------------------------------------------------------------
export function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  if (sameDay) return time;
  if (isYesterday) return "Yesterday · " + time;

  const sameYear = d.getFullYear() === now.getFullYear();
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  return date + " · " + time;
}

// ---------------------------------------------------------------------------
// RegMark — the app's signature mark: a small four-channel separation dot
// cluster, standing in for a logo. Used once in the header, quietly.
// ---------------------------------------------------------------------------
export function RegMark({ size = 22 }) {
  const s = size;
  const dot = s * 0.34;
  const colors = [COLORS.accent, "#E3A63D", "#8B5CF6", "#1FA37B"];
  return (
    <div
      style={{
        width: s,
        height: s,
        borderRadius: s * 0.28,
        background: COLORS.ink,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: Math.max(1, s * 0.08),
        padding: s * 0.16,
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {colors.map((c, i) => (
        <div key={i} style={{ width: "100%", height: "100%", borderRadius: "50%", background: c }} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusChip
// ---------------------------------------------------------------------------
export function StatusChip({ status }) {
  const s = COLORS.status[status] || COLORS.status.open;
  const label = STATUS[status] || status;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px 4px 8px",
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "'Inter', sans-serif",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ActionBtn
// ---------------------------------------------------------------------------
export function ActionBtn({ icon: Icon, label, onClick, muted = false, disabled = false }) {
  return (
    <button
      className="awd-btn"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "9px 14px",
        borderRadius: 8,
        border: muted ? "1px solid " + COLORS.line : "1px solid transparent",
        background: muted ? COLORS.surface : COLORS.ink,
        color: muted ? COLORS.ink : "#fff",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "'Inter', sans-serif",
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: muted ? "none" : COLORS.shadowSm,
      }}
    >
      {Icon ? <Icon size={14} /> : null}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Avatar — small initials circle for chat senders
// ---------------------------------------------------------------------------
export function Avatar({ name, role, size = 28 }) {
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const bg = role === "PREPRESS" ? COLORS.accentSoft : "#FCF1DC";
  const fg = role === "PREPRESS" ? COLORS.accentInk : "#B4740D";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color: fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 700,
        fontFamily: "'Inter', sans-serif",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {initials || "?"}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AttachmentChip — consistent attachment pill used in header + messages
// ---------------------------------------------------------------------------
export function AttachmentChip({ href, name, icon: Icon, tone = "default", onRemove }) {
  const isLight = tone === "onDark";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        maxWidth: "100%",
      }}
    >
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            fontWeight: 500,
            color: isLight ? "#fff" : COLORS.ink,
            textDecoration: "none",
            border: isLight ? "1px solid rgba(255,255,255,0.35)" : "1px solid " + COLORS.line,
            borderRadius: 6,
            padding: "6px 10px",
            background: isLight ? "rgba(255,255,255,0.08)" : COLORS.surface,
            maxWidth: 220,
            overflow: "hidden",
          }}
        >
          {Icon ? <Icon size={12} style={{ flexShrink: 0, opacity: 0.75 }} /> : null}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        </a>
      ) : (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            color: COLORS.ink,
            background: COLORS.paperDim,
            border: "1px solid " + COLORS.line,
            borderRadius: 6,
            padding: "5px 6px 5px 10px",
            maxWidth: 220,
          }}
        >
          {Icon ? <Icon size={12} style={{ flexShrink: 0, color: COLORS.inkSoft }} /> : null}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
          {onRemove ? (
            <button
              onClick={onRemove}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: COLORS.inkFaint,
                display: "flex",
                padding: 2,
                flexShrink: 0,
              }}
              aria-label={"Remove " + name}
            >
              ×
            </button>
          ) : null}
        </span>
      )}
    </span>
  );
}