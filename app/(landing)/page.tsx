"use client";

import { useState } from "react";

import ChatWindow from "./components/chat-window";
import SessionList from "./components/session-list";

export default function Home() {
    const [activeSession, setActiveSession] = useState<string | null>(null);

    return (
        <main className="flex h-screen w-full bg-background flex-col md:flex-row overflow-hidden relative">
            <div className="w-full md:w-80 h-1/3 md:h-full flex-shrink-0 shadow-xl z-20 md:shadow-none bg-background">
                <SessionList onSelectSession={setActiveSession} activeSessionKey={activeSession || undefined} />
            </div>
            <div className="flex-1 h-2/3 md:h-full border-t md:border-t-0 md:border-l border-border relative z-10 bg-background">
                <ChatWindow sessionKey={activeSession} />
            </div>
        </main>
    );
}
