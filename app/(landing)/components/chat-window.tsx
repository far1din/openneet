import { useEffect, useState, useRef } from "react";
import { useOpenClaw } from "@/hooks/use-open-claw";
import { Bot, User as UserIcon } from "lucide-react";
import { clsx } from "clsx";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import ChatInput from "./chat-input";

interface ChatWindowProps {
    sessionKey: string | null;
}

type Message = {
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    id?: string;
    timestamp?: number;
};

// Gateway messages have content as an array of structured objects:
//   [{ type: "text", text: "..." }, { type: "thinking", thinking: "..." }, ...]
// This helper extracts the readable text from that array.
function extractTextFromContent(content: any): string {
    // If it's already a string, return it directly
    if (typeof content === "string") return content;

    // If it's an array of content blocks, extract text from each
    if (Array.isArray(content)) {
        return content
            .map((block: any) => {
                if (block.type === "text" && block.text) return block.text;
                if (block.type === "thinking" && block.thinking) return `[thinking] ${block.thinking}`;
                if (block.type === "toolCall" && block.name) return `[tool call: ${block.name}]`;
                if (block.type === "toolResult") {
                    const text = block.content
                        ?.map((c: any) => c.text)
                        .filter(Boolean)
                        .join("\n");
                    return text ? `[tool result: ${text}]` : "[tool result]";
                }
                return "";
            })
            .filter(Boolean)
            .join("\n");
    }

    return String(content ?? "");
}

export default function ChatWindow({ sessionKey }: ChatWindowProps) {
    const { call, subscribe } = useOpenClaw();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Fetch chat history when session changes
    useEffect(() => {
        if (!sessionKey) return;

        const fetchHistory = async () => {
            setLoading(true);
            try {
                // Gateway method: chat.history
                // Params: { sessionKey: string, limit: number }
                // Response: { sessionKey, sessionId?, messages: Array<{ role, content, timestamp?, ... }> }
                const res: any = await call("chat.history", { sessionKey, limit: 200 });

                console.log("chat.history response:", res);

                if (res && Array.isArray(res.messages)) {
                    const parsed: Message[] = res.messages
                        .map((m: any) => {
                            const text = extractTextFromContent(m.content);
                            if (!text) return null; // skip empty messages (e.g. pure tool results)
                            return {
                                role: m.role || "assistant",
                                content: text,
                                id: m.id || m.clientId || crypto.randomUUID(),
                                timestamp: m.timestamp,
                            };
                        })
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

    // Subscribe to real-time events for this session
    useEffect(() => {
        if (!sessionKey) return;

        return subscribe((msg) => {
            if (msg.type !== "event") return;

            // The gateway broadcasts "chat" events with a payload containing sessionKey + message
            const payload = msg.payload as any;
            if (!payload) return;

            const eventSessionKey = payload.sessionKey;
            if (eventSessionKey !== sessionKey) return;

            // A "chat" event with a message means the agent produced a new message
            if (msg.event === "chat" && payload.message) {
                const m = payload.message;
                const text = extractTextFromContent(m.content);
                if (text) {
                    setMessages((prev) => [
                        ...prev,
                        {
                            role: m.role || "assistant",
                            content: text,
                            id: m.id || crypto.randomUUID(),
                            timestamp: m.timestamp,
                        },
                    ]);
                }
            }
        });
    }, [sessionKey, subscribe]);

    const handleSend = async () => {
        if (!inputValue.trim() || !sessionKey) return;

        const userMsg: Message = { role: "user", content: inputValue, id: crypto.randomUUID(), timestamp: Date.now() };
        setMessages((prev) => [...prev, userMsg]);
        setInputValue("");

        try {
            // Gateway method: chat.send
            // Params: { sessionKey, message, deliver, timeoutMs, idempotencyKey }
            await call("chat.send", {
                sessionKey,
                message: userMsg.content,
                deliver: false,
                timeoutMs: 120_000,
                idempotencyKey: crypto.randomUUID(),
            });
        } catch (err) {
            console.error("Failed to send message:", err);
        }
    };

    if (!sessionKey) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-muted/10 text-muted-foreground p-8 text-center animate-in fade-in duration-500">
                <div className="bg-background p-4 rounded-full shadow-sm mb-4 border border-border">
                    <Bot size={48} className="text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-medium text-foreground">No Session Selected</h3>
                <p className="max-w-sm mt-2 text-muted-foreground">
                    Select an active agent session from the sidebar to view history and start chatting.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 h-full min-h-0 bg-background relative">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
                <div className="flex items-center space-x-3 max-w-4xl mx-auto w-full">
                    <Avatar className="h-10 w-10 border border-border shadow-sm">
                        <AvatarFallback className="bg-primary/10 text-primary">
                            <Bot size={20} />
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h3 className="font-bold text-foreground text-sm">{sessionKey}</h3>
                        <div className="flex items-center text-xs text-green-600 font-medium">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                            Active Session
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 bg-muted/5 p-6">
                <div className="space-y-6 max-w-4xl mx-auto w-full">
                    {loading && (
                        <div className="text-center text-sm text-muted-foreground py-4">Loading history...</div>
                    )}
                    {messages.map((msg, idx) => (
                        <div
                            key={msg.id || idx}
                            className={clsx("flex w-full", msg.role === "user" ? "justify-end" : "justify-start")}
                        >
                            <div
                                className={clsx(
                                    "flex max-w-[80%] md:max-w-[70%]",
                                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                                )}
                            >
                                <Avatar
                                    className={clsx(
                                        "h-8 w-8 mt-1 border shadow-sm shrink-0",
                                        msg.role === "user" ? "ml-3 border-transparent" : "mr-3 border-border"
                                    )}
                                >
                                    <AvatarFallback
                                        className={clsx(
                                            "text-xs font-medium",
                                            msg.role === "user"
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-background text-foreground"
                                        )}
                                    >
                                        {msg.role === "user" ? <UserIcon size={14} /> : <Bot size={16} />}
                                    </AvatarFallback>
                                </Avatar>

                                <Card
                                    className={clsx(
                                        "p-4 shadow-sm text-[15px] leading-relaxed whitespace-pre-wrap border-0",
                                        msg.role === "user"
                                            ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                                            : "bg-card text-card-foreground border border-border rounded-2xl rounded-tl-sm"
                                    )}
                                >
                                    {msg.content}
                                </Card>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>

            {/* Input */}
            <ChatInput
                inputValue={inputValue}
                setInputValue={setInputValue}
                handleSend={handleSend}
                loading={loading}
            />
        </div>
    );
}
