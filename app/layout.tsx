import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { PageTransition } from "@/components/PageTransition";
import { PerspectiveProvider } from "@/lib/perspective-context";
import { ToastProvider } from "@/lib/toast-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Auth0 SDR Research Agent",
  description: "Autonomous SDR research agent for Auth0 CIAM opportunities",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <PerspectiveProvider>
          <ToastProvider>
            <AppShell>
              <PageTransition>
                {children}
              </PageTransition>
            </AppShell>
          </ToastProvider>
        </PerspectiveProvider>
      </body>
    </html>
  );
}
