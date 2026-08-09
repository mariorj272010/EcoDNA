import { Big_Shoulders, Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import "./field-survey.css";
import "./original-landing.css";

const displayFont = Big_Shoulders({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-display", display: "swap" });
const bodyFont = Archivo({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-body", display: "swap" });
const monoFont = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-mono", display: "swap" });

export const metadata = {
  title: "EcoDNA",
  description: "Turn litter photos into a logged, verified neighborhood waste record."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}><body>{children}</body></html>;
}
