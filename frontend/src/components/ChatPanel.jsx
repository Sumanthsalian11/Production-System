import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import BASE_URL from "../config/api";

const API = `${BASE_URL}/api/messenger`;
const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDay = (d) => {
  const dt = new Date(d);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (dt.toDateString() === today.toDateString()) return "Today";
  if (dt.toDateString() === y.toDateString()) return "Yesterday";
  return dt.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
};
const fmtSize = (b = 0) => (b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
const initials = (n = "") => n.split(" ").map((x) => x[0]).join("").toUpperCase().slice(0, 2);
const COLORS = ["#128c7e", "#0f5560", "#6f42c1", "#e8590c", "#2a6f97", "#c2255c", "#2b8a3e"];
const colorOf = (n = "") => COLORS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

function Avatar({ name, size = 40 }) {
  return (
    <div className="wa-avatar" style={{ width: size, height: size, background: colorOf(name), fontSize: size * 0.38 }}>
      {initials(name)}
    </div>
  );
}

function Attachment({ msg, api }) {
  const a = msg.attachment;
  const isImg = /^image\/(png|jpe?g|gif|webp)$/.test(a.mime || "");
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!isImg) return;
    let url = "";
    api.get(`/file/${msg._id}`, { responseType: "blob" }).then((r) => {
      url = URL.createObjectURL(r.data);
      setSrc(url);
    }).catch(() => {});
    return () => url && URL.revokeObjectURL(url);
  }, [msg._id, isImg, api]);

  const download = async () => {
    try {
      const r = await api.get(`/file/${msg._id}`, { responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = a.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      alert("Could not download file");
    }
  };

  return (
    <div>
      {isImg && (src ? <img src={src} alt={a.name} className="wa-img" onClick={download} /> : <div className="wa-img-ph">Loading…</div>)}
      <div className="wa-file" onClick={download}>
        <i className="bi bi-file-earmark-arrow-down-fill" />
        <div style={{ minWidth: 0 }}>
          <div className="wa-file-name">{a.name}</div>
          <div className="wa-file-size">{fmtSize(a.size)} • Tap to download</div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPanel({ onClose }) {
  const [token, setToken] = useState(() => sessionStorage.getItem("chatToken") || "");
  const [loginForm, setLoginForm] = useState({ identifier: "", password: "" });
  const [loginErr, setLoginErr] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [menuId, setMenuId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState("chat"); // chat | profile
  const [aboutDraft, setAboutDraft] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showAll, setShowAll] = useState(false);

  const endRef = useRef(null);
  const fileRef = useRef(null);

  const api = useMemo(() => {
    const i = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${token}` } });
    i.interceptors.response.use(
      (r) => r,
      (e) => {
        if (e.response?.status === 401) {
          sessionStorage.removeItem("chatToken");
          setToken("");
        }
        return Promise.reject(e);
      }
    );
    return i;
  }, [token]);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  /* ---------- login ---------- */
  const doLogin = async (e) => {
    e.preventDefault();
    setLoginErr("");
    setLoginBusy(true);
    try {
      const mainToken = localStorage.getItem("token");
      const r = await axios.post(`${API}/login`, loginForm, { headers: { Authorization: `Bearer ${mainToken}` } });
      sessionStorage.setItem("chatToken", r.data.token);
      setToken(r.data.token);
      setLoginForm({ identifier: "", password: "" });
    } catch (err) {
      setLoginErr(err.response?.data?.message || "Login failed");
    }
    setLoginBusy(false);
  };

  const chatLogout = () => {
    sessionStorage.removeItem("chatToken");
    setToken("");
    setActive(null);
    setMsgs([]);
    setUsers([]);
    setProfile(null);
  };

  /* ---------- data ---------- */
  const loadUsers = useCallback(async () => {
    try { setUsers((await api.get("/users")).data); } catch { /* ignore */ }
  }, [api]);

  const loadMsgs = useCallback(async () => {
    if (!active) return;
    try { setMsgs((await api.get(`/messages/${active.id}`)).data); } catch { /* ignore */ }
  }, [api, active]);

  useEffect(() => {
    if (!token) return;
    api.get("/profile").then((r) => { setProfile(r.data); setAboutDraft(r.data.about); }).catch(() => {});
    loadUsers();
    const t = setInterval(loadUsers, 5000);
    return () => clearInterval(t);
  }, [token, api, loadUsers]);

  useEffect(() => {
    if (!token || !active) return;
    setMsgs([]);
    loadMsgs();
    const t = setInterval(loadMsgs, 3000);
    return () => clearInterval(t);
  }, [token, active?.id]); // eslint-disable-line

  const lastId = msgs[msgs.length - 1]?._id;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastId, active?.id]);

  /* ---------- actions ---------- */
  const send = async () => {
    if (sending || !active || (!text.trim() && !file)) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append("text", text.trim());
      if (file) fd.append("file", file);
      await api.post(`/send/${active.id}`, fd);
      setText("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await loadMsgs();
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send");
    }
    setSending(false);
  };

  const delForMe = async (id) => {
    await api.put(`/message/${id}/delete-for-me`);
    setMenuId(null);
    loadMsgs();
  };
  const delForAll = async (id) => {
    if (!window.confirm("Delete this message for everyone?")) return;
    await api.put(`/message/${id}/delete-for-all`);
    setMenuId(null);
    loadMsgs();
  };

  const saveAbout = async () => {
    try {
      await api.put("/profile", { about: aboutDraft });
      setProfile((p) => ({ ...p, about: aboutDraft }));
      setView("chat");
    } catch { alert("Could not save"); }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase().trim();
    const matches = !q || u.name.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
    if (showAll) return matches; // "New chat" screen: every user
    return matches && (!!u.lastAt || u.unread > 0 || u.id === active?.id); // main list: only chatted people
  });

  const showList = !isMobile || !active;
  const showConvo = !isMobile || !!active;

  /* ---------- render ---------- */
  return (
    <div className="wa-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <style>{`
        .wa-overlay{position:fixed;inset:0;z-index:1090;background:rgba(3,18,24,.55);display:flex;justify-content:flex-end}
        .wa-panel{width:min(980px,100vw);height:100vh;background:#fff;display:flex;flex-direction:column;box-shadow:-10px 0 30px rgba(0,0,0,.3);color:#111b21;font-family:'Segoe UI',system-ui,sans-serif}
        .wa-top{background:#075e54;color:#fff;padding:10px 14px;display:flex;align-items:center;gap:10px;flex-shrink:0}
        .wa-top h6{margin:0;font-weight:700;flex:1;font-size:1rem}
        .wa-iconbtn{background:transparent;border:none;color:#fff;font-size:1.05rem;padding:4px 8px;border-radius:6px;cursor:pointer}
        .wa-iconbtn:hover{background:rgba(255,255,255,.15)}
        .wa-body{flex:1;display:flex;min-height:0}
        .wa-list{width:${isMobile ? "100%" : "340px"};border-right:1px solid #e9edef;display:flex;flex-direction:column;background:#fff;flex-shrink:0}
        .wa-search{padding:8px 12px;background:#f0f2f5}
        .wa-list{position:relative}
        .wa-fab{position:absolute;right:16px;bottom:16px;width:52px;height:52px;border-radius:16px;border:none;background:#00a884;color:#fff;font-size:1.3rem;box-shadow:0 4px 12px rgba(0,0,0,.3);cursor:pointer;z-index:3}
        .wa-fab:hover{background:#019575}
        .wa-newhead{background:#075e54;color:#fff;padding:10px 14px;display:flex;align-items:center;gap:12px;font-weight:600}
        .wa-newhead button{background:none;border:none;color:#fff;font-size:1.1rem;cursor:pointer}
        .wa-search input{width:100%;border:none;border-radius:8px;padding:7px 12px;font-size:.85rem;outline:none;background:#fff;color:#111b21}
        .wa-search input::placeholder{color:#667781}
        .wa-users{flex:1;overflow-y:auto}
        .wa-user{display:flex;gap:12px;padding:10px 14px;cursor:pointer;border-bottom:1px solid #f0f2f5;align-items:center}
        .wa-user:hover,.wa-user.on{background:#f0f2f5}
        .wa-user-main{flex:1;min-width:0}
        .wa-user-row{display:flex;justify-content:space-between;gap:6px}
        .wa-user-name{font-weight:600;font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .wa-user-time{font-size:.68rem;color:#667781;flex-shrink:0}
        .wa-user-last{font-size:.8rem;color:#667781;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .wa-badge{background:#25d366;color:#fff;border-radius:999px;font-size:.68rem;font-weight:700;padding:1px 7px;flex-shrink:0}
        .wa-avatar{border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0}
        .wa-convo{flex:1;display:flex;flex-direction:column;min-width:0;background:#efeae2}
        .wa-chead{background:#f0f2f5;padding:8px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #e9edef;flex-shrink:0}
        .wa-chead .back{background:none;border:none;font-size:1.1rem;cursor:pointer;color:#54656f}
        .wa-msgs{flex:1;overflow-y:auto;padding:14px 5%;display:flex;flex-direction:column;gap:3px}
        .wa-day{align-self:center;background:#fff;color:#54656f;font-size:.7rem;padding:3px 12px;border-radius:8px;margin:8px 0;box-shadow:0 1px 1px rgba(0,0,0,.1)}
        .wa-msg{max-width:72%;padding:6px 9px 4px;border-radius:8px;font-size:.88rem;position:relative;box-shadow:0 1px 1px rgba(0,0,0,.13);word-break:break-word;white-space:pre-wrap}
        .wa-msg.me{align-self:flex-end;background:#d9fdd3;border-top-right-radius:2px}
        .wa-msg.them{align-self:flex-start;background:#fff;border-top-left-radius:2px}
        .wa-msg.del{font-style:italic;color:#667781}
        .wa-meta{font-size:.64rem;color:#667781;text-align:right;margin-top:2px;white-space:nowrap}
        .wa-tick{color:#53bdeb;margin-left:3px}
        .wa-tick.off{color:#8696a0}
        .wa-chev{position:absolute;top:2px;right:4px;background:none;border:none;color:#667781;font-size:.7rem;cursor:pointer;opacity:0;padding:0 3px}
        .wa-msg:hover .wa-chev{opacity:1}
        .wa-menu{position:absolute;top:20px;right:4px;background:#fff;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.25);z-index:5;min-width:170px;padding:4px 0}
        .wa-menu button{display:block;width:100%;text-align:left;background:#fff;color:#111b21;border:none;padding:7px 14px;font-size:.82rem;cursor:pointer}
        .wa-menu button:hover{background:#f0f2f5;color:#111b21}
        .wa-msg.them .wa-menu{right:auto;left:4px}
        .wa-img{max-width:240px;max-height:240px;border-radius:6px;display:block;margin-bottom:4px;cursor:pointer}
        .wa-img-ph{width:200px;height:120px;background:#e9edef;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:.75rem;color:#667781;margin-bottom:4px}
        .wa-file{display:flex;gap:10px;align-items:center;background:rgba(0,0,0,.05);border-radius:6px;padding:7px 10px;cursor:pointer;margin-bottom:3px}
        .wa-file i{font-size:1.5rem;color:#128c7e}
        .wa-file-name{font-weight:600;font-size:.82rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .wa-file-size{font-size:.68rem;color:#667781}
        .wa-compose{background:#f0f2f5;padding:8px 12px;display:flex;align-items:flex-end;gap:8px;flex-shrink:0}
        .wa-compose textarea{flex:1;border:none;border-radius:20px;padding:9px 14px;font-size:.88rem;outline:none;resize:none;max-height:110px;font-family:inherit;background:#fff;color:#111b21}
        .wa-compose textarea::placeholder{color:#667781}
        .wa-send{width:40px;height:40px;border-radius:50%;border:none;background:#00a884;color:#fff;font-size:1rem;cursor:pointer;flex-shrink:0}
        .wa-send:disabled{opacity:.5}
        .wa-clip{background:none;border:none;font-size:1.3rem;color:#54656f;cursor:pointer;padding:6px}
        .wa-chip{background:#fff;margin:0 12px;padding:6px 10px;border-radius:8px;font-size:.8rem;display:flex;justify-content:space-between;align-items:center}
        .wa-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#667781;gap:8px;text-align:center;padding:20px}
        .wa-login{max-width:360px;margin:auto;background:#fff;border-radius:12px;padding:28px;width:100%;box-shadow:0 8px 30px rgba(0,0,0,.12)}
        .wa-login h5{text-align:center;font-weight:700;color:#075e54}
        .wa-login label{font-size:.78rem;font-weight:600;color:#54656f;margin-top:12px;display:block}
        .wa-login input{width:100%;border:1px solid #d1d7db;border-radius:8px;padding:9px 12px;font-size:.9rem;outline:none;box-sizing:border-box;background:#fff;color:#111b21}
        .wa-login input:focus{border-color:#00a884}
        .wa-login .go{width:100%;margin-top:18px;background:#00a884;color:#fff;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer}
        .wa-err{background:#fdecec;color:#b42323;border-radius:6px;padding:7px 10px;font-size:.8rem;margin-top:12px}
        .wa-prof{padding:24px;overflow-y:auto;flex:1;background:#fff}
        .wa-prof input,.wa-prof textarea{width:100%;border:1px solid #d1d7db;border-radius:8px;padding:8px 12px;font-size:.9rem;box-sizing:border-box;font-family:inherit;background:#fff;color:#111b21}
        .wa-prof input:disabled{background:#f0f2f5;color:#3b4a54;-webkit-text-fill-color:#3b4a54}
      `}</style>

      <div className="wa-panel">
        <div className="wa-top">
          <i className="bi bi-chat-dots-fill" style={{ fontSize: "1.2rem" }} />
          <h6>MPI Chat</h6>
          {token && profile && (
            <>
              <button className="wa-iconbtn" title="My profile" onClick={() => { setView("profile"); setActive(null); }}>
                <i className="bi bi-person-circle" />
              </button>
              <button className="wa-iconbtn" title="Chat logout" onClick={chatLogout}>
                <i className="bi bi-box-arrow-right" />
              </button>
            </>
          )}
          <button className="wa-iconbtn" title="Close" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>

        {/* ===== LOGIN ===== */}
        {!token && (
          <div style={{ flex: 1, display: "flex", background: "#efeae2", padding: 20, overflowY: "auto" }}>
            <form className="wa-login" onSubmit={doLogin}>
              <div style={{ textAlign: "center", fontSize: "2.4rem", color: "#25d366" }}><i className="bi bi-chat-dots-fill" /></div>
              <h5>Sign in to MPI Chat</h5>
              <div style={{ textAlign: "center", fontSize: ".78rem", color: "#667781" }}>
                Use your own login credentials to open your private chats.
              </div>
              <label>Username or Email</label>
              <input value={loginForm.identifier} onChange={(e) => setLoginForm({ ...loginForm, identifier: e.target.value })} autoFocus required />
              <label>Password</label>
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"} value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required />
                <i className={`bi ${showPw ? "bi-eye" : "bi-eye-slash"}`} onClick={() => setShowPw(!showPw)}
                  style={{ position: "absolute", right: 10, top: 10, cursor: "pointer", color: "#667781" }} />
              </div>
              {loginErr && <div className="wa-err">{loginErr}</div>}
              <button className="go" disabled={loginBusy}>{loginBusy ? "Signing in…" : "Open Chat"}</button>
            </form>
          </div>
        )}

        {/* ===== CHAT ===== */}
        {token && (
          <div className="wa-body">
            {showList && (
              <div className="wa-list">
                {profile && !showAll && (
                  <div className="wa-user" onClick={() => { setView("profile"); setActive(null); }} style={{ background: "#f7f8fa" }}>
                    <Avatar name={profile.name} />
                    <div className="wa-user-main">
                      <div className="wa-user-name">{profile.name} (You)</div>
                      <div className="wa-user-last">{profile.about}</div>
                    </div>
                  </div>
                )}
                {showAll && (
                  <div className="wa-newhead">
                    <button onClick={() => { setShowAll(false); setSearch(""); }}><i className="bi bi-arrow-left" /></button>
                    <span>New chat</span>
                  </div>
                )}
                <div className="wa-search">
                  <input placeholder={showAll ? "Search name or email" : "Search chats"} value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {!showAll && (
                  <button className="wa-fab" title="New chat" onClick={() => { setShowAll(true); setSearch(""); }}>
                    <i className="bi bi-chat-left-text-fill" />
                  </button>
                )}
                <div className="wa-users">
                  {filteredUsers.length === 0 && (
                    <div className="wa-empty" style={{ padding: 30 }}>
                      {search.trim() ? "No users found" : showAll ? "No users found" : "No chats yet. Tap the green button to start a new chat."}
                    </div>
                  )}
                  {filteredUsers.map((u) => (
                    <div key={u.id} className={`wa-user ${active?.id === u.id ? "on" : ""}`} onClick={() => { setActive(u); setView("chat"); setShowAll(false); setSearch(""); }}>
                      <Avatar name={u.name} />
                      <div className="wa-user-main">
                        <div className="wa-user-row">
                          <span className="wa-user-name">{u.name}</span>
                          {u.lastAt && <span className="wa-user-time">{fmtDay(u.lastAt) === "Today" ? fmtTime(u.lastAt) : fmtDay(u.lastAt)}</span>}
                        </div>
                        <div className="wa-user-row">
                          <span className="wa-user-last">{u.lastText ? (u.lastMine ? "You: " : "") + u.lastText : u.role}</span>
                          {u.unread > 0 && <span className="wa-badge">{u.unread}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showConvo && (
              <div className="wa-convo">
                {view === "profile" && profile ? (
                  <>
                    <div className="wa-chead">
                      {isMobile && <button className="back" onClick={() => setView("chat")}><i className="bi bi-arrow-left" /></button>}
                      <b>My Profile</b>
                    </div>
                    <div className="wa-prof">
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><Avatar name={profile.name} size={90} /></div>
                      <label style={{ fontSize: ".75rem", color: "#667781" }}>Name</label>
                      <input value={profile.name} disabled style={{ marginBottom: 12 }} />
                      <label style={{ fontSize: ".75rem", color: "#667781" }}>Email</label>
                      <input value={profile.email} disabled style={{ marginBottom: 12 }} />
                      <label style={{ fontSize: ".75rem", color: "#667781" }}>Role</label>
                      <input value={profile.role} disabled style={{ marginBottom: 12 }} />
                      <label style={{ fontSize: ".75rem", color: "#667781" }}>About</label>
                      <textarea rows={2} maxLength={140} value={aboutDraft} onChange={(e) => setAboutDraft(e.target.value)} />
                      <button className="wa-send" style={{ width: "auto", borderRadius: 8, padding: "8px 22px", marginTop: 12 }} onClick={saveAbout}>Save</button>
                    </div>
                  </>
                ) : !active ? (
                  <div className="wa-empty">
                    <i className="bi bi-chat-dots" style={{ fontSize: "3rem", color: "#25d366" }} />
                    <b>MPI Chat</b>
                    <span>Select a person from the list to start chatting.<br />Your messages are visible only to you and the person you chat with.</span>
                  </div>
                ) : (
                  <>
                    <div className="wa-chead">
                      {isMobile && <button className="back" onClick={() => setActive(null)}><i className="bi bi-arrow-left" /></button>}
                      <Avatar name={active.name} size={38} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{active.name}</div>
                        <div style={{ fontSize: ".72rem", color: "#667781" }}>{active.about || active.role}</div>
                      </div>
                    </div>

                    <div className="wa-msgs" onClick={() => setMenuId(null)}>
                      {msgs.map((m, i) => {
                        const newDay = i === 0 || fmtDay(msgs[i - 1].createdAt) !== fmtDay(m.createdAt);
                        return (
                          <div key={m._id} style={{ display: "contents" }}>
                            {newDay && <div className="wa-day">{fmtDay(m.createdAt)}</div>}
                            <div className={`wa-msg ${m.mine ? "me" : "them"} ${m.deletedAll ? "del" : ""}`}>
                              {!m.deletedAll && (
                                <button className="wa-chev" onClick={(e) => { e.stopPropagation(); setMenuId(menuId === m._id ? null : m._id); }}>
                                  <i className="bi bi-chevron-down" />
                                </button>
                              )}
                              {menuId === m._id && (
                                <div className="wa-menu">
                                  <button onClick={() => delForMe(m._id)}>Delete for me</button>
                                  {m.mine && <button onClick={() => delForAll(m._id)}>Delete for everyone</button>}
                                </div>
                              )}
                              {m.deletedAll ? "🚫 This message was deleted" : (
                                <>
                                  {m.attachment && <Attachment msg={m} api={api} />}
                                  {m.text}
                                </>
                              )}
                              <div className="wa-meta">
                                {fmtTime(m.createdAt)}
                                {m.mine && (m.delivered || m.read
                                  ? <i className={`bi bi-check2-all wa-tick ${m.read ? "" : "off"}`} />
                                  : <i className="bi bi-check2 wa-tick off" />)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={endRef} />
                    </div>

                    {file && (
                      <div className="wa-chip">
                        <span><i className="bi bi-paperclip" /> {file.name} ({fmtSize(file.size)})</span>
                        <button className="wa-clip" style={{ fontSize: ".9rem" }} onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}>
                          <i className="bi bi-x-lg" />
                        </button>
                      </div>
                    )}

                    <div className="wa-compose">
                      <input ref={fileRef} type="file" hidden onChange={(e) => setFile(e.target.files[0] || null)} />
                      <button className="wa-clip" title="Attach" onClick={() => fileRef.current?.click()}><i className="bi bi-paperclip" /></button>
                      <textarea
                        rows={1}
                        placeholder="Type a message"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      />
                      <button className="wa-send" disabled={sending || (!text.trim() && !file)} onClick={send}>
                        <i className="bi bi-send-fill" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}