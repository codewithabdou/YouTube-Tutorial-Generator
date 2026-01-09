import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TubeTutor - Free YouTube Tutorial Generator",
  description:
    "Transform any YouTube coding tutorial into beautiful, readable documentation. Powered by AI. 100% free with no API costs.",
  keywords: [
    "YouTube tutorial",
    "code documentation",
    "AI tutorial generator",
    "developer tools",
    "free coding tutorials",
  ],
  openGraph: {
    title: "TubeTutor - Free YouTube Tutorial Generator",
    description:
      "Transform any YouTube coding tutorial into beautiful, readable documentation. Powered by AI.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
