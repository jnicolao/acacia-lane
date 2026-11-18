import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { HeaderNav } from "@/components/header-nav";
import { SHOP_NAME } from "@/lib/brand";
import { isMockMode } from "@/lib/settings";
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
  title: SHOP_NAME,
  description:
    "Kenyan coffee, tea, honey and handmade homeware, delivered to your door by PickSpot.",
};

async function MockBanner() {
  await connection(); // read the flag when the request comes in, not at build time
  if (!isMockMode()) return null;
  return (
    <div className="bg-amber-300 px-4 py-1.5 text-center text-xs font-semibold text-amber-950">
      Practice mode · Orders here are pretend. Nothing is sent to PickSpot.
    </div>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-stone-50 font-sans text-stone-900">
        <Suspense fallback={null}>
          <MockBanner />
        </Suspense>
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3.5">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-semibold tracking-tight whitespace-nowrap sm:text-lg"
            >
              <Image src="/icon.svg" alt="" width={32} height={32} className="size-7 sm:size-8" />
              {SHOP_NAME}
            </Link>
            <HeaderNav />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-stone-200 px-4 py-6 text-center text-xs text-stone-500">
          {SHOP_NAME}
          <span className="mx-2" aria-hidden>
            ·
          </span>
          <Link href="/admin/orders" className="underline hover:text-stone-700">
            Manage Shop
          </Link>
        </footer>
      </body>
    </html>
  );
}
