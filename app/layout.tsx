import type { Metadata } from "next";
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
