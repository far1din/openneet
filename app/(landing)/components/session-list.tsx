import { useEffect, useState } from "react";
import { useOpenClaw } from "@/hooks/use-open-claw";
import { User, Clock } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Matches the actual Gateway sessions.list response shape
type Session = {
    key: string; // e.g. "agent:myAgent:main"
    friendlyId?: string; // short alias
    label?: string; // user-set label
    derivedTitle?: string; // AI-generated title from conversation
    displayName?: string; // channel display name
    updatedAt?: number; // unix timestamp (ms)
    totalTokens?: number;
    contextTokens?: number;
    [key: string]: any;
};

interface SessionListProps {
    onSelectSession: (sessionKey: string) => void;
    activeSessionKey?: string;
}

export default function SessionList({ onSelectSession, activeSessionKey }: SessionListProps) {
    const { call, isConnected } = useOpenClaw();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchSessions = async () => {
        if (!isConnected) return;
        try {
            setLoading(true);
            const res: any = await call("sessions.list", {
                limit: 50,
                includeLastMessage: true,
                includeDerivedTitles: true,
            });

            let sessionList: Session[] = [];
            if (res && Array.isArray(res.sessions)) {
                sessionList = res.sessions;
            } else if (Array.isArray(res)) {
                sessionList = res;
            }

            // Sort by most recently updated
            sessionList.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

            console.log("Sessions loaded:", sessionList);
            setSessions(sessionList);
        } catch (err) {
            console.error("Failed to fetch sessions:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isConnected) {
            fetchSessions();
            const interval = setInterval(fetchSessions, 10000);
            return () => clearInterval(interval);
        }
    }, [isConnected]);

    const formatTime = (ts?: number) => {
        if (!ts) return "";
        try {
            return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return "";
        }
    };

    // Derive a human-readable name from the session
    const getSessionTitle = (session: Session) => {
        if (session.derivedTitle) return session.derivedTitle;
        if (session.label) return session.label;
        if (session.displayName) return session.displayName;
        if (session.friendlyId) return session.friendlyId;
        // Fall back to the last segment of the session key
        const parts = session.key.split(":");
        return parts[parts.length - 1] || session.key;
    };

    return (
        <div className="w-full min-w-0 border-r border-border h-full flex flex-col overflow-hidden bg-muted/30">
            <div className="p-4 border-b border-border flex justify-between items-center bg-background shrink-0">
                <h2 className="font-semibold text-foreground truncate">Sessions</h2>
                <div className="flex items-center space-x-2">
                    <span
                        className={clsx(
                            "w-2.5 h-2.5 rounded-full",
                            isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-destructive"
                        )}
                        title={isConnected ? "Connected" : "Disconnected"}
                    />
                </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 overflow-hidden">
                <div className="p-3 space-y-2 min-w-0">
                    {!isConnected && <div className="text-center text-sm text-muted-foreground py-8">Connecting to VPS...</div>}
                    {isConnected && sessions.length === 0 && !loading && (
                        <div className="text-center text-sm text-muted-foreground py-8">No active sessions found</div>
                    )}
                    {sessions.map((session) => (
                        <button
                            key={session.key}
                            onClick={() => onSelectSession(session.key)}
                            className={twMerge(
                                "w-full text-left p-3 rounded-xl transition-all duration-200 flex items-start space-x-3 border border-transparent hover:bg-accent hover:text-accent-foreground cursor-pointer group",
                                activeSessionKey === session.key &&
                                    "bg-background border-border shadow-sm ring-1 ring-border"
                            )}
                        >
                            <Avatar className="h-9 w-9 bg-primary/10 text-primary rounded-lg shrink-0">
                                <AvatarFallback className={twMerge(
                                    "rounded-lg",
                                    activeSessionKey === session.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-background"
                                )}>
                                    <User size={16} />
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 overflow-hidden min-w-0">
                                <div
                                    className={twMerge(
                                        "font-medium truncate text-sm",
                                        activeSessionKey === session.key ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                                    )}
                                >
                                    {getSessionTitle(session)}
                                </div>
                                <div className="text-xs text-muted-foreground/70 flex items-center mt-1">
                                    <Clock size={10} className="mr-1" />
                                    {formatTime(session.updatedAt)}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
