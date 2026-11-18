"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const TABS = [
  ["/admin/orders", "Orders"],
  ["/admin/activity", "Activity"],
  ["/admin/settings", "Settings"],
] as const;

// The owner's menu, with the tab for the page being shown underlined. An
// order's own page counts as Orders.
export function AdminTabs() {
  // An order's page is only known when it is asked for, so the tabs are first
  // drawn with none chosen (see "Cache Components" in the usePathname docs).
  return (
    <Suspense fallback={<Tabs />}>
      <CurrentTabs />
    </Suspense>
  );
}

function CurrentTabs() {
  return <Tabs pathname={usePathname()} />;
}

function Tabs({ pathname }: { pathname?: string }) {
  return (
    <nav className="flex gap-5 text-sm font-medium">
      {TABS.map(([href, label]) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 pb-3 transition-colors ${
              active
                ? "border-emerald-700 text-emerald-800"
                : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-900"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
