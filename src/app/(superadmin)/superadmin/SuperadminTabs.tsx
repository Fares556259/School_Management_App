"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SuperadminTabs() {
  const pathname = usePathname();

  const tabs = [
    { name: "Applications", href: "/superadmin", exact: true },
    { name: "Subscriptions", href: "/superadmin/subscriptions", exact: false },
  ];

  return (
    <div className="hidden sm:flex items-center gap-1">
      {tabs.map((tab) => {
        const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.name}
            href={tab.href}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              isActive
                ? "bg-slate-100 text-slate-800"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
