import type { Metadata } from "next";
import { Shippori_Mincho } from "next/font/google";
import "./globals.css";

// Deliberate heading face: Shippori Mincho — a letterpress-warm Japanese
// mincho that carries the 民宿 paper-and-ink feel for headings and coach
// notes. Latin slice is preloaded; the JA glyph slices stream on demand
// via unicode-range.
const shippori = Shippori_Mincho({
  variable: "--font-shippori",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "minshuku — today’s episode",
  description:
    "A daily Japanese story: play tonight’s scene at the guesthouse and your due words come back to you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${shippori.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
