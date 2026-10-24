import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import {AdminNav} from "@/components/admin-nav";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return (
    <div className="admin-shell min-h-screen">
      <a className="admin-skip" href="#admin-content">К содержимому</a>
      <header className="admin-header">
        <div className="admin-header-inner">
          <Link className="admin-brand" href="/admin"><span>DOM<span>KAZAN</span></span><small>Calendar</small></Link>
          <AdminNav/>
        </div>
      </header>
      <main id="admin-content" className="admin-main" tabIndex={-1}>{children}</main>
    </div>
  );
}
