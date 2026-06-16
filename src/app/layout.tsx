import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = { title: "GREEN ODDS PRO", description: "Radar inteligente para odds com valor estatístico." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><AppShell>{children}</AppShell></body></html>;
}
