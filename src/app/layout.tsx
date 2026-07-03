import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/logout/actions";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Called It",
  description: "A personal decision journal with calibrated forecasting.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let dueCount = 0;
  if (user) {
    const { count } = await supabase
      .from("checkins")
      .select("id", { count: "exact", head: true })
      .eq("status", "due");
    dueCount = count ?? 0;
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {user ? (
          <header className="flex items-center justify-between border-b border-border px-4 py-2">
            <Link href="/due" className="text-sm text-muted-foreground hover:text-foreground">
              Due{dueCount > 0 ? ` (${dueCount})` : ""}
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </header>
        ) : null}
        {children}
      </body>
    </html>
  );
}
