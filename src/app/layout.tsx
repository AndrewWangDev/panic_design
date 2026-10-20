import type { Metadata } from "next";
import "./globals.css";

import { SessionProvider } from "next-auth/react";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: {
    default: "Panic Design | AI-Driven Edge Chaos Gateway Console",
    template: "%s | Panic Design",
  },
  description: "Zero-intrusion AIOps edge gateway. Automated chaos parameter generation and visualized physical routing trajectories.",
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ]
  },
  manifest: '/site.webmanifest'
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cdn.andrewwangdev.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://cdn.andrewwangdev.com/fonts/css2" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('theme') === 'light' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: light)').matches)) {
                  document.documentElement.setAttribute('data-theme', 'light');
                } else {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body>
        <SessionProvider>
          <Navbar />
          <main style={{ paddingTop: '70px' }}>
            {children}
          </main>
        </SessionProvider>
      </body>
    </html>
  );
}
