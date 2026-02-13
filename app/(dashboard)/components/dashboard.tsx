import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import { useGateway } from "@/lib/client/gateway-context";
import AgentsList from "./agents-list";
import SessionsList from "./sessions-list";

export default function Dashboard() {
    const { hello, disconnect } = useGateway();

    const handleDisconnect = () => {
        disconnect();
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Connected to OpenClaw</CardTitle>
                    <CardDescription>Gateway connection established.</CardDescription>
                </CardHeader>
                <div className="px-6">
                    <AgentsList />
                    <SessionsList />
                </div>
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
            </Card>
        </div>
    );
}
