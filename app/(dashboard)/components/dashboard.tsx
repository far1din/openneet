import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentInfo } from "@/lib/client/gateway";
import { useGateway } from "@/lib/client/gateway-context";

export default function Dashboard() {
    const { hello, client, disconnect } = useGateway();
    const [agents, setAgents] = useState<AgentInfo[]>([]);

    const handleDisconnect = () => {
        disconnect();
    };

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
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Connected to OpenClaw</CardTitle>
                    <CardDescription>Gateway connection established.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="rounded-md bg-zinc-100 p-4 font-mono text-sm dark:bg-zinc-900 overflow-auto max-h-64">
                            <pre>{JSON.stringify(hello, null, 2)}</pre>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button variant="outline" onClick={handleDisconnect} className="w-full">
                        Disconnect
                    </Button>
                </CardFooter>
                <div className="px-6">
                    <Button variant="outline" onClick={handleListAgents} className="w-full">
                        List Agents
                    </Button>
                    {agents.length > 0 && (
                        <div className="mt-4 rounded-md bg-zinc-100 p-4 font-mono text-xs dark:bg-zinc-900 overflow-auto max-h-64">
                            <h3 className="font-bold mb-2">Agents ({agents.length})</h3>
                            <pre>{JSON.stringify(agents, null, 2)}</pre>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
