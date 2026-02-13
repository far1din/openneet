import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { useOpenClaw } from "@/hooks/use-open-claw";
import { Bot } from "lucide-react";
import ChatInput from "./chat-input";
import { ChatBubble, ThinkingIndicator, type Message } from "./chat-bubble";

interface ChatWindowProps {
    sessionKey: string | null;
}

// ---------------------------------------------------------------------------
// Content extraction -- separates thinking from visible text
// ---------------------------------------------------------------------------

function extractContent(content: unknown): { text: string; thinking?: string } {
    if (typeof content === "string") return { text: content };

    if (Array.isArray(content)) {
        const textParts: string[] = [];
        const thinkParts: string[] = [];

        for (const block of content) {
            if (block.type === "text" && block.text) {
                textParts.push(block.text);
            } else if (block.type === "thinking" && block.thinking) {
                thinkParts.push(block.thinking);
            } else if (block.type === "toolCall" && block.name) {
                textParts.push(`[tool call: ${block.name}]`);
            } else if (block.type === "toolResult") {
                const text = block.content
                    ?.map((c: any) => c.text)
                    .filter(Boolean)
                    .join("\n");
                textParts.push(text ? `[tool result: ${text}]` : "[tool result]");
            }
        }

        return {
            text: textParts.filter(Boolean).join("\n"),
            thinking: thinkParts.length > 0 ? thinkParts.join("\n") : undefined,
        };
    }

    return { text: String(content ?? "") };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_ROLES: Message["role"][] = ["user", "assistant", "system", "tool"];

function parseRole(r: unknown): Message["role"] {
    return typeof r === "string" && VALID_ROLES.includes(r as Message["role"])
        ? (r as Message["role"])
        : "assistant";
}

function parseRawMessage(raw: Record<string, unknown>): Message | null {
    const { text, thinking } = extractContent(raw.content);
    if (!text && !thinking) return null;

    return {
        role: parseRole(raw.role),
        content: text,
        thinking,
        id: String(raw.id ?? raw.clientId ?? crypto.randomUUID()),
        timestamp: typeof raw.timestamp === "number" ? raw.timestamp : undefined,
    };
}

/** Upsert a message into the list by id -- update existing or append new */
function upsertMessage(prev: Message[], msg: Message): Message[] {
    const idx = prev.findIndex((m) => m.id === msg.id);
    if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], content: msg.content, thinking: msg.thinking };
        return updated;
    }
    return [...prev, msg];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChatWindow({ sessionKey }: ChatWindowProps) {
    const { call, subscribe } = useOpenClaw();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll on new messages or when processing state changes
    useLayoutEffect(() => {
        const el = scrollContainerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages, isProcessing]);

    // ---- Fetch chat history when session changes ----
    useEffect(() => {
        if (!sessionKey) return;

        const fetchHistory = async () => {
            setLoading(true);
            setIsProcessing(false);
            try {
                const res: unknown = await call("chat.history", { sessionKey, limit: 200 });
                const { messages: rawMessages } = (res ?? {}) as { messages?: unknown[] };

                if (Array.isArray(rawMessages)) {
                    const parsed = rawMessages
                        .map((m) => parseRawMessage(m as Record<string, unknown>))
                        .filter(Boolean) as Message[];
                    setMessages(parsed);
                }
            } catch (err) {
                console.error("Failed to fetch history:", err);
            } finally {
                setLoading(false);
            }
        };

        setMessages([]);
        fetchHistory();
    }, [sessionKey, call]);

    // ---- Subscribe to real-time events ----
    useEffect(() => {
        if (!sessionKey) return;

        return subscribe((msg) => {
            if (msg.type !== "event") return;

            const payload = msg.payload as Record<string, unknown> | null;
            if (!payload) return;
            if (payload.sessionKey !== sessionKey) return;

            if (msg.event === "chat" && payload.message) {
                const parsed = parseRawMessage(payload.message as Record<string, unknown>);
                if (parsed) {
                    // Turn off processing indicator when we get an assistant response
                    if (parsed.role === "assistant") {
                        setIsProcessing(false);
                    }
                    setMessages((prev) => upsertMessage(prev, parsed));
                }
            }
        });
    }, [sessionKey, subscribe]);

    // ---- Send message ----
    const handleSend = async () => {
        if (!inputValue.trim() || !sessionKey) return;

        const userMsg: Message = {
            role: "user",
            content: inputValue,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInputValue("");
        setIsProcessing(true);

        try {
            await call("chat.send", {
                sessionKey,
                message: userMsg.content,
                deliver: false,
                timeoutMs: 120_000,
                idempotencyKey: crypto.randomUUID(),
            });
        } catch (err) {
            console.error("Failed to send message:", err);
        } finally {
            setIsProcessing(false);
        }
    };

    // ---- Render ----

    const agentName = sessionKey?.split(":")[1] ?? null;

    if (!sessionKey) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-muted/10 text-muted-foreground p-8 text-center animate-in fade-in duration-500">
                <div className="bg-background p-4 rounded-full shadow-sm mb-4 border border-border">
                    <Bot size={48} className="text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-medium text-foreground">No Session Selected</h3>
                <p className="max-w-sm mt-2 text-muted-foreground">
                    Click an agent from the sidebar to start a new conversation, or select an
                    existing session.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 h-full min-h-0 bg-background relative">
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto overflow-x-hidden bg-muted/5 p-6 min-h-0 pb-10!"
            >
                <div className="space-y-6 max-w-4xl mx-auto w-full">
                    {loading && (
                        <div className="text-center text-sm text-muted-foreground py-4">
                            Loading history...
                        </div>
                    )}
                    {!loading && messages.length === 0 && !isProcessing && (
                        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
                            <div className="bg-background p-3 rounded-full shadow-sm mb-3 border border-border">
                                <Bot size={32} className="text-muted-foreground/50" />
                            </div>
                            <h3 className="text-base font-medium text-foreground">
                                {agentName ? `Chat with ${agentName}` : "New Conversation"}
                            </h3>
                            <p className="max-w-xs mt-1.5 text-sm text-muted-foreground">
                                Send a message below to start the conversation.
                            </p>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <ChatBubble key={msg.id} message={msg} />
                    ))}

                    {isProcessing && <ThinkingIndicator />}
                </div>
            </div>

            <ChatInput
                inputValue={inputValue}
                setInputValue={setInputValue}
                handleSend={handleSend}
                loading={loading}
            />
        </div>
    );
}
