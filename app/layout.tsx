import type { Metadata } from "next";
import "./globals.css";
import { RoboAssistant } from "@/components/RoboAssistant";

export const metadata: Metadata = {
  title: "Postoll",
  description:
    "Create, schedule and publish social media content with AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <RoboAssistant />
      </body>
    </html>
  );
}
