"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useOpenClaw } from "@/hooks/use-open-claw";
import { User, Clock, GalleryVerticalEnd } from "lucide-react";
import { clsx } from "clsx";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarRail,
} from "@/components/ui/sidebar";
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

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
    onSelectSession: (sessionKey: string) => void;
    activeSessionKey?: string | null;
}

export function AppSidebar({ onSelectSession, activeSessionKey, ...props }: AppSidebarProps) {
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
            return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } catch {
            return "";
        }
    };

    const getSessionTitle = (session: Session) => {
        if (session.derivedTitle) return session.derivedTitle;
        if (session.label) return session.label;
        if (session.displayName) return session.displayName;
        if (session.friendlyId) return session.friendlyId;
        const parts = session.key.split(":");
        return parts[parts.length - 1] || session.key;
    };

    return (
        <Sidebar collapsible="icon" {...props}>
             <SidebarHeader>
                 <div className="flex items-center gap-2 p-2">
                     <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                        <GalleryVerticalEnd className="size-4" />
                     </div>
                     <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">OpenClaw</span>
                        <span className="truncate text-xs">Admin Panel</span>
                     </div>
                 </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Sessions</SidebarGroupLabel>
                    <SidebarMenu>
                             {!isConnected && <div className="text-center text-sm text-muted-foreground py-8">Connecting...</div>}
                             {isConnected && sessions.length === 0 && !loading && (
                                <div className="text-center text-sm text-muted-foreground py-8">No active sessions</div>
                            )}
                        {sessions.map((session) => (
                            <SidebarMenuItem key={session.key}>
                                <SidebarMenuButton
                                    onClick={() => onSelectSession(session.key)}
                                    isActive={activeSessionKey === session.key}
                                    className="h-auto py-3"
                                >
                                     <Avatar className="h-8 w-8 rounded-lg">
                                        <AvatarFallback className="rounded-lg bg-sidebar-primary/10 text-sidebar-primary">
                                            <User className="size-4" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-medium">{getSessionTitle(session)}</span>
                                        <span className="truncate text-xs text-muted-foreground flex items-center">
                                            <Clock className="mr-1 size-3" />
                                            {formatTime(session.updatedAt)}
                                        </span>
                                    </div>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
             <SidebarFooter>
                 <div className="flex items-center justify-between p-2 text-xs text-muted-foreground border-t border-sidebar-border/50">
                    <span>Status</span>
                     <span
                        className={clsx(
                            "w-2.5 h-2.5 rounded-full",
                            isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-destructive"
                        )}
                        title={isConnected ? "Connected" : "Disconnected"}
                    />
                 </div>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
