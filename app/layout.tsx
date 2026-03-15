import type { Metadata } from "next";
import "./globals.css";
import AppProviders from "@/app/providers";

export const metadata: Metadata = {
  title: "Stream P2P - Architecture Blueprint",
  description: "Netflix-style streaming platform blueprint using Next.js and Shelby protocol.",
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
