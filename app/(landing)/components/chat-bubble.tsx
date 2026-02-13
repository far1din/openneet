"use client";

import { useState } from "react";
import { Bot, User as UserIcon, ChevronDown, ChevronRight, Brain } from "lucide-react";
import { clsx } from "clsx";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";

export type Message = {
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    thinking?: string;
    id: string;
    timestamp?: number;
};

interface ChatBubbleProps {
    message: Message;
}

export function ChatBubble({ message }: ChatBubbleProps) {
    const [thinkingOpen, setThinkingOpen] = useState(false);
    const isUser = message.role === "user";

    return (
        <div className={clsx("flex w-full", isUser ? "justify-end" : "justify-start")}>
            <div
                className={clsx(
                    "flex max-w-[80%] md:max-w-[70%]",
                    isUser ? "flex-row-reverse" : "flex-row"
                )}
            >
                <Avatar
                    className={clsx(
                        "h-8 w-8 mt-1 border shadow-sm shrink-0",
                        isUser ? "ml-3 border-transparent" : "mr-3 border-border"
                    )}
                >
                    <AvatarFallback
                        className={clsx(
                            "text-xs font-medium",
                            isUser
                                ? "bg-primary text-primary-foreground"
                                : "bg-background text-foreground"
                        )}
                    >
                        {isUser ? <UserIcon size={14} /> : <Bot size={16} />}
                    </AvatarFallback>
                </Avatar>

                <div className="flex flex-col gap-1.5">
                    {/* Thinking block (collapsible) */}
                    {message.thinking && (
                        <button
                            onClick={() => setThinkingOpen((prev) => !prev)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none w-fit"
                        >
                            <Brain className="size-3" />
                            {thinkingOpen ? (
                                <ChevronDown className="size-3" />
                            ) : (
                                <ChevronRight className="size-3" />
                            )}
                            <span>Thinking</span>
                        </button>
                    )}
                    {message.thinking && thinkingOpen && (
                        <Card className="p-3 text-xs leading-relaxed whitespace-pre-wrap bg-muted/50 text-muted-foreground border-dashed border-border rounded-lg max-h-60 overflow-y-auto">
                            {message.thinking}
                        </Card>
                    )}

                    {/* Main content */}
                    <Card
                        className={clsx(
                            "p-4 shadow-sm text-[15px] leading-relaxed whitespace-pre-wrap border-0",
                            isUser
                                ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                                : "bg-card text-card-foreground border border-border rounded-2xl rounded-tl-sm"
                        )}
                    >
                        {message.content}
                    </Card>
                </div>
            </div>
        </div>
    );
}

/** Animated thinking/processing indicator */
export function ThinkingIndicator() {
    return (
        <div className="flex w-full justify-start">
            <div className="flex flex-row">
                <Avatar className="h-8 w-8 mt-1 border shadow-sm shrink-0 mr-3 border-border">
                    <AvatarFallback className="text-xs font-medium bg-background text-foreground">
                        <Bot size={16} />
                    </AvatarFallback>
                </Avatar>
                <Card className="px-5 py-4 shadow-sm border-0 bg-card text-card-foreground border border-border rounded-2xl rounded-tl-sm">
                    <div className="flex items-center gap-1">
                        <span className="size-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                        <span className="size-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                        <span className="size-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                    </div>
                </Card>
            </div>
        </div>
    );
}
