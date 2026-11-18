"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { useCart } from "./use-cart";

// The shop's menu in the header, with the page being shown in green. Checkout
// counts as Cart.
export function HeaderNav() {
  // Some pages (an order's page) are only known when they are asked for, so
  // the menu is first drawn with nothing chosen (see "Cache Components" in the
  // usePathname docs).
  return (
    <Suspense fallback={<Nav />}>
      <CurrentNav />
    </Suspense>
  );
}

function CurrentNav() {
  return <Nav pathname={usePathname()} />;
}

function Nav({ pathname }: { pathname?: string }) {
  const { count } = useCart();
  return (
    <nav className="ml-auto flex items-center gap-3 text-sm font-medium whitespace-nowrap sm:gap-5">
      <NavLink href="/" active={pathname === "/"}>
        Shop
      </NavLink>
      <NavLink href="/cart" active={pathname === "/cart" || pathname === "/checkout"}>
        Cart
        {count > 0 && (
          <span className="ml-1.5 rounded-full bg-emerald-700 px-2 py-0.5 text-xs text-white">
            {count}
          </span>
        )}
      </NavLink>
    </nav>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`transition-colors ${
        active ? "text-emerald-800" : "text-stone-500 hover:text-stone-900"
      }`}
    >
      {children}
    </Link>
  );
}
