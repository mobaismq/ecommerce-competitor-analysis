import { PageHeader } from "@/app/components/PageHeader";

export function AccountManagement() {
  return (
    <div className="p-6">
      <PageHeader breadcrumbs={[{ label: "设置" }, { label: "账号管理" }]} />
      <div className="rounded-xl bg-white p-6 text-[#86909C]">
        <p>账号管理页面开发中...</p>
      </div>
    </div>
  );
}
