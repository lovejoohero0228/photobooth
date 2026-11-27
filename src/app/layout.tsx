import type { Metadata, Viewport } from "next";
import { Google_Sans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// 영문: Google Sans
const en = Google_Sans({ variable: "--font-en", subsets: ["latin"], weight: ["400", "500", "700"] });
// 한글: Monoplex KR (눈누 배포본)
const ko = localFont({
  variable: "--font-ko",
  display: "swap",
  src: [
    { path: "./fonts/MonoplexKR-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/MonoplexKR-Bold.woff2", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "Photos",
  description: "step behind the curtain for a black-and-white photobooth. photos stay on your device.",
  openGraph: { title: "Photos", description: "step behind the curtain for a black-and-white photobooth" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0a09",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${en.variable} ${ko.variable}`}>
      <body className="grain">{children}</body>
    </html>
  );
}
