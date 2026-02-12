"use client";

import { useEffect, useState } from "react";
import { useOpenClaw } from "@/hooks/use-open-claw";
import { Bot, Loader2, Circle } from "lucide-react";
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type AgentStatus = "active" | "idle" | "unknown";

type Agent = {
    id: string;
    name?: string;
    emoji?: string;
    workspace?: string;
    status: AgentStatus;
    lastActivity?: number; // unix ms
    sessionCount: number;
};

// An agent is "active" if it has a session updated within this threshold
const ACTIVE_THRESHOLD_MS = 60 * 60 * 1000; // 2 minutes

export function AgentList() {
    const { call, isConnected, helloPayload } = useOpenClaw();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchAgents = async () => {
        if (!isConnected) return;
        setLoading(true);

        const methods: string[] = helloPayload?.features?.methods ?? [];
        console.log("[AgentList] Available gateway methods:", methods);

        try {
            // ----- Step 1: get the list of agents -----
            let rawAgents: RawAgent[] = [];

            // Attempt 1: agents.list
            try {
                const res: any = await call("agents.list");
                console.log("[AgentList] agents.list response:", res);
                rawAgents = parseAgentsList(res);
            } catch (err: any) {
                console.log("[AgentList] agents.list not available:", err?.message || err?.code || err);
            }

            // Attempt 2: status
            if (rawAgents.length === 0) {
                try {
                    const res: any = await call("status");
                    console.log("[AgentList] status response (full):", JSON.stringify(res, null, 2));
                    rawAgents = parseAgentsFromStatus(res);
                    if (rawAgents.length === 0) {
                        rawAgents = deepScanForAgents(res);
                    }
                } catch (err: any) {
                    console.log("[AgentList] status failed:", err?.message || err?.code || err);
                }
            }

            // ----- Step 2: fetch sessions to determine status -----
            let sessionList: any[] = [];
            try {
                const sessionsRes: any = await call("sessions.list", { limit: 200 });
                sessionList = sessionsRes?.sessions ?? (Array.isArray(sessionsRes) ? sessionsRes : []);
            } catch (err: any) {
                console.log("[AgentList] sessions.list failed:", err?.message || err?.code || err);
            }

            // Build a map: agentId -> { lastActivity, sessionCount }
            const agentActivity = new Map<string, { lastActivity: number; sessionCount: number }>();
            for (const s of sessionList) {
                const parts = (s.key || "").split(":");
                if (parts[0] === "agent" && parts[1]) {
                    const agentId = parts[1];
                    const existing = agentActivity.get(agentId);
                    const ts = s.updatedAt ?? 0;
                    agentActivity.set(agentId, {
                        lastActivity: Math.max(existing?.lastActivity ?? 0, ts),
                        sessionCount: (existing?.sessionCount ?? 0) + 1,
                    });
                }
            }

            // Attempt 3 fallback: if we still have no agents, derive from session keys
            if (rawAgents.length === 0) {
                console.log("[AgentList] Falling back to session-key derivation");
                const ids = [...agentActivity.keys()];
                rawAgents = ids.map((id) => ({ id }));
            }

            // ----- Step 3: merge agent info with activity data -----
            const now = Date.now();
            const merged: Agent[] = rawAgents.map((a) => {
                const activity = agentActivity.get(a.id);
                const lastActivity = activity?.lastActivity;
                const sessionCount = activity?.sessionCount ?? 0;

                let status: AgentStatus = "idle";
                if (lastActivity && now - lastActivity < ACTIVE_THRESHOLD_MS) {
                    status = "active";
                }

                return {
                    ...a,
                    status,
                    lastActivity,
                    sessionCount,
                };
            });

            // Sort: active first, then by last activity (most recent first)
            merged.sort((a, b) => {
                if (a.status !== b.status) return a.status === "active" ? -1 : 1;
                return (b.lastActivity ?? 0) - (a.lastActivity ?? 0);
            });

            setAgents(merged);
        } catch (err) {
            console.error("[AgentList] Failed to fetch agents:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isConnected) {
            fetchAgents();
            // Refresh periodically to keep status up to date
            const interval = setInterval(fetchAgents, 15000);
            return () => clearInterval(interval);
        }
    }, [isConnected]);

    const formatLastActive = (ts?: number) => {
        if (!ts) return "No activity";
        const diff = Date.now() - ts;
        if (diff < 60_000) return "Just now";
        if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
        if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
        return `${Math.floor(diff / 86_400_000)}d ago`;
    };

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Agents</SidebarGroupLabel>
            <SidebarMenu>
                {!isConnected && <div className="text-center text-sm text-muted-foreground py-4">Connecting...</div>}
                {isConnected && loading && agents.length === 0 && (
                    <div className="flex items-center justify-center py-4 text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                    </div>
                )}
                {isConnected && !loading && agents.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-4">No agents found</div>
                )}
                {agents.map((agent) => (
                    <SidebarMenuItem key={agent.id}>
                        <SidebarMenuButton className="h-auto py-2 cursor-default">
                            <div className="relative">
                                <Avatar className="size-8 rounded-lg">
                                    <AvatarFallback className="rounded-lg bg-sidebar-primary/10 text-sidebar-primary text-xs">
                                        {agent.emoji || <Bot className="size-4" />}
                                    </AvatarFallback>
                                </Avatar>
                                <Circle
                                    className={`absolute -bottom-0.5 -right-0.5 size-3 fill-current stroke-sidebar ${
                                        agent.status === "active" ? "text-green-500" : "text-muted-foreground/40"
                                    }`}
                                />
                            </div>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <div className="flex items-center gap-1.5">
                                    <span className="truncate font-medium">{agent.name || agent.id}</span>
                                    <Badge
                                        variant={agent.status === "active" ? "default" : "secondary"}
                                        className={`text-[10px] px-1.5 py-0 h-4 font-normal ${
                                            agent.status === "active"
                                                ? "bg-green-500/15 text-green-600 border-green-500/20 hover:bg-green-500/15"
                                                : ""
                                        }`}
                                    >
                                        {agent.status}
                                    </Badge>
                                </div>
                                {agent.name && (
                                    <span className="truncate text-xs text-muted-foreground">{agent.id}</span>
                                )}
                                <span className="truncate text-xs text-muted-foreground">
                                    {formatLastActive(agent.lastActivity)}
                                    {agent.sessionCount > 0 &&
                                        ` · ${agent.sessionCount} session${agent.sessionCount !== 1 ? "s" : ""}`}
                                </span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}

// ---------------------------------------------------------------------------
// Types + parsing helpers
// ---------------------------------------------------------------------------

type RawAgent = {
    id: string;
    name?: string;
    emoji?: string;
    workspace?: string;
};

function parseAgentsList(res: any): RawAgent[] {
    const list = Array.isArray(res) ? res : res?.agents ?? res?.list ?? [];
    if (!Array.isArray(list)) return [];
    return list.map(toRawAgent);
}

function parseAgentsFromStatus(res: any): RawAgent[] {
    if (!res) return [];

    if (Array.isArray(res.agents)) return res.agents.map(toRawAgent);

    if (res.agents && typeof res.agents === "object") {
        return Object.entries(res.agents).map(([id, data]: [string, any]) => ({
            id,
            ...extractIdentity(data),
        }));
    }

    const stores = res.agentStores || res.sessionStores;
    if (stores && typeof stores === "object") {
        return Object.keys(stores).map((id) => ({ id }));
    }

    if (Array.isArray(res.config?.agents?.list)) {
        return res.config.agents.list.map(toRawAgent);
    }

    const nested = res.overview?.agents || res.data?.agents;
    if (Array.isArray(nested)) return nested.map(toRawAgent);
    if (nested && typeof nested === "object") {
        return Object.entries(nested).map(([id, data]: [string, any]) => ({
            id,
            ...extractIdentity(data),
        }));
    }

    return [];
}

function deepScanForAgents(obj: any): RawAgent[] {
    const results: RawAgent[] = [];
    const seen = new Set<string>();

    function walk(val: any, d: number) {
        if (d > 5 || !val || typeof val !== "object") return;
        if (val.id && val.identity && typeof val.identity === "object") {
            if (!seen.has(val.id)) {
                seen.add(val.id);
                results.push(toRawAgent(val));
            }
            return;
        }
        if (Array.isArray(val)) {
            for (const item of val) walk(item, d + 1);
            return;
        }
        for (const key of Object.keys(val)) walk(val[key], d + 1);
    }

    walk(obj, 0);
    return results;
}

function toRawAgent(a: any): RawAgent {
    return {
        id: a.id || a.agentId || "unknown",
        name: a.identity?.name || a.name,
        emoji: a.identity?.emoji || a.emoji,
        workspace: a.identity?.workspace || a.workspace,
    };
}

function extractIdentity(data: any): Partial<RawAgent> {
    return {
        name: data?.identity?.name || data?.name,
        emoji: data?.identity?.emoji || data?.emoji,
        workspace: data?.identity?.workspace || data?.workspace,
    };
}
