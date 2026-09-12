"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useChat } from "@/hooks/use-chat";
import { 
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerViewport,
  MessageScrollerItem,
  MessageScrollerButton,
  MessageScrollerProvider 
} from "@bit-n-build-2026/ui/components/message-scroller";
import { 
  Message,
  MessageGroup,
  MessageContent,
  MessageAvatar
} from "@bit-n-build-2026/ui/components/message";
import { Bubble, BubbleContent } from "@bit-n-build-2026/ui/components/bubble";
import { Marker, MarkerContent, MarkerIcon } from "@bit-n-build-2026/ui/components/marker";
import { Input } from "@bit-n-build-2026/ui/components/input";
import { Button } from "@bit-n-build-2026/ui/components/button";
import { Send, User, Bot, Link as LinkIcon, Briefcase, Plus, MessageSquare } from "lucide-react";
import { SourceCard } from "@/components/thesis/source-card";
import type { SourceRef, ChatThread } from "@bit-n-build-2026/contracts";

export default function ChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const threadIdParam = searchParams.get("threadId");

  const { messages, status, sendMessage, threadId } = useChat(threadIdParam || undefined);
  const [input, setInput] = useState("");
  const [threads, setThreads] = useState<ChatThread[]>([]);

  // Fetch threads on mount and on new thread creation
  useEffect(() => {
    async function fetchThreads() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/chat`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setThreads(data);
          
          // Auto-open most recent if no thread is specified
          if (!threadIdParam && data.length > 0) {
            router.replace(`/chat?threadId=${data[0].threadId}`);
          }
        }
      } catch (err) {
        console.error("Failed to fetch threads", err);
      }
    }
    fetchThreads();
  }, [threadIdParam, router, threadId]); // Refetch if threadId changes (e.g. after first message)

  // Sync URL when threadId is created by useChat
  useEffect(() => {
    if (threadId && threadId !== threadIdParam) {
      router.replace(`/chat?threadId=${threadId}`);
    }
  }, [threadId, threadIdParam, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && status !== "streaming") {
      sendMessage(input.trim());
      setInput("");
    }
  };

  return (
    <div className="flex h-[calc(100vh-60px)] w-full max-w-[1400px] mx-auto">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/10 hidden md:flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <span className="font-medium text-sm">Past Conversations</span>
          <Link href="/chat">
            <Button size="icon" variant="ghost" className="h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {threads.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground text-center">
              No conversations yet.
            </div>
          )}
          {threads.map((t) => {
            const isActive = t.threadId === (threadId || threadIdParam);
            return (
              <Link 
                key={t.threadId} 
                href={`/chat?threadId=${t.threadId}`} 
                className={`block p-3 rounded-lg text-sm transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="h-3 w-3 opacity-70 flex-shrink-0" />
                  <div className="truncate font-semibold">{t.title || "New Chat"}</div>
                </div>
                <div className="truncate text-xs text-muted-foreground pl-5">{t.lastMessage}</div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 pt-4 max-w-4xl mx-auto w-full">
        <div className="flex-1 min-h-0 relative">
          <MessageScrollerProvider>
            <MessageScroller>
              <MessageScrollerViewport className="px-4 pb-4">
                <MessageScrollerContent>
                  {messages.length === 0 && status === "idle" && (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      Ask a general question or ask about your portfolio...
                    </div>
                  )}
                  {messages.map((m) => (
                    <MessageScrollerItem key={m.id}>
                      <MessageGroup>
                        <Message align={m.role === "user" ? "end" : "start"}>
                          <MessageAvatar>
                            {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                          </MessageAvatar>
                          <MessageContent>
                            {m.role === "assistant" && m.usedPortfolio && (
                              <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium mb-1 bg-blue-50 dark:bg-blue-900/20 w-fit px-2 py-0.5 rounded-md">
                                <Briefcase className="h-3 w-3" />
                                Used your portfolio context
                              </div>
                            )}
                            <Bubble variant={m.role === "user" ? "default" : "secondary"}>
                              <BubbleContent>
                                {m.role === "user" ? m.content : <ParsedMessage content={m.content} sources={m.sources} />}
                              </BubbleContent>
                            </Bubble>
                            {m.status === "failed" && (
                              <div className="text-destructive text-xs">Error generating response</div>
                            )}
                            {m.sources && m.sources.length > 0 && (
                              <div className="flex flex-col gap-2 mt-2 max-w-[80%]">
                                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Sources</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {m.sources.map(src => (
                                    <SourceCard key={src.id} source={src} />
                                  ))}
                                </div>
                              </div>
                            )}
                          </MessageContent>
                        </Message>
                      </MessageGroup>
                    </MessageScrollerItem>
                  ))}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
        </div>

        <div className="p-4 bg-background border-t">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={status === "streaming"}
              className="flex-1"
            />
            <Button type="submit" disabled={!input.trim() || status === "streaming"} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ParsedMessage({ content, sources }: { content: string, sources?: SourceRef[] }) {
  if (!sources || sources.length === 0 || !content) {
    return <span className="whitespace-pre-wrap">{content || "..."}</span>;
  }

  const regex = /\[([^\]]+)\]/g;
  const parts = [];
  let lastIndex = 0;
  
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }
    const sourceId = match[1];
    const source = sources.find(s => s.id === sourceId);
    
    if (source) {
      parts.push(
        <span key={`src-${match.index}`} className="inline-block mx-1 align-baseline translate-y-0.5">
          <Marker>
            <MarkerIcon><LinkIcon className="h-3 w-3" /></MarkerIcon>
            <MarkerContent>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noopener noreferrer">{source.publisher}</a>
              ) : (
                source.publisher
              )}
            </MarkerContent>
          </Marker>
        </span>
      );
    } else {
      parts.push(match[0]);
    }
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }
  
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) => <React.Fragment key={i}>{part}</React.Fragment>)}
    </span>
  );
}
