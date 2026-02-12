"use client";

import { useEffect, useState } from "react";
import { useOpenClaw } from "@/hooks/use-open-claw";
import { Bot, Loader2 } from "lucide-react";
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Agent = {
    id: string;
    name?: string;
    emoji?: string;
    workspace?: string;
};

export function AgentList() {
    const { call, isConnected, helloPayload } = useOpenClaw();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchAgents = async () => {
        if (!isConnected) return;
        setLoading(true);

        // Log available methods from hello-ok so we can see what the gateway supports
        const methods: string[] = helloPayload?.features?.methods ?? [];
        console.log("[AgentList] Available gateway methods:", methods);

        try {
            // ------------------------------------------------------------------
            // Attempt 1: try calling 'agents.list' directly (may or may not exist)
            // ------------------------------------------------------------------
            try {
                const res: any = await call("agents.list");
                console.log("[AgentList] agents.list response:", res);
                const parsed = parseAgentsList(res);
                if (parsed.length > 0) {
                    setAgents(parsed);
                    return;
                }
            } catch (err: any) {
                console.log("[AgentList] agents.list not available:", err?.message || err?.code || err);
            }

            // ------------------------------------------------------------------
            // Attempt 2: call 'status' and do a deep scan for agent-like data
            // ------------------------------------------------------------------
            try {
                const res: any = await call("status");
                console.log("[AgentList] status response (full):", JSON.stringify(res, null, 2));

                const parsed = parseAgentsFromStatus(res);
                if (parsed.length > 0) {
                    setAgents(parsed);
                    return;
                }

                // Deep scan: recursively find any key that looks like it contains agent entries
                const deepParsed = deepScanForAgents(res);
                if (deepParsed.length > 0) {
                    console.log("[AgentList] Found agents via deep scan:", deepParsed);
                    setAgents(deepParsed);
                    return;
                }
            } catch (err: any) {
                console.log("[AgentList] status method failed:", err?.message || err?.code || err);
            }

            // ------------------------------------------------------------------
            // Attempt 3: fall back to deriving agent IDs from session keys
            // ------------------------------------------------------------------
            console.log("[AgentList] Falling back to session-key derivation (only shows agents with sessions)");
            const sessionsRes: any = await call("sessions.list", { limit: 100 });
            const sessionList: any[] = sessionsRes?.sessions ?? (Array.isArray(sessionsRes) ? sessionsRes : []);

            const agentIds = [
                ...new Set(
                    sessionList
                        .map((s: any) => {
                            const parts = (s.key || "").split(":");
                            if (parts[0] === "agent" && parts[1]) return parts[1];
                            return null;
                        })
                        .filter(Boolean) as string[]
                ),
            ];

            setAgents(agentIds.map((id) => ({ id })));
        } catch (err) {
            console.error("[AgentList] Failed to fetch agents:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isConnected) {
            fetchAgents();
        }
    }, [isConnected]);

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Agents</SidebarGroupLabel>
            <SidebarMenu>
                {!isConnected && (
                    <div className="text-center text-sm text-muted-foreground py-4">Connecting...</div>
                )}
                {isConnected && loading && (
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
                            <Avatar className="size-8 rounded-lg">
                                <AvatarFallback className="rounded-lg bg-sidebar-primary/10 text-sidebar-primary text-xs">
                                    {agent.emoji || <Bot className="size-4" />}
                                </AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">
                                    {agent.name || agent.id}
                                </span>
                                {agent.name && (
                                    <span className="truncate text-xs text-muted-foreground">
                                        {agent.id}
                                    </span>
                                )}
                                {agent.workspace && (
                                    <span className="truncate text-xs text-muted-foreground">
                                        {agent.workspace}
                                    </span>
                                )}
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** Parse a direct agents.list response */
function parseAgentsList(res: any): Agent[] {
    // Could be an array directly, or { agents: [...] }
    const list = Array.isArray(res) ? res : res?.agents ?? res?.list ?? [];
    if (!Array.isArray(list)) return [];
    return list.map((a: any) => ({
        id: a.id || a.agentId || "unknown",
        name: a.identity?.name || a.name,
        emoji: a.identity?.emoji || a.emoji,
        workspace: a.identity?.workspace || a.workspace,
    }));
}

/** Try common patterns in the status response */
function parseAgentsFromStatus(res: any): Agent[] {
    if (!res) return [];

    // Pattern 1: res.agents is an array
    if (Array.isArray(res.agents)) {
        return res.agents.map(toAgent);
    }

    // Pattern 2: res.agents is an object keyed by agent id
    if (res.agents && typeof res.agents === "object") {
        return Object.entries(res.agents).map(([id, data]: [string, any]) => ({
            id,
            ...extractIdentity(data),
        }));
    }

    // Pattern 3: res.agentStores / res.sessionStores keyed by agent id
    const stores = res.agentStores || res.sessionStores;
    if (stores && typeof stores === "object") {
        return Object.keys(stores).map((id) => ({ id }));
    }

    // Pattern 4: res.config?.agents?.list
    if (Array.isArray(res.config?.agents?.list)) {
        return res.config.agents.list.map(toAgent);
    }

    // Pattern 5: res.overview?.agents or res.data?.agents
    const nested = res.overview?.agents || res.data?.agents;
    if (Array.isArray(nested)) {
        return nested.map(toAgent);
    }
    if (nested && typeof nested === "object") {
        return Object.entries(nested).map(([id, data]: [string, any]) => ({
            id,
            ...extractIdentity(data),
        }));
    }

    return [];
}

/**
 * Deep scan: walk the entire status response looking for anything that
 * looks like an agent entry (object with an "id" field and optionally "identity").
 * This is a last resort to discover agent data regardless of nesting.
 */
function deepScanForAgents(obj: any, depth = 0): Agent[] {
    if (depth > 5 || !obj || typeof obj !== "object") return [];

    const results: Agent[] = [];
    const seen = new Set<string>();

    function walk(val: any, d: number) {
        if (d > 5 || !val || typeof val !== "object") return;

        // If it looks like an agent entry
        if (val.id && val.identity && typeof val.identity === "object") {
            if (!seen.has(val.id)) {
                seen.add(val.id);
                results.push(toAgent(val));
            }
            return;
        }

        // If it's an array, check each element
        if (Array.isArray(val)) {
            for (const item of val) walk(item, d + 1);
            return;
        }

        // Walk object values
        for (const key of Object.keys(val)) {
            walk(val[key], d + 1);
        }
    }

    walk(obj, 0);
    return results;
}

function toAgent(a: any): Agent {
    return {
        id: a.id || a.agentId || "unknown",
        name: a.identity?.name || a.name,
        emoji: a.identity?.emoji || a.emoji,
        workspace: a.identity?.workspace || a.workspace,
    };
}

function extractIdentity(data: any): Partial<Agent> {
    return {
        name: data?.identity?.name || data?.name,
        emoji: data?.identity?.emoji || data?.emoji,
        workspace: data?.identity?.workspace || data?.workspace,
    };
}
