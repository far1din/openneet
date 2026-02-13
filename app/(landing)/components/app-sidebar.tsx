"use client";

import * as React from "react";
import { useOpenClaw } from "@/hooks/use-open-claw";
import { clsx } from "clsx";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
} from "@/components/ui/sidebar";
import { AgentList } from "./agent-list";
import { SessionList } from "./session-list";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
    onSelectSession: (sessionKey: string) => void;
    onSelectAgent?: (agentId: string) => void;
    activeSessionKey?: string | null;
}

export function AppSidebar({ onSelectSession, onSelectAgent, activeSessionKey, ...props }: AppSidebarProps) {
    const { isConnected } = useOpenClaw();

    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <div className="flex items-center gap-2 p-2">
                    <div className="flex aspect-square size-12 items-center justify-center rounded-lg bg-card text-sidebar-primary-foreground">
                        <img src="/logox.png" alt="OpenClaw" className="w-full h-full object-cover" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">OpenClaw</span>
                        <span className="truncate text-xs">Admin Panel</span>
                    </div>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <AgentList onSelectAgent={onSelectAgent} />
                <SessionList onSelectSession={onSelectSession} activeSessionKey={activeSessionKey} />
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
