"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";

const items=[{href:"/admin",label:"Шахматка",path:"M4 3h16v18H4zM8 1v4M16 1v4M4 9h16M8 13h2M14 13h2M8 17h2M14 17h2"},
  {href:"/admin/houses",label:"Дома",path:"M3 11 12 3l9 8M5 9v12h14V9M9 21v-7h6v7"},
  {href:"/admin/requests",label:"Заявки",path:"M4 4h16v16H4zM4 13h4l2 3h4l2-3h4M8 8h8"}];

export function AdminNav(){
  const pathname=usePathname();
  return <nav className="admin-nav" aria-label="Администрирование">{items.map(item=>{
    const active=item.href==="/admin"?pathname==="/admin":pathname.startsWith(item.href);
    return <Link key={item.href} href={item.href} aria-current={active?"page":undefined}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.path}/></svg>{item.label}</Link>;
  })}<form action="/api/admin/logout" method="post"><button type="submit">Выйти</button></form></nav>;
}
