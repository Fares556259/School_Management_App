"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Settings2,
  LogOut,
  LayoutDashboard
} from "lucide-react";

interface MenuItem {
  icon: any; 
  label: string;
  href: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const superadminMenu: MenuSection[] = [
  {
    title: "PLATFORM MANAGEMENT",
    items: [
      {
        icon: Settings2,
        label: "Setup Requests",
        href: "/superadmin",
      },
    ],
  },
  {
    title: "TOOLS",
    items: [
      {
        icon: LayoutDashboard,
        label: "School Dashboard",
        href: "/admin",
      },
      {
        icon: LogOut,
        label: "Logout",
        href: "/logout",
      },
    ],
  },
];

const SuperadminMenu = () => {
  const pathname = usePathname();

  return (
    <div className="text-sm">
      {superadminMenu.map((section) => (
        <div className="flex flex-col gap-2 mb-6" key={section.title}>
          <span className="hidden lg:block text-slate-400 font-bold text-[10px] tracking-widest uppercase ml-2 mb-2">
            {section.title}
          </span>
          <div className="flex flex-col gap-1">
            {section.items.map((item) => {
              const isActive = 
                pathname === item.href || 
                (item.href === "/superadmin" && pathname === "/superadmin");
              
              return (
                <Link
                  href={item.href}
                  key={item.label}
                  className={`flex items-center justify-center lg:justify-start gap-4 py-2.5 px-3 rounded-2xl transition-all duration-300 group relative overflow-hidden ${
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                      : "text-slate-500 hover:bg-primary/5 hover:text-primary"
                  }`}
                >
                  {/* Active Indicator */}
                  <div className={`absolute left-0 top-1/4 bottom-1/4 w-1 bg-white rounded-r-full transition-transform duration-300 ${
                    isActive ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100 group-hover:bg-primary/40"
                  }`} />
                  
                  <div className={`transition-all duration-300 ${
                    isActive 
                      ? "opacity-100 scale-110 text-white" 
                      : "opacity-60 group-hover:opacity-100 group-hover:scale-110 text-slate-500 group-hover:text-primary"
                  }`}>
                    {typeof item.icon === 'string' ? (
                      <div className="relative w-[22px] h-[22px]">
                         <Image 
                           src={item.icon} 
                           alt="" 
                           fill
                           className={isActive ? "brightness-200" : ""}
                         />
                      </div>
                    ) : (
                      <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                    )}
                  </div>
                  <span className={`hidden lg:block font-bold tracking-tight ${isActive ? "translate-x-1" : ""} transition-transform duration-300`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SuperadminMenu;
