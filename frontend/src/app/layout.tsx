import type { Metadata } from "next";
import { Montserrat, Sora } from "next/font/google";
import "./globals.css";
import InvitationCenter from "@/components/watch-party/InvitationCenter";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-montserrat",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "WatchParty — Watch movies and TV shows",
  description: "Explore trending movies, TV shows, and more.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${sora.variable}`}>
      <body><InvitationCenter>{children}</InvitationCenter></body>
    </html>
  );
}
