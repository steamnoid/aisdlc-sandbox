import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wellbeing Tracker",
  description: "Free-text wellbeing remarks on your personal timeline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <main className="mx-auto max-w-2xl px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
