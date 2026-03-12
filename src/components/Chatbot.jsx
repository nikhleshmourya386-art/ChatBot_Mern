

import { useState, useRef, useEffect } from "react";
import axios from "axios";

function groupByDate(items) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday - 86400000);
  const sevenDaysAgo = new Date(startOfToday - 6 * 86400000);
  const thirtyDaysAgo = new Date(startOfToday - 29 * 86400000);

  const groups = {
    Today: [],
    Yesterday: [],
    "Previous 7 Days": [],
    "Previous 30 Days": [],
    Older: [],
  };

  for (const item of items) {
    const d = new Date(item.date);
    if (d >= startOfToday) groups["Today"].push(item);
    else if (d >= startOfYesterday) groups["Yesterday"].push(item);
    else if (d >= sevenDaysAgo) groups["Previous 7 Days"].push(item);
    else if (d >= thirtyDaysAgo) groups["Previous 30 Days"].push(item);
    else groups["Older"].push(item);
  }

  return groups;
}

function HistoryItem({ item, isActive, onSelect, onRename, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(item.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (renaming) inputRef.current?.focus();
  }, [renaming]);

  const commitRename = () => {
    if (renameVal.trim()) onRename(item.id, renameVal.trim());
    setRenaming(false);
  };

  return (
    <div
      style={{
        ...s.historyItem,
        background: isActive ? "#1e293b" : hovered ? "#111827" : "transparent",
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

export default function KimiAI() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello 👋 I'm Nova. I am here to talk. So what can I help you with?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);          // starts empty — no dummies
  const [activeChatId, setActiveChatId] = useState(null);
  const isFirstMessageRef = useRef(true);              // tracks whether this chat has been saved yet
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // ── Save to history on the very first message of this chat ──
    if (isFirstMessageRef.current) {
      isFirstMessageRef.current = false;
      const id = activeChatId ?? Date.now();
      // Truncate title to 40 chars for sidebar readability
      const title = userText.length > 40 ? userText.slice(0, 40) + "…" : userText;

      if (activeChatId === null) {
        setActiveChatId(id);
        setHistory((h) => [{ id, title, date: new Date() }, ...h]);
      } else {
        // Chat was started via "New Chat" but title is still default — update it
        setHistory((h) =>
          h.map((item) => (item.id === id ? { ...item, title } : item))
        );
      }
    }

    try {
         const res = await axios.post(
  `${process.env.REACT_APP_API_URL}/api/chat`,
  { messages: newMessages }
);
      setMessages([...newMessages, { role: "assistant", content: res.data.reply }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "⚠️ Error connecting to server." }]);
    } finally {
      setIsLoading(false);
    }
  };

  // "New Chat" only resets the view — nothing is written to history yet
  const startNewChat = () => {
    setActiveChatId(null);
    isFirstMessageRef.current = true;
    setMessages([
      {
        role: "assistant",
        content: "Hello 👋 I'm Nova. I am here to talk. So what can I help you with?",
      },
    ]);
  };

  const handleRename = (id, newTitle) =>
    setHistory((h) => h.map((item) => (item.id === id ? { ...item, title: newTitle } : item)));

  const handleDelete = (id) => {
    setHistory((h) => h.filter((item) => item.id !== id));
    if (activeChatId === id) startNewChat();
  };

  const grouped = groupByDate(history);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100%; height: 100%; overflow: hidden; }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
      `}</style>

      <div style={s.shell}>

        {/* ── Sidebar ── */}
        <aside style={s.sidebar}>
          <div style={s.logo}>
            <span style={s.logoIcon}>⬡</span>
            <span style={s.logoText}>KimiAI</span>
          </div>

          <button style={s.newChat} onClick={startNewChat}>
            <span style={s.newChatPlus}>+</span> New Chat
          </button>

          {/* Grouped History — only real chats appear here */}
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
                      onSelect={setActiveChatId}
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

        {/* ── Main ── */}
        <main style={s.main}>
          <header style={s.header}>
            <h1 style={s.title}>KimiAI Assistant</h1>
            <div style={s.headerLine} />
          </header>

          <div style={s.messageArea}>
            {messages.length === 0 && (
              <div style={s.emptyState}>
                <div style={s.emptyIcon}>⬡</div>
                <p style={s.emptyText}>Ask me anything</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  ...s.msgRow,
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  animationDelay: `${i * 0.04}s`,
                }}
              >
                {msg.role === "assistant" && <div style={s.avatar}>⬡</div>}
                <div style={msg.role === "user" ? s.userBubble : s.botBubble}>
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ ...s.msgRow, justifyContent: "flex-start" }}>
                <div style={s.avatar}>⬡</div>
                <div style={s.botBubble}>
                  <span style={s.dot} />
                  <span style={{ ...s.dot, animationDelay: "0.2s" }} />
                  <span style={{ ...s.dot, animationDelay: "0.4s" }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={s.inputRow}>
            <div style={s.inputWrap}>
              <input
                style={s.input}
                placeholder="Type your message…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                disabled={isLoading}
              />
              <button
                style={{ ...s.sendBtn, opacity: input.trim() ? 1 : 0.4 }}
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
              >↑</button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

const s = {
  shell: {
    display: "flex", width: "100vw", height: "100vh",
    fontFamily: "'Syne', sans-serif",
    background: "#020617", color: "#e2e8f0", overflow: "hidden",
  },

  // Sidebar
  sidebar: {
    width: 260, minWidth: 260, height: "100vh",
    background: "#0b1120", borderRight: "1px solid #1e293b",
    display: "flex", flexDirection: "column",
    padding: "20px 10px 16px", overflow: "hidden",
  },
  logo: {
    display: "flex", alignItems: "center",
    gap: 10, marginBottom: 16, paddingLeft: 6,
  },
  logoIcon: {
    fontSize: 26,
    background: "linear-gradient(135deg,#22c55e,#06b6d4)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  logoText: {
    fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px",
    background: "linear-gradient(90deg,#22c55e,#06b6d4,#3b82f6)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  newChat: {
    width: "100%", padding: "10px 14px",
    background: "linear-gradient(135deg,#22c55e22,#06b6d422)",
    border: "1px solid #22c55e44", borderRadius: 10,
    color: "#22c55e", fontFamily: "'Syne', sans-serif",
    fontWeight: 600, fontSize: 14, cursor: "pointer",
    display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
  },
  newChatPlus: { fontSize: 18, fontWeight: 300 },

  historyScroll: {
    flex: 1, overflowY: "auto",
    display: "flex", flexDirection: "column", gap: 2,
  },
  emptyHistory: {
    fontSize: 12, color: "#334155",
    textAlign: "center", marginTop: 24, padding: "0 12px", lineHeight: 1.6,
  },
  historyGroup: { marginBottom: 6 },
  groupLabel: {
    fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
    color: "#475569", padding: "10px 10px 4px",
    textTransform: "uppercase",
  },
  historyItem: {
    display: "flex", alignItems: "center",
    padding: "8px 10px", borderRadius: 8,
    cursor: "pointer", fontSize: 13, color: "#94a3b8",
    transition: "background 0.15s", gap: 8, minHeight: 36,
  },
  historyTitle: {
    flex: 1,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    fontSize: 13, lineHeight: 1.4,
  },
  historyActions: { display: "flex", gap: 2, flexShrink: 0 },
  actionBtn: {
    background: "transparent", border: "none",
    cursor: "pointer", fontSize: 12,
    padding: "2px 3px", borderRadius: 4,
    opacity: 0.7, lineHeight: 1,
  },
  renameInput: {
    flex: 1, background: "#1e293b",
    border: "1px solid #334155", borderRadius: 5,
    color: "#e2e8f0", fontFamily: "'Syne', sans-serif",
    fontSize: 13, padding: "2px 6px", outline: "none",
  },
  sidebarFooter: { paddingTop: 10, paddingLeft: 6 },
  poweredBy: { fontSize: 11, color: "#1e3a5f" },

  // Main
  main: {
    flex: 1, display: "flex", flexDirection: "column",
    height: "100vh", overflow: "hidden", background: "#020617",
  },
  header: { padding: "28px 40px 16px", flexShrink: 0 },
  title: {
    fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px",
    background: "linear-gradient(90deg,#22c55e,#06b6d4,#3b82f6)",
    backgroundSize: "200% auto",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    animation: "shimmer 4s linear infinite", marginBottom: 10,
  },
  headerLine: {
    height: 1,
    background: "linear-gradient(90deg,#22c55e33,#3b82f633,transparent)",
  },
  messageArea: {
    flex: 1, overflowY: "auto", padding: "24px 40px",
    display: "flex", flexDirection: "column", gap: 16,
  },
  emptyState: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: 12, opacity: 0.25, marginTop: "20vh",
  },
  emptyIcon: {
    fontSize: 56,
    background: "linear-gradient(135deg,#22c55e,#06b6d4)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  emptyText: {
    fontSize: 16, color: "#64748b",
    fontFamily: "'JetBrains Mono', monospace",
  },
  msgRow: {
    display: "flex", alignItems: "flex-end",
    gap: 10, animation: "fadeUp 0.3s ease both",
  },
  avatar: {
    width: 32, height: 32, borderRadius: "50%",
    background: "linear-gradient(135deg,#22c55e22,#06b6d422)",
    border: "1px solid #22c55e44",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, flexShrink: 0, color: "#22c55e",
  },
  userBubble: {
    maxWidth: "62%", padding: "12px 16px",
    borderRadius: "16px 16px 4px 16px",
    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    color: "#fff", fontSize: 14, lineHeight: 1.6,
    fontFamily: "'JetBrains Mono', monospace",
    boxShadow: "0 4px 20px #2563eb33",
  },
  botBubble: {
    maxWidth: "62%", padding: "12px 16px",
    borderRadius: "16px 16px 16px 4px",
    background: "#0f1f35", border: "1px solid #1e3a5f",
    color: "#cbd5e1", fontSize: 14, lineHeight: 1.6,
    fontFamily: "'JetBrains Mono', monospace",
    display: "flex", alignItems: "center", gap: 6,
  },
  dot: {
    display: "inline-block", width: 7, height: 7,
    borderRadius: "50%", background: "#22c55e",
    animation: "pulse 1s ease infinite",
  },
  inputRow: {
    padding: "16px 40px 24px", flexShrink: 0,
    borderTop: "1px solid #0f172a",
  },
  inputWrap: {
    display: "flex", alignItems: "center",
    background: "#0f172a", border: "1px solid #1e293b",
    borderRadius: 14, padding: "6px 6px 6px 18px", gap: 8,
    boxShadow: "0 0 40px #06b6d408",
  },
  input: {
    flex: 1, background: "transparent", border: "none", outline: "none",
    color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace",
    fontSize: 14, padding: "8px 0",
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 10, border: "none",
    background: "linear-gradient(135deg,#22c55e,#06b6d4)",
    color: "#fff", fontSize: 18, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, fontWeight: 700,
  },
};
