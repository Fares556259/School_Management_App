"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface MenuItem {
  icon: string;
  label: string;
  href: string;
  visible: string[];
}

interface MenuSection {
  title: string;
  accent: string;
  items: MenuItem[];
}

// Emoji-based icons (no .png dependency)
const menuSections: MenuSection[] = [
  {
    title: "Financial Hub",
    accent: "bg-indigo-500",
    items: [
      { icon: "⊞", label: "Dashboard", href: "/admin", visible: ["admin"] },
      { icon: "📊", label: "Finance", href: "/admin/finance", visible: ["admin"] },
      { icon: "🧾", label: "Audit Log", href: "/admin/audit", visible: ["admin"] },
      { icon: "📈", label: "Grades", href: "/admin/grades", visible: ["admin"] },
      { icon: "💰", label: "Incomes", href: "/list/incomes", visible: ["admin"] },
      { icon: "💸", label: "Expenses", href: "/list/expenses", visible: ["admin"] },
    ],
  },
  {
    title: "People",
    accent: "bg-violet-500",
    items: [
      { icon: "👨‍🏫", label: "Teachers", href: "/list/teachers", visible: ["admin", "teacher"] },
      { icon: "🎓", label: "Students", href: "/list/students", visible: ["admin", "teacher"] },
      { icon: "👤", label: "Staff", href: "/list/staff", visible: ["admin"] },
      { icon: "👨‍👩‍👧", label: "Parents", href: "/list/parents", visible: ["admin", "teacher"] },
    ],
  },
  {
    title: "Operations",
    accent: "bg-emerald-500",
    items: [
      { icon: "🗓️", label: "Timetable", href: "/admin/timetable", visible: ["admin", "teacher", "student", "parent"] },
      { icon: "📚", label: "Subjects", href: "/list/subjects", visible: ["admin"] },
      { icon: "🏛️", label: "Classes", href: "/list/classes", visible: ["admin", "teacher"] },
      { icon: "📖", label: "Lessons", href: "/list/lessons", visible: ["admin", "teacher"] },
      { icon: "📝", label: "Exams", href: "/list/exams", visible: ["admin", "teacher", "student", "parent"] },
      { icon: "📋", label: "Assignments", href: "/list/assignments", visible: ["admin", "teacher", "student", "parent"] },
      { icon: "🏆", label: "Results", href: "/list/results", visible: ["admin", "teacher", "student", "parent"] },
    ],
  },
];

const Menu = ({ role }: { role: string }) => {
  const pathname = usePathname();

  return (
    <div className="mt-4 text-sm flex flex-col gap-1 px-2">
      {menuSections.map((section) => {
        const visibleItems = section.items.filter((item) => item.visible.includes(role));
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.title} className="mb-4">
            {/* Section Header */}
            <div className="hidden lg:flex items-center gap-2 mb-2 px-2">
              <div className={`w-1.5 h-1.5 rounded-full ${section.accent}`} />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.12em]">
                {section.title}
              </span>
            </div>

            {/* Items */}
            <div className="flex flex-col gap-0.5">
              {visibleItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href === "/admin" && pathname === "/admin") ||
                  (item.href !== "/admin" && item.href !== "/" && pathname.startsWith(item.href));

                return (
                  <Link
                    href={item.href}
                    key={item.label}
                    className={`flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    }`}
                  >
                    <span
                      className={`text-base shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                        isActive ? "grayscale-0" : "opacity-70"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span
                      className={`hidden lg:block font-semibold tracking-tight text-sm ${
                        isActive ? "text-white" : ""
                      }`}
                    >
                      {item.label}
                    </span>
                    {isActive && (
                      <div className="absolute right-2 hidden lg:block w-1.5 h-1.5 rounded-full bg-white/60" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Bottom Section: Profile & Logout */}
      <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-0.5">
        <Link
          href="/profile"
          className="flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all duration-200 group"
        >
          <span className="text-base opacity-70 group-hover:scale-110 transition-transform">👤</span>
          <span className="hidden lg:block font-semibold tracking-tight text-sm">Profile</span>
        </Link>
        <Link
          href="/settings"
          className="flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all duration-200 group"
        >
          <span className="text-base opacity-70 group-hover:scale-110 transition-transform">⚙️</span>
          <span className="hidden lg:block font-semibold tracking-tight text-sm">Settings</span>
        </Link>
      </div>
    </div>
  );
};

export default Menu;
