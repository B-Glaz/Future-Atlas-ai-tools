import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { AuthProvider } from "@/components/auth/AuthGate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Future Atlas",
  description: "Study-abroad planning tools and guidance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col"
        suppressHydrationWarning
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
      <Script
        id="pagesenseCode"
        strategy="afterInteractive"
        src="https://cdn-in.pagesense.io/js/onewindow/42f611b451ab4de4a126d343bc30d3d1.js"
      />
    </html>
  );
}
