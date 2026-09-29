import type { Metadata } from "next";
import { CustomCursor } from "@/components/ui/custom-cursor";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrunaFlow AI — Automação inteligente",
  description: "Plataforma demonstrativa de automações empresariais com IA.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <CustomCursor />
        {children}
      </body>
    </html>
  );
}
