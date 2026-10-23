const API_URL = "http://127.0.0.1:8000";

export async function streamChat(messages, { signal, onToken }) {
  const response = await fetch(`${API_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `The backend returned an error (${response.status}).`);
  }
  if (!response.body) throw new Error("The backend did not provide a response stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = "";

  const consumeLine = (line) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.error) throw new Error(event.error);
    if (typeof event.token === "string") {
      result += event.token;
      onToken(event.token);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(consumeLine);
      if (done) break;
    }
    if (buffer.trim()) consumeLine(buffer);
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }

  if (!result.trim()) throw new Error("The assistant returned an empty response.");
  return result;
}
