import Link from "next/link";

const TABS = [
  ["/admin/orders", "Orders"],
  ["/admin/activity", "Activity"],
  ["/admin/settings", "Settings"],
] as const;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-stone-200 pb-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Manage shop
        </span>
        <nav className="flex gap-5 text-sm font-medium">
          {TABS.map(([href, label]) => (
            <Link key={href} href={href} className="hover:text-emerald-700">
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </>
  );
}
