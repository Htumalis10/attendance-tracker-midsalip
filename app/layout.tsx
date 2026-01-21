import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"
import { PWAProvider } from "@/components/pwa-provider"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "ZDSPGC SmartCode - Attendance System",
  description: "QR-Based Attendance Tracking System for Zamboanga del Sur Provincial Government College",
  generator: "v0.app",
  manifest: "/manifest.json",
  keywords: ["attendance", "qr code", "tracking", "ZDSPGC", "school"],
  authors: [{ name: "ZDSPGC IT Department" }],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SmartCode",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "ZDSPGC SmartCode",
    title: "ZDSPGC SmartCode - Attendance System",
    description: "QR-Based Attendance Tracking System for Zamboanga del Sur Provincial Government College",
  },
  twitter: {
    card: "summary",
    title: "ZDSPGC SmartCode - Attendance System",
    description: "QR-Based Attendance Tracking System for Zamboanga del Sur Provincial Government College",
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: [
      { url: "/apple-icon.png" },
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SmartCode" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className={`font-sans antialiased`}>
        <PWAProvider>
          {children}
        </PWAProvider>
        <Toaster position="top-right" richColors closeButton />
        <Analytics />
      </body>
    </html>
  )
}
