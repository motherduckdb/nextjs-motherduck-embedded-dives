import type { Metadata } from "next";
import "./globals.css";
import MdAccessIndicator from "./md-access-indicator";

export const metadata: Metadata = {
  title: "Embedded Dives: vibecodable data apps",
  description:
    "Demo app for user-defined, AI-powered analytics UIs using MotherDuck embedded Dives",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="h-full flex flex-col overflow-hidden">
        {children}
        <MdAccessIndicator />
      </body>
    </html>
  );
}
