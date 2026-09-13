import { useState, useCallback, useEffect, useRef } from "react";
import type { ChatMessage, SourceRef } from "@bit-n-build-2026/contracts";
import { streamChat } from "@/lib/chat-client";
import { ENV } from "@/env";

export type UIStateMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  usedPortfolio?: boolean;
  sources?: SourceRef[];
  status: "sending" | "streaming" | "done" | "failed";
  createdAt: string;
};

/** Persisted messages only store ids; turn them back into renderable sources. */
async function hydrateSources(messages: ChatMessage[]): Promise<Map<string, SourceRef>> {
  const ids = [...new Set(messages.flatMap((m) => m.sourceIds ?? []))];
  if (!ids.length) return new Map();

  try {
    const res = await fetch(
      `${ENV.NEXT_PUBLIC_SERVER_URL}/api/sources?ids=${encodeURIComponent(ids.join(","))}`,
      { credentials: "include" },
    );
    if (!res.ok) return new Map();
    const refs = (await res.json()) as SourceRef[];
    return new Map(refs.map((r) => [r.id, r]));
  } catch {
    return new Map();
  }
}

export function useChat(initialThreadId?: string) {
  const [messages, setMessages] = useState<UIStateMessage[]>([]);
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId);
  const [status, setStatus] = useState<"idle" | "streaming" | "failed">("idle");
  const [prevInitial, setPrevInitial] = useState(initialThreadId);

  /**
   * Threads created by this component in this session.
   *
   * The page mirrors threadId into the URL, which comes back as
   * initialThreadId. Without this the hydration effect below would fire the
   * moment the server assigned an id — mid-stream — and overwrite the
   * in-flight assistant message with server state that does not contain it
   * yet. That is why the first message in a new thread showed no typing
   * indicator and never appeared until a reload.
   */
  const ownThreads = useRef(new Set<string>());
  /** True while a stream is running; hydration must never run underneath it. */
  const streaming = useRef(false);

  if (initialThreadId !== prevInitial) {
    setPrevInitial(initialThreadId);
    setThreadId(initialThreadId);
    // Only clear when genuinely starting a new conversation.
    if (!initialThreadId && !streaming.current) {
      setMessages([]);
    }
  }

  useEffect(() => {
    if (!initialThreadId) return;
    // Our own thread, or a stream in progress: local state is the truth.
    if (ownThreads.current.has(initialThreadId) || streaming.current) return;

    let cancelled = false;

    async function fetchThread(id: string) {
      try {
        const res = await fetch(`${ENV.NEXT_PUBLIC_SERVER_URL}/api/chat/${id}`, {
          credentials: "include",
        });
        if (!res.ok) return;

        const data = (await res.json()) as ChatMessage[];
        const sourceMap = await hydrateSources(data);
        if (cancelled || streaming.current) return;

        setMessages(
          data.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
            status: "done" as const,
            sources: (m.sourceIds ?? [])
              .map((sid) => sourceMap.get(sid))
              .filter((s): s is SourceRef => Boolean(s)),
          })),
        );
      } catch (err) {
        console.error("Failed to load thread", err);
      }
    }

    void fetchThread(initialThreadId);
    return () => {
      cancelled = true;
    };
  }, [initialThreadId]);

  const sendMessage = useCallback(
    async (content: string) => {
      const stamp = Date.now();
      const userMsgId = `local_user_${stamp}`;
      // Stable for the whole stream — updates target this id rather than
      // "whichever message happens to be streaming", which broke as soon as
      // the list was replaced underneath us.
      const assistantMsgId = `local_assistant_${stamp}`;

      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          role: "user",
          content,
          status: "done",
          createdAt: new Date().toISOString(),
        },
        {
          id: assistantMsgId,
          role: "assistant",
          content: "",
          status: "streaming",
          createdAt: new Date().toISOString(),
        },
      ]);

      streaming.current = true;
      setStatus("streaming");

      const patch = (fn: (m: UIStateMessage) => UIStateMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? fn(m) : m)));

      try {
        for await (const event of streamChat(content, threadId)) {
          if (event.type === "chat.started") {
            ownThreads.current.add(event.threadId);
            setThreadId(event.threadId);
          } else if (event.type === "chat.context") {
            patch((m) => ({ ...m, usedPortfolio: event.usedPortfolio, sources: event.sources }));
          } else if (event.type === "chat.delta") {
            patch((m) => ({ ...m, content: m.content + event.text }));
          } else if (event.type === "chat.sources") {
            patch((m) => ({ ...m, sources: event.sources }));
          } else if (event.type === "chat.completed") {
            patch((m) => ({ ...m, content: event.content, status: "done" }));
            setStatus("idle");
          } else if (event.type === "chat.failed") {
            patch((m) => ({
              ...m,
              content: `${m.content}\n\nError: ${event.message}`,
              status: "failed",
            }));
            setStatus("failed");
          }
        }
      } catch (err) {
        console.error(err);
        setStatus("failed");
        patch((m) => ({ ...m, status: "failed" }));
      } finally {
        streaming.current = false;
      }
    },
    [threadId],
  );

  return { messages, threadId, status, sendMessage };
}
