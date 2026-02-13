import { useEffect, useState, useCallback } from "react";
import { useGateway, useGatewayEvent } from "@/lib/client/gateway-context";

export default function SessionsList() {
    const [sessions, setSessions] = useState<any>([]);
    const { client } = useGateway();

    const handleListSessions = useCallback(async () => {
        if (!client) return;
        try {
            const list = (await client.sendRequest("sessions.list")) as any;
            console.log("Sessions:", list.sessions);
            setSessions(list.sessions);
        } catch (err) {
            console.error("Failed to list sessions:", err);
        }
    }, [client]);

    // Initial load
    useEffect(() => {
        handleListSessions();
    }, [handleListSessions]);

    // Updates on events
    useGatewayEvent((evt) => {
        console.log("event received. refetching sessions list.", evt);
        handleListSessions();
    });

    if (!client) return null;

    return (
        <div className="mt-4 rounded-md bg-zinc-100 p-4 font-mono text-xs dark:bg-zinc-900 overflow-auto max-h-150">
            <h3 className="font-bold mb-2">Sessions ({sessions.length})</h3>
            <pre>{JSON.stringify(sessions, null, 2)}</pre>
        </div>
    );
}
