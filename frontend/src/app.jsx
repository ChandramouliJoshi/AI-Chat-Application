import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { streamChat } from "./services/chatService";
import {
  createConversation,
  createMessage,
  loadWorkspace,
  saveWorkspace,
  titleFromMessage,
} from "./services/conversationService";

const iconPaths = {
  add: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  archive: <><path d="M3 4h18v4H3z" /><path d="M5 8v12h14V8" /><path d="M10 12h4" /></>,
  arrow: <><path d="M7 17 17 7" /><path d="M7 7h10v10" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  close: <><path d="m18 6-12 12" /><path d="m6 6 12 12" /></>,
  edit: <><path d="m15 5 4 4" /><path d="m4 20 4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z" /></>,
  folder: <><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  message: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2Z" /><path d="m19 14 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1Z" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
};

function Icon({ name, size = 18, ...props }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {iconPaths[name]}
    </svg>
  );
}

const suggestions = [
  { title: "Explain a concept", detail: "Break something down", prompt: "Explain a complex concept in simple terms" },
  { title: "Write something", detail: "Find the right words", prompt: "Help me write a clear, thoughtful message" },
  { title: "Solve a problem", detail: "Work through it together", prompt: "Help me think through a problem step by step" },
  { title: "Explore an idea", detail: "See where it takes you", prompt: "I have an idea I'd like to explore" },
];

