import type { Metadata } from "next";
import "./globals.css";
import AppProviders from "@/app/providers";

export const metadata: Metadata = {
  title: "Shelby Stream",
  description: "Wallet-native course streaming for creators, learners, and Web3 distribution.",
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
