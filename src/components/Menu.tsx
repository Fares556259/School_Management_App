"use client";

import Image from "next/image";
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
  items: MenuItem[];
}

const menuItems: MenuSection[] = [
  {
    title: "MENU",
    items: [
      {
        icon: "/home.png",
        label: "Home",
        href: "/",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/setting.png",
        label: "Audit Log",
        href: "/admin/audit",
        visible: ["admin"],
      },
      {
        icon: "/result.png",
        label: "Grades",
        href: "/admin/grades",
        visible: ["admin"],
      },
      {
        icon: "/finance.png",
        label: "Incomes",
        href: "/list/incomes",
        visible: ["admin"],
      },
      {
        icon: "/finance.png",
        label: "Expenses",
        href: "/list/expenses",
        visible: ["admin"],
      },
      {
        icon: "/teacher.png",
        label: "Teachers",
        href: "/list/teachers",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/parent.png",
        label: "Staff",
        href: "/list/staff",
        visible: ["admin"],
      },
      {
        icon: "/student.png",
        label: "Students",
        href: "/list/students",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/parent.png",
        label: "Parents",
        href: "/list/parents",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/subject.png",
        label: "Subjects",
        href: "/list/subjects",
        visible: ["admin"],
      },
      {
        icon: "/class.png",
        label: "Classes",
        href: "/list/classes",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/lesson.png",
        label: "Lessons",
        href: "/list/lessons",
        visible: ["admin", "teacher"],
      },
      {
        icon: "/exam.png",
        label: "Exams",
        href: "/list/exams",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/assignment.png",
        label: "Assignments",
        href: "/list/assignments",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/result.png",
        label: "Results",
        href: "/list/results",
        visible: ["admin", "teacher", "student", "parent"],
      },
    ],
  },
  {
    title: "OTHER",
    items: [
      {
        icon: "/profile.png",
        label: "Profile",
        href: "/profile",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/setting.png",
        label: "Settings",
        href: "/settings",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: "/logout.png",
        label: "Logout",
        href: "/logout",
        visible: ["admin", "teacher", "student", "parent"],
      },
    ],
  },
];

const Menu = ({ role }: { role: string }) => {
  const pathname = usePathname();

  return (
    <div className="mt-6 text-sm px-4">
      {menuItems.map((section) => (
        <div className="flex flex-col gap-2 mb-6" key={section.title}>
          <span className="hidden lg:block text-slate-400 font-bold text-[10px] tracking-widest uppercase ml-2 mb-2">
            {section.title}
          </span>
          {section.items.map((item) => {
            if (item.visible.includes(role)) {
              const isActive = 
                pathname === item.href || 
                (item.href === "/" && pathname === "/admin") ||
                (item.href !== "/" && pathname.startsWith(item.href));
              
              return (
                <Link
                  href={item.href}
                  key={item.label}
                  className={`flex items-center justify-center lg:justify-start gap-4 py-3 px-3 rounded-2xl transition-all duration-300 group relative overflow-hidden ${
                    isActive 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                      : "text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                  }`}
                >
                  {/* Active Indicator */}
                  <div className={`absolute left-0 top-1/4 bottom-1/4 w-1 bg-white rounded-r-full transition-transform duration-300 ${
                    isActive ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100 group-hover:bg-indigo-400"
                  }`} />
                  
                  <Image
                    src={item.icon}
                    alt=""
                    width={22}
                    height={22}
                    className={`transition-all duration-300 ${
                      isActive ? "opacity-100 brightness-200" : "opacity-60 group-hover:opacity-100"
                    } group-hover:scale-110`}
                  />
                  <span className={`hidden lg:block font-bold tracking-tight ${isActive ? "translate-x-1" : ""} transition-transform duration-300`}>
                    {item.label}
                  </span>
                </Link>
              );
            }
          })}
        </div>
      ))}
    </div>
  );
};

export default Menu;
