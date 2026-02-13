"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

interface DeleteSessionDialogProps {
    sessionKey: string | null;
    onOpenChange: (open: boolean) => void;
    onConfirm: (sessionKey: string) => Promise<void>;
}

export function DeleteSessionDialog({ sessionKey, onOpenChange, onConfirm }: DeleteSessionDialogProps) {
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        if (!sessionKey) return;

        setLoading(true);
        try {
            await onConfirm(sessionKey);
            onOpenChange(false);
        } catch (err: any) {
            alert(`Failed to delete session: ${err?.message || err?.code || "Unknown error"}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={!!sessionKey} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Session</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete session{" "}
                        <strong className="break-all">{sessionKey}</strong>? All messages in this
                        session will be permanently removed. This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
                        {loading ? <Loader2 className="size-4 animate-spin" /> : "Delete Session"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
