const STORAGE_KEY = "cj-ai.workspace.v1";

function normalizeMessage(message) {
  return {
    id: message.id || crypto.randomUUID(),
    role: message.role === "ai" ? "assistant" : message.role || "assistant",
    content: message.content ?? message.text ?? "",
    attachments: Array.isArray(message.attachments) ? message.attachments : [],
    images: Array.isArray(message.images) ? message.images : [],
    timestamp: message.timestamp || new Date().toISOString(),
    status: message.status || "complete",
  };
}

function normalizeConversation(chat) {
  return {
    id: chat.id || crypto.randomUUID(),
    title: chat.title || "New conversation",
    projectId: chat.projectId ?? null,
    messages: Array.isArray(chat.messages) ? chat.messages.map(normalizeMessage) : [],
    createdAt: chat.createdAt || new Date().toISOString(),
    updatedAt: chat.updatedAt || chat.createdAt || new Date().toISOString(),
  };
}

export function loadWorkspace() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && Array.isArray(saved.conversations)) {
      const conversations = saved.conversations.map(normalizeConversation);
      return {
        conversations: conversations.length ? conversations : [normalizeConversation({})],
        projects: Array.isArray(saved.projects) ? saved.projects : [],
        activeId: saved.activeId || conversations[0]?.id,
        selectedProjectId: saved.selectedProjectId ?? null,
      };
    }
  } catch (error) {
    console.error("Could not load saved CJ workspace.", error);
  }

  const conversation = normalizeConversation({});
  return {
    conversations: [conversation],
    projects: [],
    activeId: conversation.id,
    selectedProjectId: null,
  };
}

export function saveWorkspace(workspace) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}

export function createConversation(projectId = null) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "New conversation",
    projectId,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createMessage(role, content, status = "complete") {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    attachments: [],
    images: [],
    timestamp: new Date().toISOString(),
    status,
  };
}

export function titleFromMessage(text) {
  const title = text
    .replace(/```[\s\S]*?```/g, " code ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) return "New conversation";
  return title.length > 42 ? `${title.slice(0, 39).trimEnd()}…` : title;
}
