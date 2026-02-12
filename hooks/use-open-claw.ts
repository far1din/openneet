import { useEffect, useRef, useState, useCallback } from "react";

const VPS_URL = process.env.NEXT_PUBLIC_VPS_URL;
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN;
const RECONNECT_DELAY = 3000;
const REQUEST_TIMEOUT = 10000;

type OpenClawMessage = {
    type: string;
    id?: string;
    method?: string;
    params?: any;
    ok?: boolean;
    payload?: any;
    error?: any;
    event?: string;
    data?: any;
    seq?: number;
    stateVersion?: number;
};

type RequestPromise = {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeoutId: NodeJS.Timeout;
};

export function useOpenClaw() {
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);
    const requestsRef = useRef<Map<string, RequestPromise>>(new Map());
    const listenersRef = useRef<Set<(msg: OpenClawMessage) => void>>(new Set());
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef(true);

    // Helper to reject all pending requests (e.g. on disconnect)
    const cleanupPendingRequests = useCallback((reason: string) => {
        requestsRef.current.forEach((promise, id) => {
            clearTimeout(promise.timeoutId);
            promise.reject(new Error(reason));
        });
        requestsRef.current.clear();
    }, []);

    const connect = useCallback(() => {
        if (!VPS_URL || !ADMIN_TOKEN) {
            console.error("Missing VPS_URL or ADMIN_TOKEN");
            return;
        }

        // Prevent multiple connections
        if (
            socketRef.current?.readyState === WebSocket.OPEN ||
            socketRef.current?.readyState === WebSocket.CONNECTING
        ) {
            return;
        }

        console.log("Connecting to OpenClaw VPS...");
        const ws = new WebSocket(VPS_URL);
        socketRef.current = ws;

        const CONNECT_ID = "c1";

        const sendConnect = () => {
            if (ws.readyState !== WebSocket.OPEN) return;

            const payload = {
                type: "req",
                id: CONNECT_ID,
                method: "connect",
                params: {
                    minProtocol: 3,
                    maxProtocol: 3,
                    client: {
                        id: "cli",
                        displayName: "web-admin",
                        version: "0.1.0",
                        platform: "node",
                        mode: "cli",
                    },
                    auth: { token: ADMIN_TOKEN },
                },
            };

            // Only create the promise if it doesn't exist yet.
            // If we are re-sending due to challenge, we keep the original promise waiting.
            if (!requestsRef.current.has(CONNECT_ID)) {
                console.log("Sending connect request...");

                const timeoutId = setTimeout(() => {
                    if (requestsRef.current.has(CONNECT_ID)) {
                        console.error("Handshake timed out");
                        requestsRef.current.get(CONNECT_ID)?.reject(new Error("Handshake timed out"));
                        requestsRef.current.delete(CONNECT_ID);
                        ws.close(); // Force close to trigger reconnect
                    }
                }, REQUEST_TIMEOUT);

                requestsRef.current.set(CONNECT_ID, {
                    resolve: (payload: any) => {
                        console.log("Handshake successful:", payload);
                        setIsConnected(true);
                    },
                    reject: (err: any) => {
                        console.error("Handshake failed:", JSON.stringify(err, null, 2));
                        ws.close();
                    },
                    timeoutId,
                });
            }

            ws.send(JSON.stringify(payload));
        };

        ws.onopen = () => {
            console.log("WebSocket open");
            sendConnect();
        };

        ws.onclose = () => {
            console.log("Disconnected from OpenClaw VPS");
            setIsConnected(false);
            socketRef.current = null;
            cleanupPendingRequests("Connection closed");

            // Attempt to reconnect if still mounted
            if (isMountedRef.current) {
                reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY);
            }
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };

        ws.onmessage = (event) => {
            try {
                const data: OpenClawMessage = JSON.parse(event.data);
                // console.log('WS <<', data.type, data.event || data.id || '');

                // Handle connect.challenge
                if (data.type === "event" && data.event === "connect.challenge") {
                    console.log("Received connect.challenge, re-sending connect...");
                    sendConnect();
                    return;
                }

                // Handle responses
                if (data.type === "res" && data.id) {
                    const promise = requestsRef.current.get(data.id);
                    if (promise) {
                        clearTimeout(promise.timeoutId);
                        if (data.error || data.ok === false) {
                            promise.reject(data.error || { message: "Request failed" });
                        } else {
                            promise.resolve(data.payload);
                        }
                        requestsRef.current.delete(data.id);
                    }
                }

                // Notify Listeners
                listenersRef.current.forEach((listener) => listener(data));
            } catch (err) {
                console.error("Failed to parse message:", event.data);
            }
        };
    }, [cleanupPendingRequests]);

    useEffect(() => {
        isMountedRef.current = true;
        connect();

        return () => {
            isMountedRef.current = false;
            if (socketRef.current) {
                socketRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            cleanupPendingRequests("Component unmounted");
        };
    }, [connect, cleanupPendingRequests]);

    const call = useCallback((method: string, params: any = {}) => {
        return new Promise((resolve, reject) => {
            if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
                return reject(new Error("Not connected"));
            }

            const id = crypto.randomUUID();
            const timeoutId = setTimeout(() => {
                if (requestsRef.current.has(id)) {
                    const p = requestsRef.current.get(id);
                    if (p) {
                        p.reject(new Error("Request timed out"));
                        requestsRef.current.delete(id);
                    }
                }
            }, REQUEST_TIMEOUT);

            requestsRef.current.set(id, { resolve, reject, timeoutId });

            const payload = {
                type: "req",
                id,
                method,
                params,
            };

            try {
                socketRef.current.send(JSON.stringify(payload));
            } catch (e) {
                clearTimeout(timeoutId);
                requestsRef.current.delete(id);
                reject(e);
            }
        });
    }, []);

    const subscribe = useCallback((callback: (msg: OpenClawMessage) => void) => {
        listenersRef.current.add(callback);
        return () => {
            listenersRef.current.delete(callback);
        };
    }, []);

    return { isConnected, call, subscribe };
}
