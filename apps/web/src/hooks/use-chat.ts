import { useState, useCallback, useEffect } from "react";
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

export function useChat(initialThreadId?: string) {
  const [messages, setMessages] = useState<UIStateMessage[]>([]);
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId);
  const [status, setStatus] = useState<"idle" | "streaming" | "failed">("idle");

  useEffect(() => {
    if (!initialThreadId) return;
    
    async function fetchThread() {
      try {
        const res = await fetch(`${ENV.NEXT_PUBLIC_SERVER_URL}/api/chat/${initialThreadId}`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = (await res.json()) as ChatMessage[];
          setMessages(
            data.map((m) => ({
              ...m,
              status: "done",
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load thread", err);
      }
    }
    
    fetchThread();
  }, [initialThreadId]);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMsgId = crypto.randomUUID();
      const userMsg: UIStateMessage = {
        id: userMsgId,
        role: "user",
        content,
        status: "done",
        createdAt: new Date().toISOString(),
      };

      const assistantMsgId = crypto.randomUUID();
      const assistantMsg: UIStateMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        status: "streaming",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStatus("streaming");

      try {
        const stream = streamChat(content, threadId);
        
        for await (const event of stream) {
          if (event.type === "chat.started") {
            setThreadId(event.threadId);
            setMessages((prev) => 
              prev.map((m) => m.id === assistantMsgId ? { ...m, id: event.messageId } : m)
            );
          } else if (event.type === "chat.context") {
            setMessages((prev) =>
              prev.map((m) =>
                m.status === "streaming"
                  ? { ...m, usedPortfolio: event.usedPortfolio, sources: event.sources }
                  : m
              )
            );
          } else if (event.type === "chat.delta") {
            setMessages((prev) =>
              prev.map((m) =>
                m.status === "streaming" ? { ...m, content: m.content + event.text } : m
              )
            );
          } else if (event.type === "chat.sources") {
            setMessages((prev) =>
              prev.map((m) =>
                m.status === "streaming" ? { ...m, sources: event.sources } : m
              )
            );
          } else if (event.type === "chat.completed") {
            setMessages((prev) =>
              prev.map((m) =>
                m.status === "streaming" ? { ...m, content: event.content, status: "done" } : m
              )
            );
            setStatus("idle");
          } else if (event.type === "chat.failed") {
            setMessages((prev) =>
              prev.map((m) =>
                m.status === "streaming" ? { ...m, content: m.content + "\n\nError: " + event.message, status: "failed" } : m
              )
            );
            setStatus("failed");
          }
        }
      } catch (err) {
        console.error(err);
        setStatus("failed");
        setMessages((prev) =>
          prev.map((m) =>
            m.status === "streaming" ? { ...m, status: "failed" } : m
          )
        );
      }
    },
    [threadId]
  );

  return {
    messages,
    threadId,
    status,
    sendMessage,
  };
}
