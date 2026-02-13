"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { GatewayBrowserClient, type GatewayHelloOk, type GatewayEventFrame } from "./gateway";

interface GatewayContextType {
    client: GatewayBrowserClient | null;
    connected: boolean;
    connecting: boolean;
    error: string | null;
    hello: GatewayHelloOk | null;
    connect: (url: string, token?: string, password?: string) => void;
    disconnect: () => void;
}

const GatewayContext = createContext<GatewayContextType | undefined>(undefined);

export function GatewayProvider({ children }: { children: React.ReactNode }) {
    const [client, setClient] = useState<GatewayBrowserClient | null>(null);
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hello, setHello] = useState<GatewayHelloOk | null>(null);

    const connect = useCallback(
        (url: string, token?: string, password?: string) => {
            if (client) {
                client.stop();
            }

            setConnecting(true);
            setError(null);
            setHello(null);

            const newClient = new GatewayBrowserClient({
                url,
                token,
                password,
                onHello: (h) => {
                    setHello(h);
                    setConnected(true);
                    setConnecting(false);
                    console.log("Gateway connected:", h);
                },
                onEvent: (evt: GatewayEventFrame) => {
                    console.log("Gateway event:", evt);
                },
                onClose: (info) => {
                    console.log("Gateway closed:", info);
                    setConnected(false);
                    if (info.code !== 1000) {
                        // Only set error if not a clean close, or maybe just log it
                        if (connecting) {
                            setError(`Connection failed: ${info.reason || "Unknown error"}`);
                            setConnecting(false);
                        }
                    }
                },
            });

            setClient(newClient);
            newClient.start();
        },
        [client, connecting]
    );

    const disconnect = useCallback(() => {
        if (client) {
            client.stop();
            setClient(null);
            setConnected(false);
            setConnecting(false);
            setHello(null);
        }
    }, [client]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (client) {
                client.stop();
            }
        };
    }, [client]);

    return (
        <GatewayContext.Provider
            value={{
                client,
                connected,
                connecting,
                error,
                hello,
                connect,
                disconnect,
            }}
        >
            {children}
        </GatewayContext.Provider>
    );
}

export function useGateway() {
    const context = useContext(GatewayContext);
    if (context === undefined) {
        throw new Error("useGateway must be used within a GatewayProvider");
    }
    return context;
}
