"use client";

import { useEffect, useState } from "react";

import { useGateway } from "@/lib/client/gateway-context";
import { loadSettings, saveSettings } from "@/lib/client/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import Dashboard from "./components/dashboard";

export default function Home() {
    const { connect, connected, connecting, error } = useGateway();
    const [url, setUrl] = useState("");
    const [token, setToken] = useState("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const settings = loadSettings();
        setUrl(settings.gatewayUrl);
        setToken(settings.token);
    }, []);

    const handleConnect = () => {
        // Save settings
        const settings = loadSettings();
        saveSettings({
            ...settings,
            gatewayUrl: url,
            token: token,
        });

        connect(url, token || undefined);
    };

    if (!mounted) {
        return null; // or a loading spinner
    }

    if (connected) {
        return <Dashboard />;
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Connect to OpenClaw</CardTitle>
                    <CardDescription>Enter your Gateway URL to begin.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid w-full items-center gap-4">
                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="url">Gateway URL</Label>
                            <Input
                                id="url"
                                placeholder="ws://localhost:3000"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="token">Auth Token (Optional)</Label>
                            <Input
                                id="token"
                                placeholder="Enter token if required"
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                            />
                        </div>
                        {error && <div className="text-sm text-red-500 font-medium">{error}</div>}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button onClick={handleConnect} disabled={connecting} className="w-full">
                        {connecting ? "Connecting..." : "Connect"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
