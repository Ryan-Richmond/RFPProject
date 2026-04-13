import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "ProposalPilot — AI-Native Proposal Response",
  description:
    "Turn dense RFPs and fragmented company evidence into compliant, reviewable first-draft proposals in hours instead of days.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans antialiased", inter.variable)}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