export default function App() {
  const [input, setInput] = useState("");
  const [initialWorkspace] = useState(loadWorkspace);
  const [projects, setProjects] = useState(initialWorkspace.projects);
  const [chatSessions, setChatSessions] = useState(initialWorkspace.conversations);
  const [activeChatId, setActiveChatId] = useState(initialWorkspace.activeId);
  const [selectedProjectId, setSelectedProjectId] = useState(initialWorkspace.selectedProjectId);
  const [dialog, setDialog] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [generatingChatId, setGeneratingChatId] = useState(null);
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [storageError, setStorageError] = useState(false);
  const [showLatestButton, setShowLatestButton] = useState(false);
  const inputRef = useRef(null);
  const composerRef = useRef(null);
  const scrollRef = useRef(null);
  const messageEndRef = useRef(null);
  const requestRef = useRef(null);
  const atBottomRef = useRef(true);
  const [composerSize, setComposerSize] = useState({ width: 0, height: 0 });
  const [sweepRun, setSweepRun] = useState(0);
  const [sweepActive, setSweepActive] = useState(false);

  const activeChat = useMemo(
    () => chatSessions.find((chat) => chat.id === activeChatId) || chatSessions[0],
    [chatSessions, activeChatId]
  );
  const loading = generatingChatId === activeChatId;
  const isEmptyChat = activeChat.messages.length === 0 && !loading;

  useEffect(() => {
    try {
      saveWorkspace({
        conversations: chatSessions,
        projects,
        activeId: activeChatId,
        selectedProjectId,
      });
      setStorageError(false);
    } catch (error) {
      console.error("Could not save the CJ workspace.", error);
      setStorageError(true);
    }
  }, [chatSessions, projects, activeChatId, selectedProjectId]);

  useEffect(() => {
    if (atBottomRef.current) {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      setShowLatestButton(false);
    } else {
      setShowLatestButton(true);
    }
  }, [activeChat?.messages, loading]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return undefined;

    const resizeObserver = new ResizeObserver(() => {
      const { width, height } = composer.getBoundingClientRect();
      setComposerSize({ width, height });
    });
    resizeObserver.observe(composer);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    let mounted = true;
    let controller;
    let timeout;

    const checkBackend = async () => {
      controller?.abort();
      clearTimeout(timeout);
      controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 3000);
      try {
        const response = await fetch("http://127.0.0.1:8000/", {
          signal: controller.signal,
        });
        if (mounted) setBackendStatus(response.ok ? "connected" : "offline");
      } catch {
        if (mounted) setBackendStatus("offline");
      } finally {
        clearTimeout(timeout);
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
      clearTimeout(timeout);
      controller?.abort();
    };
  }, []);

  const updateChat = (chatId, updater) => {
    setChatSessions((previous) =>
      previous.map((chat) =>
        chat.id === chatId
          ? { ...chat, ...updater(chat), updatedAt: new Date().toISOString() }
          : chat
      )
    );
  };

  const startBorderSweep = () => {
    setSweepActive(false);
    setSweepRun((run) => run + 1);
    requestAnimationFrame(() => setSweepActive(true));
  };

  const createNewChat = useCallback(() => {
    const conversation = createConversation(selectedProjectId);
    setChatSessions((previous) => [conversation, ...previous]);
    setActiveChatId(conversation.id);
    atBottomRef.current = true;
    setShowLatestButton(false);
    setInput("");
    setEditingMessageId(null);
    setSidebarOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [selectedProjectId]);

  const selectProject = (projectId) => {
    setSelectedProjectId(projectId);
    const existing = chatSessions.find((chat) => chat.projectId === projectId);
    if (existing) {
      setActiveChatId(existing.id);
    } else if (projectId) {
      const conversation = createConversation(projectId);
      setChatSessions((previous) => [conversation, ...previous]);
      setActiveChatId(conversation.id);
    }
    atBottomRef.current = true;
    setShowLatestButton(false);
    setSidebarOpen(false);
  };

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        createNewChat();
      }
      if (event.key === "Escape") setOpenMenuId(null);
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        document.querySelector(".conversation-search input")?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [createNewChat]);

  const openDialog = (kind) => {
    setDialog({
      kind,
      value: kind === "rename" ? activeChat?.title || "" : "New project",
    });
  };

  const saveDialog = (event) => {
    event.preventDefault();
    if (dialog?.kind === "delete") {
      deleteConversation(dialog.chatId);
      return;
    }
    const value = dialog?.value.trim();
    if (!value) return;

    if (dialog.kind === "rename") {
      updateChat(activeChatId, () => ({ title: value }));
    } else if (dialog.kind === "project") {
      const project = { id: crypto.randomUUID(), name: value, createdAt: new Date().toISOString() };
      setProjects((previous) => [...previous, project]);
    } else if (dialog.kind === "delete") {
      const remaining = chatSessions.filter((chat) => chat.id !== dialog.chatId);
      const next = remaining[0] || createConversation(selectedProjectId);
      setChatSessions(remaining.length ? remaining : [next]);
      if (activeChatId === dialog.chatId) setActiveChatId(next.id);
    }
    setDialog(null);
  };

  const generateFrom = async (chatId, history, assistantId) => {
    const controller = new AbortController();
    requestRef.current = { chatId, controller };
    setGeneratingChatId(chatId);
    try {
      const reply = await streamChat(history, {
        signal: controller.signal,
        onToken(token) {
          updateChat(chatId, (chat) => ({
            messages: chat.messages.map((message) =>
              message.id === assistantId
                ? { ...message, content: message.content + token, status: "streaming" }
                : message
            ),
          }));
        },
      });
      updateChat(chatId, (chat) => ({
        messages: chat.messages.map((message) =>
          message.id === assistantId ? { ...message, content: reply, status: "complete" } : message
        ),
      }));
    } catch (error) {
      const stopped = error.name === "AbortError";
      updateChat(chatId, (chat) => ({
        messages: chat.messages.map((message) =>
          message.id === assistantId
            ? { ...message, status: stopped ? "stopped" : "error", error: stopped ? null : error.message }
            : message
        ),
      }));
    } finally {
      requestRef.current = null;
      setGeneratingChatId(null);
    }
  };

  const sendMessage = (message = input) => {
    const text = message.trim();
    if (!text || generatingChatId) return;
    const chat = chatSessions.find((item) => item.id === activeChatId);
    if (!chat) return;

    let userMessage;
    let history;
    if (editingMessageId) {
      const index = chat.messages.findIndex((item) => item.id === editingMessageId);
      if (index < 0) return;
      userMessage = { ...chat.messages[index], content: text, status: "complete" };
      history = [...chat.messages.slice(0, index), userMessage];
    } else {
      userMessage = createMessage("user", text);
      history = [...chat.messages, userMessage];
    }

    const assistantMessage = createMessage("assistant", "", "streaming");
    updateChat(chat.id, () => ({
      title: chat.title === "New conversation" ? titleFromMessage(text) : chat.title,
      messages: [...history, assistantMessage],
    }));
    setInput("");
    setEditingMessageId(null);
    requestAnimationFrame(() => inputRef.current?.focus());
    void generateFrom(
      chat.id,
      history
        .filter((item) => item.status !== "error")
        .map((item) => ({
          role: item.role === "ai" ? "assistant" : item.role,
          content: item.content ?? item.text ?? "",
        })),
      assistantMessage.id
    );
  };

  const retryMessage = (chatId, userIndex) => {
    if (generatingChatId) return;
    const chat = chatSessions.find((item) => item.id === chatId);
    if (!chat || userIndex < 0) return;
    const history = chat.messages.slice(0, userIndex + 1);
    const assistantMessage = createMessage("assistant", "", "streaming");
    updateChat(chatId, () => ({ messages: [...history, assistantMessage] }));
    void generateFrom(
      chatId,
      history.map((item) => ({
        role: item.role === "ai" ? "assistant" : item.role,
        content: item.content ?? item.text ?? "",
      })),
      assistantMessage.id
    );
  };

  const stopGeneration = () => requestRef.current?.controller.abort();

  const deleteConversation = (chatId) => {
    const remaining = chatSessions.filter((chat) => chat.id !== chatId);
    const next = remaining[0] || createConversation(selectedProjectId);
    setChatSessions(remaining.length ? remaining : [next]);
    if (activeChatId === chatId) setActiveChatId(next.id);
    setOpenMenuId(null);
    setDialog(null);
  };

  const copyText = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => current === id ? null : current), 1400);
    } catch (error) {
      console.error("Could not copy text to the clipboard.", error);
    }
  };

  const chatContent = (messages, chatId) => (
    <div className="conversation">
      {messages.map((message, index) => (
        <article className={`message message--${message.role}`} key={message.id || `${index}-${(message.content ?? message.text ?? "").slice(0, 12)}`}>
          {message.role === "assistant" || message.role === "ai" ? (
            <div className="assistant-avatar" aria-label="CJ assistant">
              <Icon name="spark" size={17} />
            </div>
          ) : (
            <div className="user-avatar" aria-hidden="true">Y</div>
          )}
          <div className="message-content">
            <div className="message-author">{message.role === "assistant" || message.role === "ai" ? "CJ" : "You"}</div>
            {message.role === "assistant" || message.role === "ai" ? (
              message.status === "streaming" && !(message.content ?? message.text) ? (
                <div className="typing-indicator" aria-label="CJ is thinking">
                  <span /><span /><span />
                </div>
              ) : (
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const code = String(children).replace(/\n$/, "");
                    return match ? (
                      <div className="code-block">
                        <div className="code-block-header">
                          <span>{match[1]}</span>
                          <button className="text-button" onClick={() => copyText(code, `code-${message.id}-${index}`)} type="button">
                            {copiedId === `code-${message.id}-${index}` ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <SyntaxHighlighter style={oneDark} language={match[1]}>{code}</SyntaxHighlighter>
                      </div>
                    ) : (
                      <code {...props}>{children}</code>
                    );
                  },
                }}
              >
                {message.content ?? message.text ?? ""}
              </ReactMarkdown>
              )
            ) : (
              <p>{message.content ?? message.text ?? ""}</p>
            )}
            {message.status === "error" && (
              <div className="message-error">
                <span>Unable to generate a response. {message.error}</span>
                <button className="message-action" onClick={() => retryMessage(chatId, Math.max(0, index - 1))} type="button">Retry</button>
              </div>
            )}
            {message.status === "stopped" && <div className="message-status">Generation stopped</div>}
            {(message.role === "assistant" || message.role === "ai") && message.content && message.status !== "streaming" && (
              <div className="message-actions">
                <button className="message-action" onClick={() => copyText(message.content, message.id)} type="button">
                  {copiedId === message.id ? "✓ Copied" : "Copy"}
                </button>
                <button
                  className="message-action"
                  onClick={() => retryMessage(chatId, messages.slice(0, index).findLastIndex((item) => item.role === "user"))}
                  type="button"
                >
                  Regenerate
                </button>
              </div>
            )}
            {message.role === "user" && (
              <div className="message-actions">
                <button
                  className="message-action"
                  onClick={() => {
                    setInput(message.content ?? message.text ?? "");
                    setEditingMessageId(message.id);
                    inputRef.current?.focus();
                  }}
                  type="button"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        </article>
      ))}
      <div ref={messageEndRef} />
    </div>
  );

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`sidebar${sidebarOpen ? " sidebar--open" : ""}`}>
        <a className="brand" href="/" aria-label="CJ home">
          <span className="brand-mark"><Icon name="spark" size={20} /></span>
          <span className="brand-name">cj<span className="brand-dot">.</span></span>
        </a>

        <button className="new-chat-button" onClick={createNewChat}>
          <Icon name="add" size={17} />
          <span>New conversation</span>
        </button>

        <label className="conversation-search">
          <Icon name="search" size={16} />
          <input aria-label="Search conversations" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" />
          <kbd>/</kbd>
        </label>

        <div className="sidebar-section">
          <div className="section-heading">
            <span>WORKSPACE</span>
          </div>
          <button className="sidebar-link" onClick={() => openDialog("project")}>
            <Icon name="folder" size={17} />
            <span>Projects</span>
            <span className="link-count">{projects.length || ""}</span>
            <Icon name="add" size={15} className="link-add" />
          </button>
          {projects.length > 0 && (
            <div className="project-list">
              <button
                className={`project-item${selectedProjectId === null ? " project-item--active" : ""}`}
                onClick={() => selectProject(null)}
              >
                <span className="project-dot project-dot--all" />
                <span className="truncate">All conversations</span>
              </button>
              {projects.map((project) => (
                <button
                  className={`project-item${selectedProjectId === project.id ? " project-item--active" : ""}`}
                  key={project.id}
                  onClick={() => selectProject(project.id)}
                >
                  <span className="project-dot" />
                  <span className="truncate">{project.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-section recent-section">
          <div className="section-heading">
            <span>RECENT</span>
            <button className="icon-button small-icon-button" aria-label="Rename conversation" title="Rename conversation" onClick={() => openDialog("rename")}>
              <Icon name="edit" size={14} />
            </button>
          </div>
          <nav className="chat-list" aria-label="Recent conversations">
            {chatSessions
              .filter((chat) => !selectedProjectId || chat.projectId === selectedProjectId)
              .filter((chat) => {
                const query = search.trim().toLowerCase();
                return !query || chat.title.toLowerCase().includes(query) ||
                  chat.messages.some((message) => (message.content ?? message.text ?? "").toLowerCase().includes(query));
              })
              .map((chat) => (
                <div className="chat-entry" key={chat.id}>
                  <button
                    className={`chat-list-item${chat.id === activeChatId ? " chat-list-item--active" : ""}`}
                    onClick={() => {
                      setActiveChatId(chat.id);
                      atBottomRef.current = true;
                      setShowLatestButton(false);
                      setSidebarOpen(false);
                    }}
                  >
                    <Icon name="message" size={16} />
                    <span className="truncate">{chat.title}</span>
                  </button>
                  <button
                    className="chat-entry-menu-button"
                    aria-label={`Options for ${chat.title}`}
                    onClick={() => setOpenMenuId(openMenuId === chat.id ? null : chat.id)}
                  >
                    <Icon name="more" size={16} />
                  </button>
                  {openMenuId === chat.id && (
                    <div className="chat-entry-menu">
                      <button onClick={() => { setActiveChatId(chat.id); setDialog({ kind: "rename", value: chat.title, chatId: chat.id }); setOpenMenuId(null); }}>Rename</button>
                      <label>
                        Move to project
                        <select
                          value={chat.projectId || ""}
                          onChange={(event) => {
                            updateChat(chat.id, () => ({ projectId: event.target.value || null }));
                            setOpenMenuId(null);
                          }}
                        >
                          <option value="">No project</option>
                          {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
                        </select>
                      </label>
                      <button className="danger-action" onClick={() => { setDialog({ kind: "delete", chatId: chat.id, title: chat.title }); setOpenMenuId(null); }}>Delete</button>
                    </div>
                  )}
                </div>
              ))}
            {!chatSessions.some((chat) =>
              (!selectedProjectId || chat.projectId === selectedProjectId) &&
              (!search.trim() || chat.title.toLowerCase().includes(search.trim().toLowerCase()) ||
                chat.messages.some((message) => (message.content ?? message.text ?? "").toLowerCase().includes(search.trim().toLowerCase())))
            ) && <p className="empty-search">{search ? "No matching conversations" : "No conversations in this project"}</p>}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className={`connection-indicator connection-indicator--${backendStatus}`}>
            <span />
            {backendStatus === "connected"
              ? "Backend connected"
              : backendStatus === "checking"
                ? "Checking backend…"
                : "Backend offline"}
          </div>
          <div className="profile-row">
            <div className="profile-avatar">C</div>
            <div className="profile-details"><strong>CJ workspace</strong><span>Personal</span></div>
            <button className="icon-button" aria-label="Workspace options"><Icon name="more" /></button>
          </div>
        </div>
      </aside>

      <main className="main-panel" onClick={() => openMenuId && setOpenMenuId(null)}>
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
            <span className="menu-lines" />
          </button>
          <div className="breadcrumb"><span>{projects.find((project) => project.id === selectedProjectId)?.name || "Workspace"}</span><Icon name="chevron" size={14} /><strong>{activeChat.title}</strong></div>
          <div className="topbar-actions">
            <span className={`model-label model-label--${backendStatus}`}>
              <span className="model-status" /> Phi 3
            </span>
            <button className="icon-button" aria-label="Rename conversation" title="Rename conversation" onClick={() => openDialog("rename")}>
              <Icon name="edit" size={17} />
            </button>
          </div>
        </header>

        <section className={`chat-panel${isEmptyChat ? " chat-panel--empty" : ""}`} aria-label="Conversation">
          {isEmptyChat ? (
            <div className="empty-state">
              <div className="hero-orbit" aria-hidden="true">
                <span className="hero-orbit-ring hero-orbit-ring--outer" />
                <span className="hero-orbit-ring hero-orbit-ring--inner" />
                <span className="hero-orbit-core"><Icon name="spark" size={22} /></span>
              </div>
              <div className="welcome-kicker"><span /> YOUR AI WORKSPACE</div>
              <h1>How can I help<br />you today?</h1>
              <p className="welcome-copy">A thought partner for your next big idea, tricky question,<br className="desktop-break" /> or whatever’s on your mind.</p>
              <div className="suggestion-grid">
                {suggestions.map((suggestion, index) => (
                  <button
                    className="suggestion-card"
                    key={suggestion.title}
                    onClick={() => sendMessage(suggestion.prompt)}
                  >
                    <span className={`suggestion-icon suggestion-icon--${index}`}>
                      <Icon name={index === 1 ? "edit" : index === 2 ? "arrow" : index === 3 ? "spark" : "message"} size={17} />
                    </span>
                    <span className="suggestion-copy">
                      <span className="suggestion-title">{suggestion.title}</span>
                      <span className="suggestion-detail">{suggestion.detail}</span>
                    </span>
                    <Icon name="arrow" size={15} className="suggestion-arrow" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="messages-scroll"
              ref={scrollRef}
              onScroll={(event) => {
                const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
                atBottomRef.current = scrollHeight - scrollTop - clientHeight < 90;
                setShowLatestButton(!atBottomRef.current);
              }}
            >
              {chatContent(activeChat.messages, activeChat.id)}
              {showLatestButton && (
                <button
                  className="latest-message-button"
                  onClick={() => {
                    atBottomRef.current = true;
                    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
                    setShowLatestButton(false);
                  }}
                >
                  ↓ New response
                </button>
              )}
            </div>
          )}
        </section>

        <div className="composer-area">
          {storageError && <p className="storage-warning">Unable to save locally. Check browser storage.</p>}
          {editingMessageId && (
            <div className="edit-banner">
              Editing message
              <button className="message-action" onClick={() => { setEditingMessageId(null); setInput(""); }} type="button">Cancel</button>
            </div>
          )}
          <form
            ref={composerRef}
            className="composer"
            onAnimationEnd={(event) => {
              if (event.animationName === "border-sweep") setSweepActive(false);
            }}
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            {sweepActive && composerSize.width > 0 && composerSize.height > 0 && (() => {
              const width = composerSize.width + 2;
              const height = composerSize.height + 2;
              const inset = 1.5;
              const radius = Math.min(10, (height - inset * 2) / 2);
              const left = inset;
              const top = inset;
              const right = width - inset;
              const bottom = height - inset;
              const straightWidth = right - left - radius * 2;
              const straightHeight = bottom - top - radius * 2;
              const perimeter =
                2 * straightWidth + 2 * straightHeight + 2 * Math.PI * radius;
              const segment = Math.min(54, perimeter * 0.12);
              const path = [
                `M ${left + radius} ${top}`,
                `H ${right - radius}`,
                `A ${radius} ${radius} 0 0 1 ${right} ${top + radius}`,
                `V ${bottom - radius}`,
                `A ${radius} ${radius} 0 0 1 ${right - radius} ${bottom}`,
                `H ${left + radius}`,
                `A ${radius} ${radius} 0 0 1 ${left} ${bottom - radius}`,
                `V ${top + radius}`,
                `A ${radius} ${radius} 0 0 1 ${left + radius} ${top}`,
                "Z",
              ].join(" ");

              return (
                <svg
                  key={sweepRun}
                  className="composer-sweep"
                  width={width}
                  height={height}
                  viewBox={`0 0 ${width} ${height}`}
                  aria-hidden="true"
                  focusable="false"
                  style={{
                    "--sweep-offset": `${-perimeter}px`,
                    "--sweep-duration": "4.5s",
                  }}
                >
                  <path
                    d={path}
                    fill="none"
                    stroke="#67e8f9"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeDasharray={`${segment} ${perimeter - segment}`}
                    className="composer-sweep-path"
                  />
                </svg>
              );
            })()}
            <textarea
              ref={inputRef}
              aria-label="Message CJ"
              value={input}
              onFocus={(event) => {
                startBorderSweep();
                event.currentTarget.style.height = "auto";
                event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 180)}px`;
              }}
              onChange={(event) => {
                setInput(event.target.value);
                event.currentTarget.style.height = "auto";
                event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 180)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Message CJ…"
              disabled={loading}
              rows={1}
            />
            <div className="composer-controls">
              <span className="composer-hint">Thoughtful answers, powered locally</span>
              {generatingChatId ? (
                <button className="send-button stop-button" type="button" aria-label="Stop generation" onClick={stopGeneration}>
                  <span />
                </button>
              ) : (
                <button className="send-button" type="submit" aria-label="Send message" disabled={!input.trim()}>
                  <Icon name="send" size={17} />
                </button>
              )}
            </div>
          </form>
          <p className="composer-disclaimer">CJ can make mistakes. Check important information.</p>
        </div>
      </main>

      {dialog && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDialog(null)}>
          <form className="dialog-card" onSubmit={saveDialog} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
            <div className="dialog-topline">
              <div className="dialog-icon"><Icon name={dialog.kind === "project" ? "folder" : "edit"} size={18} /></div>
              <button className="icon-button" type="button" aria-label="Close dialog" onClick={() => setDialog(null)}><Icon name="close" /></button>
            </div>
            <h2 id="dialog-title">
              {dialog.kind === "project" ? "Create a project" : dialog.kind === "delete" ? "Delete conversation?" : "Rename conversation"}
            </h2>
            <p>
              {dialog.kind === "project"
                ? "Give your work a place of its own."
                : dialog.kind === "delete"
                  ? `“${dialog.title}” and its messages will be removed from this browser.`
                  : "Choose a name that’s easy to find later."}
            </p>
            {dialog.kind !== "delete" && (
              <>
                <label className="dialog-label" htmlFor="dialog-value">{dialog.kind === "project" ? "Project name" : "Conversation name"}</label>
                <input
                  id="dialog-value"
                  className="dialog-input"
                  autoFocus
                  maxLength={60}
                  value={dialog.value}
                  onChange={(event) => setDialog((current) => ({ ...current, value: event.target.value }))}
                />
              </>
            )}
            <div className="dialog-actions">
              <button className="dialog-cancel" type="button" onClick={() => setDialog(null)}>Cancel</button>
              <button className={`dialog-submit${dialog.kind === "delete" ? " dialog-submit--danger" : ""}`} type="submit" disabled={dialog.kind !== "delete" && !dialog.value.trim()}>
                {dialog.kind === "project" ? "Create project" : dialog.kind === "delete" ? "Delete conversation" : "Save name"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
