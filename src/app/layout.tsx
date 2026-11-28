import type { Metadata, Viewport } from "next";
import { Questrial } from "next/font/google";
import "./globals.css";

// 영문: Questrial (SIL OFL 1.1). 굵기는 Regular(400) 하나뿐이라, 화면의 모든 굵기를 400으로 맞췄다
const en = Questrial({ variable: "--font-en", subsets: ["latin"], weight: "400" });

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
    <html lang="en" className={en.variable}>
      <body className="grain">{children}</body>
    </html>
  );
}
