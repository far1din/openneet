import { useEffect, useState, useRef } from "react";
import { useOpenClaw } from "@/hooks/useOpenClaw";
import { Send, Bot, User as UserIcon } from "lucide-react";
import { clsx } from "clsx";

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
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400 p-8 text-center animate-in fade-in duration-500">
                <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                    <Bot size={48} className="text-gray-300" />
                </div>
                <h3 className="text-lg font-medium text-gray-600">No Session Selected</h3>
                <p className="max-w-sm mt-2">
                    Select an active agent session from the sidebar to view history and start chatting.
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-white relative">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-200">
                        <Bot size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900">{sessionKey}</h3>
                        <div className="flex items-center text-xs text-green-600">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                            Active Session
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
                {loading && <div className="text-center text-sm text-gray-400 py-4">Loading history...</div>}
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
                            <div
                                className={clsx(
                                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm",
                                    msg.role === "user"
                                        ? "ml-3 bg-blue-600 text-white"
                                        : "mr-3 bg-white border border-gray-200 text-indigo-600"
                                )}
                            >
                                {msg.role === "user" ? <UserIcon size={14} /> : <Bot size={16} />}
                            </div>

                            <div
                                className={clsx(
                                    "p-4 shadow-sm text-[15px] leading-relaxed whitespace-pre-wrap",
                                    msg.role === "user"
                                        ? "bg-blue-600 text-white rounded-2xl rounded-tr-sm"
                                        : "bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-tl-sm"
                                )}
                            >
                                {msg.content}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-gray-100">
                <div className="max-w-4xl mx-auto relative flex items-center bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50/50 transition-all duration-200">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        placeholder="Type a message to the agent..."
                        className="flex-1 bg-transparent border-none py-4 px-5 focus:ring-0 text-gray-800 placeholder-gray-400"
                        disabled={loading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputValue.trim()}
                        className="mr-2 p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg hover:shadow-blue-200 active:scale-95"
                    >
                        <Send size={18} />
                    </button>
                </div>
                <div className="text-center mt-2">
                    <span className="text-xs text-gray-400">Press Enter to send</span>
                </div>
            </div>
        </div>
    );
}
