import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, MessageSquare, Send, Sparkles, X } from "lucide-react";
import "../styles/ChatWidget.css";

const colors = {
  navy: "#0f172a",
  navySoft: "#1e293b",
  blue: "#2563eb",
  blueSoft: "#dbeafe",
  border: "#e2e8f0",
  text: "#0f172a",
  muted: "#64748b",
  surface: "#ffffff",
  page: "#f8fafc",
};

const styles = {
  root: {
    position: "fixed",
    right: 24,
    bottom: 24,
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 14,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  panel: {
    width: "min(400px, calc(100vw - 32px))",
    height: "min(600px, calc(100vh - 104px))",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "rgba(255, 255, 255, 0.96)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderRadius: 21,
  },
  header: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: "18px 18px 16px",
    background: `linear-gradient(135deg, ${colors.navy} 0%, ${colors.navySoft} 50%, #1d4ed8 100%)`,
    color: "#ffffff",
    borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  avatar: {
    width: 42,
    height: 42,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    background: "rgba(255, 255, 255, 0.15)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255, 255, 255, 0.22)",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
  },
  titleWrap: {
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontSize: 15,
    lineHeight: "20px",
    fontWeight: 700,
    letterSpacing: "-0.01em",
  },
  subtitle: {
    margin: "2px 0 0",
    color: "#cbd5e1",
    fontSize: 12,
    lineHeight: "16px",
  },
  status: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    borderRadius: 999,
    padding: "3px 9px",
    background: "rgba(255, 255, 255, 0.14)",
    color: "#f0f9ff",
    fontSize: 11,
    lineHeight: "14px",
    fontWeight: 500,
    border: "1px solid rgba(255, 255, 255, 0.18)",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: "#22c55e",
  },
  iconButton: {
    width: 34,
    height: 34,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(255, 255, 255, 0.18)",
    borderRadius: 999,
    background: "rgba(255, 255, 255, 0.12)",
    color: "inherit",
    cursor: "pointer",
    padding: 0,
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: 16,
    background:
      "linear-gradient(180deg, #f8fafc 0%, #ffffff 46%, #f8fafc 100%)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
    margin: "38px 16px 12px",
    textAlign: "center",
  },
  emptyIcon: {
    width: 52,
    height: 52,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    background: "linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)",
    color: colors.blue,
    border: "1px solid #bfdbfe",
    boxShadow: "0 8px 20px -4px rgba(37, 99, 235, 0.18)",
  },
  emptyTitle: {
    margin: 0,
    color: colors.text,
    fontSize: 16,
    lineHeight: "22px",
    fontWeight: 700,
    letterSpacing: "-0.01em",
  },
  emptyText: {
    margin: "4px 0 0",
    color: colors.muted,
    fontSize: 13,
    lineHeight: "19px",
  },
  suggestions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
  },
  suggestion: {
    border: `1px solid ${colors.border}`,
    borderRadius: 999,
    padding: "8px 13px",
    background: "#ffffff",
    color: "#334155",
    fontSize: 12,
    fontWeight: 500,
    lineHeight: "15px",
    boxShadow: "0 2px 4px rgba(15, 23, 42, 0.04)",
  },
  row: {
    display: "flex",
    width: "100%",
  },
  bubble: {
    maxWidth: "84%",
    borderRadius: 18,
    padding: "10px 14px",
    fontSize: 14,
    lineHeight: "21px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  userBubble: {
    marginLeft: "auto",
    background: `linear-gradient(135deg, ${colors.navy} 0%, #1e293b 100%)`,
    color: "#ffffff",
    borderBottomRightRadius: 6,
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.15)",
  },
  modelBubble: {
    marginRight: "auto",
    background: "#ffffff",
    color: "#1f2937",
    border: "1px solid rgba(226, 232, 240, 0.9)",
    borderBottomLeftRadius: 6,
    boxShadow: "0 4px 16px rgba(15, 23, 42, 0.05)",
  },
  loadingBubble: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    marginRight: "auto",
    background: "#ffffff",
    color: colors.muted,
    border: `1px solid ${colors.border}`,
    borderBottomLeftRadius: 6,
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 500,
    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.04)",
  },
  typingDots: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: colors.blue,
  },
  error: {
    margin: "4px auto 8px",
    width: "fit-content",
    maxWidth: "92%",
    borderRadius: 12,
    background: "#fef2f2",
    color: "#b91c1c",
    padding: "9px 13px",
    fontSize: 12,
    fontWeight: 500,
    lineHeight: "16px",
    border: "1px solid #fecaca",
    boxShadow: "0 4px 12px rgba(239, 68, 68, 0.08)",
  },
  composer: {
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
    padding: "14px 16px",
    background: "#ffffff",
    borderTop: `1px solid ${colors.border}`,
  },
  inputShell: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: `1px solid ${colors.border}`,
    borderRadius: 20,
    background: "#f8fafc",
    padding: "0 14px",
  },
  textarea: {
    flex: 1,
    minWidth: 0,
    height: 42,
    resize: "none",
    border: 0,
    background: "transparent",
    color: colors.text,
    fontSize: 14,
    lineHeight: "20px",
    outline: "none",
    padding: "11px 0",
    fontFamily: "inherit",
  },
  sendButton: {
    width: 44,
    height: 44,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: 0,
    borderRadius: 16,
    background: `linear-gradient(135deg, ${colors.blue} 0%, #1d4ed8 100%)`,
    color: "#ffffff",
    cursor: "pointer",
    padding: 0,
    boxShadow: "0 10px 20px rgba(37, 99, 235, 0.28)",
  },
  sendButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
    boxShadow: "none",
    background: "#94a3b8",
  },
  tooltip: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    maxWidth: 330,
    borderRadius: 18,
    padding: "13px 15px",
    background: `linear-gradient(135deg, ${colors.navy} 0%, #1d4ed8 100%)`,
    color: "#ffffff",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    boxShadow:
      "0 20px 50px rgba(15, 23, 42, 0.26), 0 8px 20px rgba(37, 99, 235, 0.22)",
    fontSize: 13,
    lineHeight: "19px",
  },
  tooltipIcon: {
    width: 36,
    height: 36,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    background: "rgba(255, 255, 255, 0.16)",
    color: "#ffffff",
    border: "1px solid rgba(255, 255, 255, 0.22)",
  },
  tooltipText: {
    margin: 0,
    color: "#eaf2ff",
    fontWeight: 400,
  },
  tooltipClose: {
    width: 26,
    height: 26,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: 0,
    borderRadius: 999,
    background: "rgba(255, 255, 255, 0.14)",
    color: "#dbeafe",
    cursor: "pointer",
    padding: 0,
  },
  floatingWrap: {
    position: "relative",
    flexShrink: 0,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    zIndex: 2,
    width: 22,
    height: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid #ffffff",
    borderRadius: 999,
    background: "#ef4444",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1,
    boxShadow: "0 6px 14px rgba(239, 68, 68, 0.4)",
  },
  floatingButton: {
    width: 60,
    height: 60,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: 0,
    borderRadius: 20,
    background: `linear-gradient(135deg, ${colors.navy} 0%, ${colors.blue} 100%)`,
    color: "#ffffff",
    cursor: "pointer",
    padding: 0,
  },
};

