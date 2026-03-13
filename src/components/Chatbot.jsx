import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";

// ── Responsive hook ──────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// ── Date grouping ────────────────────────────────────────────
function groupByDate(items) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday - 86400000);
  const sevenDaysAgo = new Date(startOfToday - 6 * 86400000);
  const thirtyDaysAgo = new Date(startOfToday - 29 * 86400000);
  const groups = {
    Today: [], Yesterday: [], "Previous 7 Days": [],
    "Previous 30 Days": [], Older: [],
  };
  for (const item of items) {
    const d = new Date(item.date);
    if (d >= startOfToday)        groups["Today"].push(item);
    else if (d >= startOfYesterday) groups["Yesterday"].push(item);
    else if (d >= sevenDaysAgo)   groups["Previous 7 Days"].push(item);
    else if (d >= thirtyDaysAgo)  groups["Previous 30 Days"].push(item);
    else                          groups["Older"].push(item);
  }
  return groups;
}

// ── HistoryItem ──────────────────────────────────────────────
function HistoryItem({ item, isActive, onSelect, onRename, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(item.title);
  const inputRef = useRef(null);

  useEffect(() => { if (renaming) inputRef.current?.focus(); }, [renaming]);

  const commitRename = () => {
    if (renameVal.trim()) onRename(item.id, renameVal.trim());
    setRenaming(false);
  };

  return (
    <div
      style={{
        ...s.historyItem,
        background: isActive ? "#1a2744" : hovered ? "#111827" : "transparent",
        borderLeft: isActive ? "2px solid #22c55e" : "2px solid transparent",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !renaming && onSelect(item.id)}
    >
      {renaming ? (
        <input
          ref={inputRef}
          value={renameVal}
          onChange={(e) => setRenameVal(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setRenaming(false);
          }}
          style={s.renameInput}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span style={s.historyTitle}>{item.title}</span>
      )}
      {(hovered || isActive) && !renaming && (
        <div style={s.historyActions} onClick={(e) => e.stopPropagation()}>
          <button style={s.actionBtn} title="Rename" onClick={() => setRenaming(true)}>✏️</button>
          <button style={s.actionBtn} title="Delete" onClick={() => onDelete(item.id)}>🗑️</button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────
export default function KimiAI() {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello 👋 I'm Nova. I am here to talk. So what can I help you with?" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const isFirstMessageRef = useRef(true);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close drawer on desktop resize
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userText = input.trim();
    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsLoading(true);

    if (isFirstMessageRef.current) {
      isFirstMessageRef.current = false;
      const id = activeChatId ?? Date.now();
      const title = userText.length > 40 ? userText.slice(0, 40) + "…" : userText;
      if (activeChatId === null) {
        setActiveChatId(id);
        setHistory((h) => [{ id, title, date: new Date() }, ...h]);
      } else {
        setHistory((h) => h.map((item) => (item.id === id ? { ...item, title } : item)));
      }
    }

    try {
      const res = await axios.post("https://chat-bot-backend1.vercel.app/api/chat", { messages: newMessages });
      setMessages([...newMessages, { role: "assistant", content: res.data.reply }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "⚠️ Error connecting to server." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setActiveChatId(null);
    isFirstMessageRef.current = true;
    setMessages([{ role: "assistant", content: "Hello 👋 I'm Nova. I am here to talk. So what can I help you with?" }]);
    if (isMobile) setDrawerOpen(false);
  };

  const handleSelect = (id) => {
    setActiveChatId(id);
    if (isMobile) setDrawerOpen(false);
  };

  const handleRename = (id, newTitle) =>
    setHistory((h) => h.map((item) => (item.id === id ? { ...item, title: newTitle } : item)));

  const handleDelete = (id) => {
    setHistory((h) => h.filter((item) => item.id !== id));
    if (activeChatId === id) startNewChat();
  };

  const grouped = groupByDate(history);

  const SidebarContent = (
    <aside style={{ ...s.sidebar, width: isMobile ? "82vw" : 264 }}>
      {/* Logo */}
      <div style={s.logo}>
        <span style={s.logoIcon}>⬡</span>
        <span style={s.logoText}>KimiAI</span>
        {isMobile && (
          <button style={s.closeDrawer} onClick={() => setDrawerOpen(false)}>✕</button>
        )}
      </div>

      {/* New Chat */}
      <button style={s.newChat} onClick={startNewChat}>
        <span style={s.newChatPlus}>+</span> New Chat
      </button>

      {/* History */}
      <div style={s.historyScroll}>
        {history.length === 0 && (
          <p style={s.emptyHistory}>No chats yet. Start a conversation!</p>
        )}
        {Object.entries(grouped).map(([group, items]) =>
          items.length === 0 ? null : (
            <div key={group} style={s.historyGroup}>
              <div style={s.groupLabel}>{group}</div>
              {items.map((item) => (
                <HistoryItem
                  key={item.id}
                  item={item}
                  isActive={activeChatId === item.id}
                  onSelect={handleSelect}
                  onRename={handleRename}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )
        )}
      </div>

      <div style={s.sidebarFooter}>
        <div style={s.poweredBy}>Powered by Groq API</div>
      </div>
    </aside>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html {
          height: 100%;
          height: -webkit-fill-available;
        }
        body {
          height: 100%;
          height: -webkit-fill-available;
          overflow: hidden;
        }
        #root {
          height: 100%;
          height: -webkit-fill-available;
          overflow: hidden;
        }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        textarea { font-size: 16px !important; }
        button, input, textarea { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
      `}</style>

      <div style={s.shell}>

        {/* ── Desktop Sidebar ── */}
        {!isMobile && SidebarContent}

        {/* ── Mobile Drawer Overlay ── */}
        {isMobile && drawerOpen && (
          <>
            <div
              style={s.overlay}
              onClick={() => setDrawerOpen(false)}
            />
            <div style={s.mobileDrawer}>
              {SidebarContent}
            </div>
          </>
        )}

        {/* ── Main ── */}
        <main style={s.main}>

          {/* Header */}
          <header style={s.header}>
            {isMobile && (
              <button style={s.hamburger} onClick={() => setDrawerOpen(true)}>
                <span style={s.hamLine} />
                <span style={s.hamLine} />
                <span style={s.hamLine} />
              </button>
            )}
            <div style={{ flex: 1 }}>
              <h1 style={{ ...s.title, fontSize: isMobile ? 18 : 24 }}>KimiAI Assistant</h1>
            </div>
            {/* Message count badge */}
            {messages.length > 1 && (
              <div style={s.badge}>{messages.length} msgs</div>
            )}
          </header>
          <div style={s.headerLine} />

          {/* Messages */}
          <div style={s.messageArea}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  ...s.msgRow,
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  animationDelay: `${Math.min(i * 0.04, 0.3)}s`,
                }}
              >
                {msg.role === "assistant" && (
                  <div style={{ ...s.avatar, width: isMobile ? 28 : 32, height: isMobile ? 28 : 32 }}>⬡</div>
                )}
                <div style={{
                  ...(msg.role === "user" ? s.userBubble : s.botBubble),
                  maxWidth: isMobile ? "82%" : "62%",
                  fontSize: isMobile ? 13 : 14,
                }}>
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div style={{ ...s.userAvatar, width: isMobile ? 28 : 32, height: isMobile ? 28 : 32 }}>U</div>
                )}
              </div>
            ))}

            {isLoading && (
              <div style={{ ...s.msgRow, justifyContent: "flex-start" }}>
                <div style={s.avatar}>⬡</div>
                <div style={s.botBubble}>
                  {[0, 0.2, 0.4].map((d, i) => (
                    <span key={i} style={{ ...s.dot, animationDelay: `${d}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ ...s.inputRow, padding: isMobile ? "10px 12px 14px" : "12px 40px 20px" }}>
            <div style={s.inputWrap}>
              <textarea
                ref={textareaRef}
                style={{ ...s.input, fontSize: 16 }}
                placeholder="Message KimiAI…"
                value={input}
                rows={1}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isMobile) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={isLoading}
              />
              <button
                style={{
                  ...s.sendBtn,
                  opacity: input.trim() ? 1 : 0.35,
                  width: isMobile ? 44 : 40,
                  height: isMobile ? 44 : 40,
                }}
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
              >↑</button>
            </div>
            {!isMobile && (
              <p style={s.hint}>Enter to send · Shift+Enter for new line</p>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────
const s = {
  shell: {
    display: "flex",
    width: "100vw",
    height: "100svh",         // small viewport height — keyboard-safe on Android
    fontFamily: "'Syne', sans-serif",
    background: "#020617",
    color: "#e2e8f0",
    overflow: "hidden",
    position: "relative",
  },

  // Sidebar
  sidebar: {
    height: "100%",
    background: "#0b1120",
    borderRight: "1px solid #1e293b",
    display: "flex",
    flexDirection: "column",
    padding: "20px 10px 16px",
    overflow: "hidden",
    flexShrink: 0,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    zIndex: 40,
    animation: "fadeIn 0.2s ease",
  },
  mobileDrawer: {
    position: "fixed",
    top: 0,
    left: 0,
    height: "100svh",
    zIndex: 50,
    animation: "slideInLeft 0.25s cubic-bezier(0.32,0.72,0,1)",
    boxShadow: "4px 0 32px #000a",
  },
  closeDrawer: {
    marginLeft: "auto",
    background: "transparent",
    border: "none",
    color: "#64748b",
    fontSize: 18,
    cursor: "pointer",
    padding: "4px 6px",
    lineHeight: 1,
    minWidth: 44,
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    paddingLeft: 6,
    minHeight: 44,
  },
  logoIcon: {
    fontSize: 26,
    background: "linear-gradient(135deg,#22c55e,#06b6d4)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    flexShrink: 0,
  },
  logoText: {
    fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px",
    background: "linear-gradient(90deg,#22c55e,#06b6d4,#3b82f6)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  newChat: {
    width: "100%", padding: "12px 14px",
    background: "linear-gradient(135deg,#22c55e22,#06b6d422)",
    border: "1px solid #22c55e44", borderRadius: 10,
    color: "#22c55e", fontFamily: "'Syne', sans-serif",
    fontWeight: 600, fontSize: 14, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 8,
    marginBottom: 12, minHeight: 48,
  },
  newChatPlus: { fontSize: 18, fontWeight: 300 },
  historyScroll: {
    flex: 1, overflowY: "auto",
    display: "flex", flexDirection: "column", gap: 2,
    WebkitOverflowScrolling: "touch",
  },
  emptyHistory: {
    fontSize: 12, color: "#334155",
    textAlign: "center", marginTop: 24,
    padding: "0 12px", lineHeight: 1.6,
  },
  historyGroup: { marginBottom: 6 },
  groupLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
    color: "#475569", padding: "10px 10px 4px",
    textTransform: "uppercase",
  },
  historyItem: {
    display: "flex", alignItems: "center",
    padding: "10px 10px", borderRadius: 8,
    cursor: "pointer", fontSize: 13, color: "#94a3b8",
    transition: "background 0.15s", gap: 8,
    minHeight: 44,                  // touch-safe
    borderLeft: "2px solid transparent",
  },
  historyTitle: {
    flex: 1, whiteSpace: "nowrap",
    overflow: "hidden", textOverflow: "ellipsis",
    fontSize: 13, lineHeight: 1.4,
  },
  historyActions: { display: "flex", gap: 4, flexShrink: 0 },
  actionBtn: {
    background: "transparent", border: "none", cursor: "pointer",
    fontSize: 14, padding: "6px", borderRadius: 6,
    opacity: 0.8, lineHeight: 1,
    minWidth: 32, minHeight: 32,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  renameInput: {
    flex: 1, background: "#1e293b",
    border: "1px solid #334155", borderRadius: 5,
    color: "#e2e8f0", fontFamily: "'Syne', sans-serif",
    fontSize: 13, padding: "4px 8px", outline: "none",
    minHeight: 36,
  },
  sidebarFooter: { paddingTop: 10, paddingLeft: 6 },
  poweredBy: { fontSize: 11, color: "#1e3a5f" },

  // Main
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    height: "100svh",           // Android keyboard-safe
    overflow: "hidden",
    background: "#020617",
    minWidth: 0,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 16px",
    height: 58,
    flexShrink: 0,
  },
  hamburger: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    gap: 5,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 44,
    minHeight: 44,
    borderRadius: 8,
    flexShrink: 0,
  },
  hamLine: {
    display: "block",
    width: 22,
    height: 2,
    background: "#64748b",
    borderRadius: 2,
  },
  title: {
    fontWeight: 800,
    letterSpacing: "-0.4px",
    background: "linear-gradient(90deg,#22c55e,#06b6d4,#3b82f6)",
    backgroundSize: "200% auto",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    animation: "shimmer 4s linear infinite",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  badge: {
    padding: "3px 8px",
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 20,
    fontSize: 10,
    color: "#475569",
    fontFamily: "'JetBrains Mono', monospace",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  headerLine: {
    height: 1,
    background: "linear-gradient(90deg,#22c55e33,#3b82f633,transparent)",
    flexShrink: 0,
  },
  messageArea: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    WebkitOverflowScrolling: "touch",
  },
  msgRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
    animation: "fadeUp 0.25s ease both",
  },
  avatar: {
    borderRadius: "50%",
    background: "linear-gradient(135deg,#22c55e22,#06b6d422)",
    border: "1px solid #22c55e44",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, flexShrink: 0, color: "#22c55e",
  },
  userAvatar: {
    borderRadius: "50%",
    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
  },
  userBubble: {
    padding: "10px 14px",
    borderRadius: "16px 16px 4px 16px",
    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    color: "#fff", lineHeight: 1.6,
    fontFamily: "'JetBrains Mono', monospace",
    boxShadow: "0 4px 16px #2563eb33",
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  },
  botBubble: {
    padding: "10px 14px",
    borderRadius: "16px 16px 16px 4px",
    background: "#0f1f35", border: "1px solid #1e3a5f",
    color: "#cbd5e1", lineHeight: 1.6,
    fontFamily: "'JetBrains Mono', monospace",
    display: "flex", alignItems: "center", gap: 6,
    wordBreak: "break-word", whiteSpace: "pre-wrap",
  },
  dot: {
    display: "inline-block", width: 7, height: 7,
    borderRadius: "50%", background: "#22c55e",
    animation: "pulse 1s ease infinite",
    flexShrink: 0,
  },
  inputRow: {
    flexShrink: 0,
    borderTop: "1px solid #0f172a",
  },
  inputWrap: {
    display: "flex", alignItems: "flex-end",
    background: "#0f172a", border: "1px solid #1e293b",
    borderRadius: 14, padding: "6px 6px 6px 14px", gap: 8,
    boxShadow: "0 0 30px #06b6d408",
  },
  input: {
    flex: 1, background: "transparent", border: "none", outline: "none",
    color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace",
    lineHeight: 1.5, resize: "none",
    padding: "6px 0", minHeight: 32, maxHeight: 120,
    overflowY: "auto", WebkitOverflowScrolling: "touch",
  },
  sendBtn: {
    borderRadius: 10, border: "none",
    background: "linear-gradient(135deg,#22c55e,#06b6d4)",
    color: "#fff", fontSize: 18, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, fontWeight: 800,
    alignSelf: "flex-end",
    transition: "opacity 0.2s, transform 0.1s",
  },
  hint: {
    fontSize: 10, color: "#1e3a5f", textAlign: "center",
    marginTop: 5, fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: "0.05em",
  },
};