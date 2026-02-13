"use client";

import { useEffect, useState, useCallback } from "react";
import { useOpenClaw } from "@/hooks/use-open-claw";
import { User, Clock, Trash2 } from "lucide-react";
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DeleteSessionDialog } from "./delete-session-dialog";

type Session = {
    key: string;
    friendlyId?: string;
    label?: string;
    derivedTitle?: string;
    displayName?: string;
    updatedAt?: number;
    totalTokens?: number;
    contextTokens?: number;
    lastMessagePreview?: string;
    [key: string]: any;
};

interface SessionListProps {
    onSelectSession: (sessionKey: string) => void;
    activeSessionKey?: string | null;
}

export function SessionList({ onSelectSession, activeSessionKey }: SessionListProps) {
    const { call, isConnected } = useOpenClaw();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    const fetchSessions = useCallback(async () => {
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

            sessionList.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
            setSessions(sessionList);
        } catch (err) {
            console.error("Failed to fetch sessions:", err);
        } finally {
            setLoading(false);
        }
    }, [isConnected, call]);

    useEffect(() => {
        if (isConnected) {
            fetchSessions();
            const interval = setInterval(fetchSessions, 10000);
            return () => clearInterval(interval);
        }
    }, [isConnected, fetchSessions]);

    const handleDelete = async (sessionKey: string) => {
        await call("sessions.delete", { sessionKey });
        await fetchSessions();
    };

    return (
        <>
            <SidebarGroup>
                <SidebarGroupLabel>Sessions</SidebarGroupLabel>
                <SidebarMenu>
                    {!isConnected && (
                        <div className="text-center text-sm text-muted-foreground py-8">Connecting...</div>
                    )}
                    {isConnected && sessions.length === 0 && !loading && (
                        <div className="text-center text-sm text-muted-foreground py-8">No active sessions</div>
                    )}
                    {sessions.map((session) => (
                        <SidebarMenuItem key={session.key} className="group/session">
                            <SidebarMenuButton
                                onClick={() => onSelectSession(session.key)}
                                isActive={activeSessionKey === session.key}
                                asChild
                            >
                                <div className="h-auto py-3 cursor-pointer items-start">
                                    <Avatar className="size-8 rounded-lg">
                                        <AvatarFallback className="rounded-lg bg-sidebar-primary/10 text-sidebar-primary">
                                            <User className="size-4" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-medium">{getSessionTitle(session)}</span>
                                        <span className="text-xs truncate text-muted-foreground">
                                            {session.lastMessagePreview ||
                                                session.derivedTitle ||
                                                session.label ||
                                                session.displayName ||
                                                session.friendlyId}
                                        </span>
                                        <span className="truncate text-xs text-muted-foreground flex items-center mt-1">
                                            <Clock className="mr-1 size-3" />
                                            {formatTime(session.updatedAt)}
                                        </span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        className="opacity-0 group-hover/session:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0 mt-1"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteTarget(session.key);
                                        }}
                                        title={`Delete session`}
                                    >
                                        <Trash2 className="size-3" />
                                    </Button>
                                </div>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroup>

            <DeleteSessionDialog
                sessionKey={deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                onConfirm={handleDelete}
            />
        </>
    );
}

function getSessionTitle(session: Session): string {
    if (session.key) return session.key;
    if (session.derivedTitle) return session.derivedTitle;
    if (session.label) return session.label;
    if (session.displayName) return session.displayName;
    if (session.friendlyId) return session.friendlyId;
    const parts = session.key.split(":");
    return parts[parts.length - 1] || session.key;
}

function formatTime(ts?: number): string {
    if (!ts) return "";
    try {
        return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "";
    }
}
