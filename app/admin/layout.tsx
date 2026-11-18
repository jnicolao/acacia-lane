import { AdminTabs } from "@/components/admin-tabs";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <div className="mb-4 flex flex-col flex-wrap gap-x-6 gap-y-4 border-b border-stone-200">
        <AdminTabs />
      </div>
      {children}
    </>
  );
}
