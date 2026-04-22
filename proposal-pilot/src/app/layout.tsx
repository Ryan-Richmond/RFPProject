import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: {
    default: "ProposalPilot | AI-Native Proposal Response",
    template: "%s | ProposalPilot",
  },
  description:
    "Turn dense RFPs and fragmented company evidence into compliant, reviewable first-draft proposals in hours instead of days.",
  openGraph: {
    title: "ProposalPilot | AI-Native Proposal Response",
    description:
      "Evidence-first proposal automation for GovCon teams, powered by Perplexity APIs and built for Vercel.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ProposalPilot | AI-Native Proposal Response",
    description:
      "Evidence-first proposal automation for GovCon teams, powered by Perplexity APIs and built for Vercel.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="font-sans antialiased">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
