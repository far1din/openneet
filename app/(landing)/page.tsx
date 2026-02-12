"use client";

import { useState } from "react";
import { AppSidebar } from "./components/app-sidebar";
import ChatWindow from "./components/chat-window";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function Home() {
    const [activeSession, setActiveSession] = useState<string | null>(null);

    return (
        <SidebarProvider style={{ height: "100vh", overflow: "hidden" }}>
            <AppSidebar onSelectSession={setActiveSession} activeSessionKey={activeSession} />
            <SidebarInset className="flex flex-col h-full overflow-hidden">
                <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-background z-10">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href="#">OpenClaw</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbPage>{activeSession ? "Chat" : "Dashboard"}</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </header>
                <div className="flex flex-1 flex-col overflow-hidden bg-background min-h-0">
                    <ChatWindow sessionKey={activeSession} />
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
