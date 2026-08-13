import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * Fonts are VENDORED in app/fonts/ (latin subsets, fetched from Google Fonts
 * at author time) and loaded with next/font/local: `next build` must succeed
 * with no network — next/font/google fetches at build time and fails the
 * whole build offline (.sol/requests/phase2-build-blockers.md, R-14).
 */
const fraunces = localFont({
  src: "./fonts/fraunces-latin-var.woff2", // variable: wght 100-900, opsz, SOFT
  variable: "--font-fraunces",
  weight: "100 900",
  display: "swap",
});

const plexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Attest",
  description:
    "Pharmacogenomic prescribing checks with a regulator-legible audit trail.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
