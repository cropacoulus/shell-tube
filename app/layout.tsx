import type { Metadata } from "next";
import "./globals.css";
import AppProviders from "@/app/providers";

export const metadata: Metadata = {
  title: "Verra",
  description: "Wallet-native course streaming for creators, learners, and Web3 distribution on Verra.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
