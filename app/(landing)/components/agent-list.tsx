"use client";

import { useEffect, useState, useCallback } from "react";
import { useOpenClaw } from "@/hooks/use-open-claw";
import { Bot, Loader2, Circle, Plus, Trash2 } from "lucide-react";
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddAgentDialog } from "./add-agent-dialog";
import { DeleteAgentDialog } from "./delete-agent-dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentStatus = "active" | "idle" | "unknown";

type Agent = {
    id: string;
    name?: string;
    emoji?: string;
    workspace?: string;
    status: AgentStatus;
    lastActivity?: number;
    sessionCount: number;
};

type RawAgent = {
    id: string;
    name?: string;
    emoji?: string;
    workspace?: string;
};

const ACTIVE_THRESHOLD_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentList() {
    const { call, isConnected, helloPayload } = useOpenClaw();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(false);

    const [addOpen, setAddOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    // ---- Fetch & merge agents with session activity ----

    const fetchAgents = useCallback(async () => {
        if (!isConnected) return;
        setLoading(true);

        try {
            // 1. Get raw agent list (try multiple sources)
            let rawAgents = await fetchRawAgents(call, helloPayload);

            // 2. Get session activity data
            const agentActivity = await fetchAgentActivity(call);

            // 3. Fallback: derive agents from session keys
            if (rawAgents.length === 0) {
                rawAgents = [...agentActivity.keys()].map((id) => ({ id }));
            }

            // 4. Merge + sort
            const now = Date.now();
            const merged: Agent[] = rawAgents.map((a) => {
                const activity = agentActivity.get(a.id);
                const lastActivity = activity?.lastActivity;
                const sessionCount = activity?.sessionCount ?? 0;
                const status: AgentStatus =
                    lastActivity && now - lastActivity < ACTIVE_THRESHOLD_MS ? "active" : "idle";

                return { ...a, status, lastActivity, sessionCount };
            });

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
    }, [isConnected, call, helloPayload]);

    useEffect(() => {
        if (isConnected) {
            fetchAgents();
            const interval = setInterval(fetchAgents, 15000);
            return () => clearInterval(interval);
        }
    }, [isConnected, fetchAgents]);

    // ---- Handlers passed to dialogs ----

    const handleCreate = async (name: string) => {
        const params: Record<string, string | undefined> = {
            name,
            workspace: name === "" ? undefined : `/root/.openclaw/workspace-${name.toLowerCase()}`,
        };

        await call("agents.create", params);
        await fetchAgents();
    };

    const handleDelete = async (agentId: string) => {
        await call("agents.delete", { agentId });
        await fetchAgents();
    };

    // ---- Render ----

    return (
        <>
            <SidebarGroup>
                <div className="flex items-center justify-between">
                    <SidebarGroupLabel>Agents</SidebarGroupLabel>
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        className="mr-2 text-muted-foreground hover:text-foreground"
                        onClick={() => setAddOpen(true)}
                        disabled={!isConnected}
                        title="Add agent"
                    >
                        <Plus className="size-3.5" />
                    </Button>
                </div>

                <SidebarMenu>
                    {!isConnected && (
                        <div className="text-center text-sm text-muted-foreground py-4">Connecting...</div>
                    )}
                    {isConnected && loading && agents.length === 0 && (
                        <div className="flex items-center justify-center py-4 text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                        </div>
                    )}
                    {isConnected && !loading && agents.length === 0 && (
                        <div className="text-center text-sm text-muted-foreground py-4">No agents found</div>
                    )}

                    {agents.map((agent) => (
                        <SidebarMenuItem key={agent.id} className="group/agent">
                            <SidebarMenuButton className="h-auto py-2 cursor-default" asChild>
                                <div>
                                    <div className="relative">
                                        <Avatar className="size-8 rounded-lg">
                                            <AvatarFallback className="rounded-lg bg-sidebar-primary/10 text-sidebar-primary text-xs">
                                                {agent.emoji || <Bot className="size-4" />}
                                            </AvatarFallback>
                                        </Avatar>
                                        <Circle
                                            className={`absolute -bottom-0.5 -right-0.5 size-3 fill-current stroke-sidebar ${
                                                agent.status === "active"
                                                    ? "text-green-500"
                                                    : "text-muted-foreground/40"
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
                                                ` · ${agent.sessionCount} session${
                                                    agent.sessionCount !== 1 ? "s" : ""
                                                }`}
                                        </span>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        className="opacity-0 group-hover/agent:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteTarget(agent.id);
                                        }}
                                        title={`Delete agent ${agent.id}`}
                                    >
                                        <Trash2 className="size-3" />
                                    </Button>
                                </div>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroup>

            <AddAgentDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={handleCreate} />

            <DeleteAgentDialog
                agentId={deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                onConfirm={handleDelete}
            />
        </>
    );
}

// ---------------------------------------------------------------------------
// Data fetching helpers
// ---------------------------------------------------------------------------

async function fetchRawAgents(
    call: (method: string, params?: any) => Promise<any>,
    helloPayload: any
): Promise<RawAgent[]> {
    const methods: string[] = helloPayload?.features?.methods ?? [];
    console.log("[AgentList] Available gateway methods:", methods);

    // Try agents.list first
    try {
        const res = await call("agents.list");
        const list = Array.isArray(res) ? res : res?.agents ?? res?.list ?? [];
        if (Array.isArray(list) && list.length > 0) return list.map(toRawAgent);
    } catch {
        // not available
    }

    // Fall back to status endpoint
    try {
        const res = await call("status");
        const agents = parseAgentsFromStatus(res);
        if (agents.length > 0) return agents;
        return deepScanForAgents(res);
    } catch {
        // not available
    }

    return [];
}

async function fetchAgentActivity(
    call: (method: string, params?: any) => Promise<any>
): Promise<Map<string, { lastActivity: number; sessionCount: number }>> {
    const map = new Map<string, { lastActivity: number; sessionCount: number }>();

    try {
        const res = await call("sessions.list", { limit: 200 });
        const sessions = res?.sessions ?? (Array.isArray(res) ? res : []);

        for (const s of sessions) {
            const parts = (s.key || "").split(":");
            if (parts[0] === "agent" && parts[1]) {
                const id = parts[1];
                const existing = map.get(id);
                const ts = s.updatedAt ?? 0;
                map.set(id, {
                    lastActivity: Math.max(existing?.lastActivity ?? 0, ts),
                    sessionCount: (existing?.sessionCount ?? 0) + 1,
                });
            }
        }
    } catch {
        // not available
    }

    return map;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function toRawAgent(a: any): RawAgent {
    return {
        id: a.id || a.agentId || "unknown",
        name: a.identity?.name || a.name,
        emoji: a.identity?.emoji || a.emoji,
        workspace: a.identity?.workspace || a.workspace,
    };
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

function extractIdentity(data: any): Partial<RawAgent> {
    return {
        name: data?.identity?.name || data?.name,
        emoji: data?.identity?.emoji || data?.emoji,
        workspace: data?.identity?.workspace || data?.workspace,
    };
}

function formatLastActive(ts?: number): string {
    if (!ts) return "No activity";
    const diff = Date.now() - ts;
    if (diff < 60_000) return "Just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
}
