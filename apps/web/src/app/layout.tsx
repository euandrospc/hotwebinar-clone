import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

export const metadata: Metadata = {
  title: "HotWebinar",
  description: "Webinars automáticos simulando ao vivo"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased text-foreground" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-right" theme="system" />
        </ThemeProvider>
      </body>
    </html>
  );
}
