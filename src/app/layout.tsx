import type { Metadata } from "next";
import { Sidebar } from "@/components/ui/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Call Stream AI — Onboarding",
  description:
    "Property onboarding platform for Call Stream AI, the #1 hospitality AI platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-cs-bg text-cs-text-primary min-h-screen">
        <Sidebar />
        <main className="ml-56 min-h-screen">
          <div className="p-8">{children}</div>
        </main>
      </body>
    </html>
  );
}
