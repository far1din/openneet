import { useEffect, useState } from "react";
import { AgentInfo } from "@/lib/client/gateway";
import { useGateway } from "@/lib/client/gateway-context";

export default function AgentsList() {
    const [agents, setAgents] = useState<AgentInfo[]>([]);
    const { client } = useGateway();

    useEffect(() => {
        handleListAgents();
    }, []);

    const handleListAgents = async () => {
        if (!client) return;
        try {
            const list = (await client.listAgents()) as any;
            console.log("Agents:", list.agents);
            setAgents(list.agents);
        } catch (err) {
            console.error("Failed to list agents:", err);
        }
    };

    return (
        <div className="mt-4 rounded-md bg-zinc-100 p-4 font-mono text-xs dark:bg-zinc-900 overflow-auto max-h-64">
            <h3 className="font-bold mb-2">Agents ({agents.length})</h3>
            <pre>{JSON.stringify(agents, null, 2)}</pre>
        </div>
    );
}
