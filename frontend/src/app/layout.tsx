import type { Metadata } from "next";
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sehat Saathi — Intelligent Medication Management",
  description:
    "AI-powered prescription analysis, drug interaction detection, and medication management powered by multi-agent AI. Your personal clinical pharmacist.",
  keywords: [
    "medication management",
    "drug interactions",
    "AI pharmacist",
    "prescription analysis",
    "healthcare AI",
  ],
  authors: [{ name: "Sehat Saathi Team" }],
  openGraph: {
    title: "Sehat Saathi — Intelligent Medication Management",
    description:
      "Analyze prescriptions instantly. Detect dangerous drug interactions. Get AI-powered medication guidance.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
