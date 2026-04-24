"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { 
  Home, 
  TrendingDown, 
  TrendingUp, 
  Activity, 
  GraduationCap, 
  Percent, 
  Calendar, 
  UserRound, 
  Contact, 
  Users, 
  UserCheck, 
  CreditCard, 
  UsersRound, 
  BookOpen, 
  DoorOpen, 
  Presentation, 
  FileText, 
  ClipboardList, 
  Megaphone, 
  User, 
  Settings, 
  LogOut,
  BarChart3,
  Settings2,
  CalendarCheck,
  Calculator,
  Smartphone,
  Library
} from "lucide-react";

const labelToKey: Record<string, any> = {
  "Home": "home",
  "Expenses": "expenses",
  "Incomes": "incomes",
  "Audit Log": "auditLog",
  "Results": "results",
  "Grades": "grades",
  "Timetable": "timetable",
  "Teachers": "teachers",
  "Staff": "staff",
  "Students": "students",
  "Attendance": "attendance",
  "Partial Payments": "partialPayments",
  "Profitability": "profitability",
  "Parents": "parents",
  "Subjects": "subjects",
  "Classes": "classes",
  "Lessons": "lessons",
  "Exams": "exams",
  "Assignments": "assignments",
  "Resources": "resources",
  "Announcements": "announcements",
  "Daily Reports": "dailyReports",
  "Mobile App": "mobileApp",
  "Profile": "profile",
  "Settings": "settings",
  "Logout": "logout"
};

interface MenuItem {
  icon: any; // Can be Lucide icon or string path
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
        icon: Home,
        label: "Home",
        href: "/",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: TrendingDown,
        label: "Expenses",
        href: "/list/expenses",
        visible: ["admin", "superuser"],
      },
      {
        icon: TrendingUp,
        label: "Incomes",
        href: "/list/incomes",
        visible: ["admin", "superuser"],
      },
      {
        icon: Activity,
        label: "Audit Log",
        href: "/admin/audit",
        visible: ["admin", "superuser"],
      },
      {
        icon: GraduationCap,
        label: "Results",
        href: "/list/results",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: Percent,
        label: "Grades",
        href: "/admin/grades",
        visible: ["admin", "superuser"],
      },
      {
        icon: Calendar,
        label: "Timetable",
        href: "/admin/timetable",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: UserRound,
        label: "Teachers",
        href: "/list/teachers",
        visible: ["admin", "teacher"],
      },
      {
        icon: Contact,
        label: "Staff",
        href: "/list/staff",
        visible: ["admin", "superuser"],
      },
      {
        icon: Users,
        label: "Students",
        href: "/list/students",
        visible: ["admin", "teacher"],
      },
      {
        icon: CalendarCheck,
        label: "Attendance",
        href: "/admin/attendance",
        visible: ["admin", "teacher", "superuser"],
      },
      {
        icon: CreditCard,
        label: "Partial Payments",
        href: "/list/payments-partial",
        visible: ["admin", "superuser"],
      },
      {
        icon: Calculator,
        label: "Profitability",
        href: "/admin/finance/simulator",
        visible: ["admin", "superuser"],
      },

      {
        icon: UsersRound,
        label: "Parents",
        href: "/list/parents",
        visible: ["admin", "teacher", "superuser"],
      },
      {
        icon: BookOpen,
        label: "Subjects",
        href: "/list/subjects",
        visible: ["admin", "superuser"],
      },
      {
        icon: DoorOpen,
        label: "Classes",
        href: "/list/classes",
        visible: ["admin", "teacher", "superuser"],
      },
      {
        icon: Presentation,
        label: "Lessons",
        href: "/list/lessons",
        visible: ["admin", "teacher", "superuser"],
      },
      {
        icon: FileText,
        label: "Exams",
        href: "/list/exams",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: ClipboardList,
        label: "Assignments",
        href: "/list/assignments",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: Library,
        label: "Resources",
        href: "/list/resources",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: Megaphone,
        label: "Announcements",
        href: "/list/announcements",
        visible: ["admin", "teacher", "superuser"],
      },
      {
        icon: Settings2,
        label: "Setup Requests",
        href: "/admin/setup-requests",
        visible: ["superuser"],
      },
    ],
  },
  {
    title: "OTHER",
    items: [
      {
        icon: User,
        label: "Profile",
        href: "/profile",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: BarChart3,
        label: "Daily Reports",
        href: "/admin/reports",
        visible: ["admin", "superuser"],
      },
      {
        icon: Smartphone,
        label: "Mobile App",
        href: "/admin/mobile-app",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: Settings,
        label: "Settings",
        href: "/settings",
        visible: ["admin", "teacher", "student", "parent"],
      },
      {
        icon: LogOut,
        label: "Logout",
        href: "/logout",
        visible: ["admin", "teacher", "student", "parent"],
      },
    ],
  },
];

const Menu = ({ role }: { role: string }) => {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <div className="text-sm">
      {menuItems.map((section) => (
        <div className="flex flex-col gap-2 mb-6" key={section.title}>
          <span className="hidden lg:block text-slate-400 font-bold text-[10px] tracking-widest uppercase ml-2 mb-2">
            {section.title === "MENU" ? t.menu.home : t.menu.other}
          </span>
          <div className="flex flex-col gap-1">
            {section.items.filter(item => item.visible.includes(role)).map((item) => {
              const isActive = 
                pathname === item.href || 
                (item.href === "/" && pathname === "/admin") ||
                (item.href !== "/" && pathname.startsWith(item.href));
              
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
                    {(t.menu as any)[labelToKey[item.label]] || item.label}
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

export default Menu;
