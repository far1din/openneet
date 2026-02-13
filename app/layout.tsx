import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { GatewayProvider } from "@/lib/client/gateway-context";

const dmSans = DM_Sans({
    variable: "--font-dm-sans",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "OpenNeet",
    description: "OpenNeet",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body className={`${dmSans.className} antialiased`}>
                <GatewayProvider>{children}</GatewayProvider>
            </body>
        </html>
    );
}
