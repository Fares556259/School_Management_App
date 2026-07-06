"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutList, LogOut } from "lucide-react";

const navItems = [
  { icon: LayoutList, label: "Applications", href: "/superadmin" },
];

const SuperadminMenu = () => {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full text-sm">
      {/* Main nav */}
      <div className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center justify-center lg:justify-start gap-3 py-2.5 px-3 rounded-xl transition-all duration-200 relative overflow-hidden ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-[3px] bg-white/50 rounded-r-full" />
              )}
              <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span className="hidden lg:block font-semibold tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Logout pinned to bottom */}
      <div className="pt-4 border-t border-slate-100 mt-auto">
        <Link
          href="/logout"
          className="flex items-center justify-center lg:justify-start gap-3 py-2.5 px-3 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all duration-200"
        >
          <LogOut size={18} strokeWidth={2} />
          <span className="hidden lg:block font-semibold tracking-tight">Logout</span>
        </Link>
      </div>
    </div>
  );
};

export default SuperadminMenu;