const suggestions = [
  // "Total qty for WO 1006",
  // "Pending work orders",
  // "Dispatch status",
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setShowTooltip(false);
    }
  }, [open]);

  const send = async (value = input) => {
    const text = value.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", parts: [{ text }] };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated }),
      });

      if (!res.ok) throw new Error(`Server responded ${res.status}`);

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      const nextMessages = data.messages || [
        ...updated,
        { role: "model", parts: [{ text: data.reply || "" }] },
      ];

      setMessages(
        nextMessages.filter((msg) => msg.role === "user" || msg.role === "model"),
      );
    } catch (err) {
      console.error("Chat request failed:", err);
      setError("Couldn't reach the assistant. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const getText = (msg) => msg.parts.map((part) => part.text || "").join("");

  return createPortal(
    <div style={styles.root}>
      {open && (
        <div className="cw-rgb-panel-wrapper cw-panel-animated">
          <div style={styles.panel}>
            <div style={styles.header} className="cw-shimmer-header">
              <div style={styles.headerLeft}>
                <div style={styles.avatar}>
                  <Bot size={22} />
                </div>
                <div style={styles.titleWrap}>
                  <h3 style={styles.title}>AI Assistant</h3>
                  <p style={styles.subtitle}>Orders, production, dispatch and reports</p>
                  <div style={styles.status}>
                    <span style={styles.statusDot} className="cw-status-dot-pulse" />
                    Online
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                style={styles.iconButton}
                className="cw-icon-btn"
                aria-label="Close chat"
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.messages} className="cw-messages-container">
              {messages.length === 0 && (
                <div style={styles.empty}>
                  <div style={styles.emptyIcon}>
                    <Sparkles size={24} className="cw-sparkle-icon" />
                  </div>
                  <div>
                    <p style={styles.emptyTitle}>How can I help?</p>
                    <p style={styles.emptyText}>
                      Ask for work order quantities, dispatch updates, production
                      status, or pending items.
                    </p>
                  </div>
                  <div style={styles.suggestions}>
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => send(suggestion)}
                        disabled={loading}
                        className="cw-suggestion-btn"
                        style={{
                          ...styles.suggestion,
                          cursor: loading ? "not-allowed" : "pointer",
                          opacity: loading ? 0.55 : 1,
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={msg.role === "user" ? "cw-msg-user" : "cw-msg-model"}
                  style={{
                    ...styles.row,
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      ...styles.bubble,
                      ...(msg.role === "user" ? styles.userBubble : styles.modelBubble),
                    }}
                  >
                    {getText(msg)}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={styles.row} className="cw-msg-model">
                  <div style={{ ...styles.bubble, ...styles.loadingBubble }}>
                    <span>Thinking</span>
                    <span style={styles.typingDots} aria-hidden="true">
                      <span style={styles.dot} className="cw-dot-1" />
                      <span style={styles.dot} className="cw-dot-2" />
                      <span style={styles.dot} className="cw-dot-3" />
                    </span>
                  </div>
                </div>
              )}

              {error && <div style={styles.error}>{error}</div>}

              <div ref={scrollRef} />
            </div>

            <div style={styles.composer}>
              <div style={styles.inputShell} className="cw-input-shell">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your question..."
                  rows={1}
                  style={styles.textarea}
                />
              </div>
              <button
                type="button"
                onClick={() => send()}
                disabled={loading || !input.trim()}
                className="cw-send-btn"
                style={{
                  ...styles.sendButton,
                  ...(loading || !input.trim() ? styles.sendButtonDisabled : {}),
                }}
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {showTooltip && !open && (
        <div className="cw-rgb-tooltip-wrapper cw-tooltip-float">
          <div style={styles.tooltip}>
            <div style={styles.tooltipIcon}>
              <MessageSquare size={18} />
            </div>
            <p style={styles.tooltipText}>
              Need a quick answer? Ask about work orders, production, dispatch, quantities, waste or reports.
            </p>
            <button
              type="button"
              onClick={() => setShowTooltip(false)}
              style={styles.tooltipClose}
              className="cw-icon-btn"
              aria-label="Dismiss tooltip"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      <div style={styles.floatingWrap}>
        {!open && <span style={styles.badge} className="cw-badge-pulse">1</span>}
        <div className="cw-rgb-trigger-wrapper">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            style={styles.floatingButton}
            aria-label={open ? "Close chat assistant" : "Open chat assistant"}
          >
            {open ? <X size={26} /> : <MessageSquare size={26} />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}