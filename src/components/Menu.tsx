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
  Library,
  Sparkles
} from "lucide-react";

const labelToKey: Record<string, any> = {
  "Home": "home",
  "Expenses": "expenses",
  "Incomes": "incomes",
  "Audit Log": "auditLog",
  "Results": "results",
  "Grades": "grades",
  "Timetable": "timetable",
  "AI Scheduler": "aiScheduler",
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
    title: "MAIN",
    items: [
      { icon: Home, label: "Home", href: "/", visible: ["admin", "teacher", "student", "parent"] }
    ],
  },
  {
    title: "ACADEMICS",
    items: [
      { icon: Calendar, label: "Timetable", href: "/admin/timetable", visible: ["admin", "teacher", "student", "parent"] },
      { icon: FileText, label: "Exams", href: "/list/exams", visible: ["admin", "teacher", "student", "parent"] },
      { icon: Sparkles, label: "AI Scheduler", href: "/admin/timetable/ai", visible: ["admin"] },
      { icon: DoorOpen, label: "Classes", href: "/list/classes", visible: ["admin", "teacher", "superuser"] },
      { icon: BookOpen, label: "Subjects", href: "/list/subjects", visible: ["admin", "superuser"] },
      { icon: ClipboardList, label: "Assignments", href: "/list/assignments", visible: ["admin", "teacher", "student", "parent"] },
      { icon: GraduationCap, label: "Results", href: "/list/results", visible: ["admin", "teacher", "student", "parent"] },
      { icon: Percent, label: "Grades", href: "/admin/grades", visible: ["admin", "superuser"] },
      { icon: Library, label: "Resources", href: "/list/resources", visible: ["admin", "teacher", "student", "parent"] },
    ],
  },
  {
    title: "PEOPLE",
    items: [
      { icon: Users, label: "Students", href: "/list/students", visible: ["admin", "teacher"] },
      { icon: UsersRound, label: "Parents", href: "/list/parents", visible: ["admin", "teacher", "superuser"] },
      { icon: UserRound, label: "Teachers", href: "/list/teachers", visible: ["admin", "teacher"] },
      { icon: Contact, label: "Staff", href: "/list/staff", visible: ["admin", "superuser"] },
    ],
  },
  {
    title: "FINANCE",
    items: [
      { icon: TrendingUp, label: "Incomes", href: "/list/incomes", visible: ["admin", "superuser"] },
      { icon: TrendingDown, label: "Expenses", href: "/list/expenses", visible: ["admin", "superuser"] },
      { icon: CreditCard, label: "Partial Payments", href: "/list/payments-partial", visible: ["admin", "superuser"] },
      { icon: Calculator, label: "Profitability", href: "/admin/finance/simulator", visible: ["admin", "superuser"] },
      { icon: Activity, label: "Audit Log", href: "/admin/audit", visible: ["admin", "superuser"] },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { icon: CalendarCheck, label: "Attendance", href: "/admin/attendance", visible: ["admin", "teacher", "superuser"] },
      { icon: Megaphone, label: "Announcements", href: "/list/announcements", visible: ["admin", "teacher", "superuser"] },
      { icon: BarChart3, label: "Daily Reports", href: "/admin/reports", visible: ["admin", "superuser"] },
      { icon: Smartphone, label: "Mobile App", href: "/admin/mobile-app", visible: ["admin", "teacher", "student", "parent"] },
      { icon: Settings2, label: "Setup Requests", href: "/admin/setup-requests", visible: ["superuser"] },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { icon: User, label: "Profile", href: "/profile", visible: ["admin", "teacher", "student", "parent"] },
      { icon: Settings, label: "Settings", href: "/settings", visible: ["admin", "teacher", "student", "parent"] },
      { icon: LogOut, label: "Logout", href: "/logout", visible: ["admin", "teacher", "student", "parent"] },
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
            {(t.menu as any)?.[section.title.toLowerCase()] || section.title}
          </span>
          <div className="flex flex-col gap-1">
            {section.items.filter(item => item.visible.includes(role)).map((item) => {
              const targetHref = item.href === "/" ? `/${role === "superuser" ? "admin" : role}` : item.href;
              const isActive = 
                pathname === targetHref || 
                (item.href !== "/" && pathname.startsWith(item.href) && (item.href !== "/admin/timetable" || pathname === "/admin/timetable"));
              
              return (
                <Link
                  href={targetHref}
                  key={item.label}
                  className={`flex items-center justify-center lg:justify-start gap-3 py-2.5 px-3 rounded-[12px] transition-all duration-200 group relative ${
                    isActive 
                      ? "bg-white text-[#181d26] shadow-sm font-semibold border border-[#e5e7eb]" 
                      : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900 font-medium"
                  }`}
                >
                  <div className={`transition-all duration-200 ${
                    isActive 
                      ? "text-[#181d26]" 
                      : "text-slate-500 group-hover:text-slate-900"
                  }`}>
                    {typeof item.icon === 'string' ? (
                      <div className="relative w-[22px] h-[22px]">
                         <Image 
                           src={item.icon} 
                           alt="" 
                           fill
                           className={isActive ? "brightness-0" : "opacity-60"}
                         />
                      </div>
                    ) : (
                      <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    )}
                  </div>
                  <span className={`hidden lg:block tracking-tight transition-transform duration-200`}>
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
