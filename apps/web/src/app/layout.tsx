import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HotWebinar",
  description: "Webinars automáticos simulando ao vivo"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
