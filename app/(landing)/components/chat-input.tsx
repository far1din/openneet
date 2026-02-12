import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { clsx } from "clsx";

interface ChatInputProps {
    inputValue: string;
    setInputValue: (value: string) => void;
    handleSend: () => void;
    loading: boolean;
}

export default function ChatInput({ inputValue, setInputValue, handleSend, loading }: ChatInputProps) {
    return (
        <div className="p-4 bg-background pb-6">
            <div className="max-w-4xl mx-auto w-full relative">
                <div className="relative flex items-end w-full p-2 bg-muted/40 border border-border/40 rounded-3xl focus-within:ring-1 focus-within:ring-ring/20 focus-within:bg-muted/60 transition-all shadow-sm">
                    {/* Placeholder for future attachments */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full text-muted-foreground hover:bg-background shrink-0 mb-0.5 ml-1"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M5 12h14" />
                            <path d="M12 5v14" />
                        </svg>
                    </Button>

                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        placeholder="Type a message to the agent..."
                        className="border-0 focus-visible:ring-0 shadow-none bg-transparent py-4 h-12 min-h-[48px] resize-none text-base"
                        disabled={loading}
                    />

                    <Button
                        onClick={handleSend}
                        disabled={!inputValue.trim()}
                        className={clsx(
                            "h-10 w-10 rounded-full shrink-0 mb-0.5 transition-all duration-200",
                            inputValue.trim()
                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                : "bg-transparent text-muted-foreground hover:bg-background"
                        )}
                        size="icon"
                        variant={inputValue.trim() ? "default" : "ghost"}
                    >
                        <Send size={18} />
                    </Button>
                </div>
            </div>
            <div className="text-center mt-3">
                <span className="text-[10px] text-muted-foreground/60">
                    OpenClaw can make mistakes. Check important info.
                </span>
            </div>
        </div>
    );
}
