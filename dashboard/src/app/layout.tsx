import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "@/styles/tokens.css";
import "@/styles/theme.css";
import "@/styles/motion.css";
import "@/styles/utilities.css";
import "@/styles/components.css";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Stratnent Admin Portal",
  description: "Stratnent marketing automation and lead generation admin control center.",
  robots: {
    index: false,
    follow: false,
  },
};

import LayoutClient from './layout-client';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${plusJakarta.variable} antialiased`}
      >
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}
