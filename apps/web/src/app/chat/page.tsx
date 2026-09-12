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
import { Send, User, Bot, Link as LinkIcon, Briefcase, Plus, MessageSquare, BookOpen, ChevronDown } from "lucide-react";
import { SourceCard } from "@/components/thesis/source-card";
import { SpiderTingle } from "@/components/chat/spider-tingle";
import type { SourceRef, ChatThread } from "@bit-n-build-2026/contracts";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@bit-n-build-2026/ui/lib/utils";

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
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full pt-2 sm:pt-4 relative min-h-0 overflow-hidden">
      <SpiderTingle isActive={status === "streaming"} />
      
      <div className="flex-1 min-h-0 relative">
        <MessageScrollerProvider>
          <MessageScroller>
            <MessageScrollerViewport className="px-4 pb-6 scrollbar-thin">
              <MessageScrollerContent className="gap-6">
                {messages.length === 0 && status === "idle" && (
                  <div className="h-full min-h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                    Ask a general question or ask about your portfolio...
                  </div>
                )}
                {messages.map((m) => (
                  <MessageScrollerItem key={m.id}>
                    <MessageGroup>
                      <Message align={m.role === "user" ? "end" : "start"} className="gap-3">
                        <MessageAvatar className="self-start mt-0.5 size-8 shrink-0 rounded-full border border-border/50 bg-muted/70 text-muted-foreground shadow-2xs">
                          {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        </MessageAvatar>
                        
                        <MessageContent className="gap-2">
                          {m.role === "assistant" && m.usedPortfolio && (
                            <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium mb-0.5 bg-blue-50 dark:bg-blue-900/20 w-fit px-3 py-1 rounded-full border border-blue-500/20">
                              <Briefcase className="h-3 w-3" />
                              Used your portfolio context
                            </div>
                          )}

                          <Bubble 
                            variant={m.role === "user" ? "default" : "secondary"}
                            className={cn(
                              "transition-all duration-200",
                              m.role === "user" ? "rounded-2xl rounded-tr-xs" : "rounded-2xl rounded-tl-xs"
                            )}
                          >
                            <BubbleContent 
                              className={cn(
                                "w-fit max-w-full min-w-0 border border-transparent leading-relaxed text-sm wrap-break-word shadow-xs",
                                m.role === "user" 
                                  ? "rounded-2xl rounded-tr-xs px-4.5 py-3 text-primary-foreground" 
                                  : "rounded-2xl rounded-tl-xs px-5 py-4 bg-secondary/80 border-border/40 text-foreground"
                              )}
                            >
                              {m.role === "user" ? (
                                <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                              ) : (
                                <ParsedMessage
                                  content={m.content}
                                  sources={m.sources}
                                  isStreaming={m.status === "streaming"}
                                />
                              )}
                            </BubbleContent>
                          </Bubble>

                          {m.status === "failed" && (
                            <div className="text-destructive text-xs px-1">Error generating response</div>
                          )}

                          {/* Collapsible Resources / Sources Dropdown */}
                          {m.sources && m.sources.length > 0 && (
                            <SourcesDropdown sources={m.sources} />
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

      {/* Input Section with rounded corners and clean spacing */}
      <div className="p-3 sm:p-4 bg-background/80 backdrop-blur-md border-t border-border/50">
        <form onSubmit={handleSubmit} className="flex items-center gap-2.5 max-w-4xl mx-auto w-full">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={status === "streaming"}
            className="flex-1 h-11 px-4 text-sm rounded-2xl bg-card border-border/70 shadow-2xs transition-colors focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button 
            type="submit" 
            disabled={!input.trim() || status === "streaming"} 
            size="icon"
            className="h-11 w-11 rounded-2xl shrink-0 cursor-pointer shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

/**
 * Drop-down menu for resources/sources that takes up minimal space when collapsed.
 */
function SourcesDropdown({ sources }: { sources: SourceRef[] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-1 w-full max-w-xl">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border border-border/70 bg-card/60 hover:bg-card text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
        aria-expanded={isOpen}
      >
        <BookOpen className="w-3.5 h-3.5 text-primary" />
        <span>Sources ({sources.length})</span>
        <ChevronDown 
          className={cn(
            "w-3.5 h-3.5 transition-transform duration-200 text-muted-foreground", 
            isOpen && "rotate-180"
          )} 
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden mt-2.5 w-full"
          >
            <div className="p-3.5 rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xs space-y-2 max-h-72 overflow-y-auto scrollbar-thin shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {sources.map((src) => (
                  <SourceCard key={src.id} source={src} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Renders assistant messages with balanced, even paragraph spacing and inline source markers.
 */
function ParsedMessage({
  content,
  sources,
  isStreaming,
}: {
  content: string;
  sources?: SourceRef[];
  isStreaming?: boolean;
}) {
  if (!content) {
    if (isStreaming) {
      return (
        <span className="inline-flex items-center gap-1.5 py-1 px-1 text-muted-foreground" aria-label="Thinking...">
          <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-current animate-bounce" />
        </span>
      );
    }
    return <span className="text-sm leading-relaxed text-muted-foreground">...</span>;
  }

  // Split content by double linebreaks for even, uniform paragraph spacing
  const paragraphs = content.split(/\n\n+/);

  return (
    <div className="space-y-3.5 text-sm sm:text-[14.5px] leading-relaxed text-foreground/90">
      {paragraphs.map((paragraph, pIdx) => (
        <p key={pIdx} className="leading-relaxed">
          {renderParagraphWithCitations(paragraph, sources)}
        </p>
      ))}
    </div>
  );
}

function renderParagraphWithCitations(text: string, sources?: SourceRef[]) {
  if (!sources || sources.length === 0 || !text) {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }

  const regex = /\[([^\]]+)\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const sourceId = match[1];
    const source = sources.find((s) => s.id === sourceId);

    if (source) {
      parts.push(
        <span key={`src-${match.index}`} className="inline-block mx-1 align-baseline translate-y-0.5">
          <Marker className="rounded-md">
            <MarkerIcon>
              <LinkIcon className="h-3 w-3 text-primary" />
            </MarkerIcon>
            <MarkerContent className="rounded-md">
              {source.url ? (
                <a 
                  href={source.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:underline text-xs"
                >
                  {source.publisher}
                </a>
              ) : (
                <span className="text-xs">{source.publisher}</span>
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

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <>{parts}</>;
}
