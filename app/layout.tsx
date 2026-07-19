import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BT OS",
  description: "Personal operating system",
  // full-screen home-screen launch with the BT icon and a dark status bar
  appleWebApp: {
    capable: true,
    title: "BT OS",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0c0e",
  // "cover" lets content extend under the notch/home-indicator so
  // env(safe-area-inset-*) is non-zero when saved to the home screen
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
