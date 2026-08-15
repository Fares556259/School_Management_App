"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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
  Sparkles,
  CircleHelp,
  MoreVertical,
  ChevronDown
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
  "Help & Support": "helpSupport",
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
      { icon: GraduationCap, label: "Results", href: "/list/results", visible: ["admin", "teacher", "student", "parent"] },
      { icon: Percent, label: "Grades", href: "/admin/grades", visible: ["admin", "superuser"] },
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
      { icon: ClipboardList, label: "Assignments", href: "/list/assignments", visible: ["admin", "teacher", "student", "parent"] },
      { icon: Library, label: "Resources", href: "/list/resources", visible: ["admin", "teacher", "student", "parent"] },
      { icon: Megaphone, label: "Announcements", href: "/list/announcements", visible: ["admin", "teacher", "student", "parent", "superuser"] },
      { icon: BarChart3, label: "Daily Reports", href: "/admin/reports", visible: ["admin", "superuser"] },

      { icon: Settings2, label: "Setup Requests", href: "/admin/setup-requests", visible: ["superuser"] },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { icon: User, label: "Profile", href: "/profile", visible: ["admin", "teacher", "student", "parent"] },
      { icon: Settings, label: "Settings", href: "/settings", visible: ["admin", "teacher", "student", "parent"] },
      { icon: CircleHelp, label: "Help & Support", href: "/help", visible: ["admin", "teacher", "student", "parent"] },
      { icon: LogOut, label: "Logout", href: "/logout", visible: ["admin", "teacher", "student", "parent"] },
    ],
  },
];

const Menu = ({ role, adminData }: { role?: string, adminData?: any }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    // Reset pending state when pathname changes (navigation completes)
    setPendingHref(null);
  }, [pathname]);

  const fullName = adminData?.name || adminData?.surname 
    ? `${adminData.name || ""} ${adminData.surname || ""}`.trim() 
    : "User";

  // Normalize role so superadmin/superuser can view admin & superuser items
  const isSuper = role === "superadmin" || role === "superuser";
  const activeRoles = isSuper ? ["superadmin", "superuser", "admin"] : [role];

  // State for collapsible sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Auto-expand sections containing the active item
  useEffect(() => {
    const newExpanded = { ...expandedSections };
    let changed = false;

    menuItems.forEach(section => {
      if (section.title === "MAIN") return;
      
      const hasActive = section.items.some(item => {
        const targetHref = item.href === "/" ? (isSuper ? "/superadmin" : `/${role}`) : item.href;
        return (pendingHref ? pendingHref === targetHref : pathname === targetHref) || 
               (item.href !== "/" && (pendingHref || pathname).startsWith(item.href) && (item.href !== "/admin/timetable" || (pendingHref || pathname) === "/admin/timetable"));
      });

      if (hasActive && !newExpanded[section.title]) {
        newExpanded[section.title] = true;
        changed = true;
      }
    });

    if (changed) {
      setExpandedSections(newExpanded);
    }
  }, [pathname, pendingHref, role, isSuper]);

  const toggleSection = (title: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  return (
    <div className="flex flex-col min-h-full h-full text-sm pb-4">
      {/* 1. Render MAIN section items directly as standalone buttons at the top */}
      <div className="flex flex-col gap-1 mb-6 px-2">
        {menuItems.find(s => s.title === "MAIN")?.items
          .filter(item => item.visible.some(v => activeRoles.includes(v)))
          .map(item => {
            const targetHref = item.href === "/" ? (isSuper ? "/superadmin" : `/${role}`) : item.href;
            const isActive = (pendingHref ? pendingHref === targetHref : pathname === targetHref);
            
            return (
              <Link
                href={targetHref}
                prefetch={true}
                onClick={() => setPendingHref(targetHref)}
                onMouseEnter={() => router.prefetch(targetHref)}
                key={item.label}
                className={`flex items-center justify-center lg:justify-start gap-3 py-3 px-4 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                  isActive 
                    ? "bg-[#2563eb] text-white shadow-md font-semibold" 
                    : "text-white/80 hover:bg-white/10 hover:text-white font-medium"
                }`}
              >
                <div className="transition-all duration-200">
                  <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="hidden lg:block tracking-tight text-[15px]">
                  {(t.menu as any)[labelToKey[item.label]] || item.label}
                </span>
              </Link>
            );
        })}
      </div>

      {/* 2. Render other sections as collapsibles */}
      <div className="flex flex-col gap-2 flex-1 px-2">
        {menuItems.filter(s => s.title !== "MAIN").map((section) => {
          const isSystem = section.title === "SYSTEM";
          const isExpanded = expandedSections[section.title];
          const visibleItems = section.items.filter(item => item.visible.some(v => activeRoles.includes(v)));
          
          if (visibleItems.length === 0) return null;

          return (
            <div className={`flex flex-col ${isSystem ? 'mt-auto' : ''}`} key={section.title}>
              {/* Section Header (Accordion Toggle) */}
              <button 
                onClick={() => toggleSection(section.title)}
                className="hidden lg:flex items-center justify-between w-full py-2.5 px-3 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3 text-white/70 group-hover:text-white transition-colors">
                  <span className="font-semibold text-[13px] tracking-wide">
                    {(t.menu as any)?.[section.title.toLowerCase()] || section.title}
                  </span>
                </div>
                <ChevronDown 
                  size={16} 
                  className={`text-white/50 group-hover:text-white/80 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
                />
              </button>

              {/* Sub-items list */}
              <div 
                className={`flex flex-col gap-0.5 overflow-hidden transition-all duration-300 ease-in-out ${
                  isExpanded ? 'max-h-[500px] opacity-100 mt-1 lg:pl-4' : 'max-h-0 opacity-0 lg:max-h-[500px] lg:opacity-100 lg:hidden'
                }`}
              >
                {/* On mobile (hidden lg), we still show the icons without accordion hiding them completely to keep the sidebar small */}
                <div className="flex flex-col gap-1 lg:border-l lg:border-white/10 lg:pl-2 py-1 lg:py-0">
                  {visibleItems.map((item) => {
                    const targetHref = item.href === "/" 
                      ? (isSuper ? "/superadmin" : `/${role}`) 
                      : item.href;
                    const isActive = 
                      (pendingHref ? pendingHref === targetHref : pathname === targetHref) || 
                      (item.href !== "/" && (pendingHref || pathname).startsWith(item.href) && (item.href !== "/admin/timetable" || (pendingHref || pathname) === "/admin/timetable"));
                    
                    return (
                      <Link
                        href={targetHref}
                        prefetch={true}
                        onClick={() => setPendingHref(targetHref)}
                        onMouseEnter={() => router.prefetch(targetHref)}
                        key={item.label}
                        className={`flex items-center justify-center lg:justify-start gap-3 py-2 px-3 rounded-lg transition-all duration-200 group relative ${
                          isActive 
                            ? "bg-white/15 text-white font-semibold" 
                            : "text-white/60 hover:bg-white/10 hover:text-white font-medium"
                        }`}
                      >
                        <div className={`transition-all duration-200 ${
                          isActive 
                            ? "text-white" 
                            : "text-white/60 group-hover:text-white"
                        }`}>
                          {typeof item.icon === 'string' ? (
                            <div className="relative w-[18px] h-[18px]">
                               <Image 
                                 src={item.icon} 
                                 alt="" 
                                 fill
                                 className={isActive ? "brightness-0" : "opacity-60"}
                               />
                            </div>
                          ) : (
                            <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                          )}
                        </div>
                        <span className="hidden lg:block tracking-tight text-[13px] transition-transform duration-200">
                          {(t.menu as any)[labelToKey[item.label]] || item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* USER PROFILE FOOTER */}
      <div className="mt-auto pt-4 border-t border-white/10 hidden lg:flex items-center gap-3 px-3">
        {adminData?.img ? (
          <Image src={adminData.img} alt="" width={32} height={32} className="rounded-full object-cover w-8 h-8" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-white text-xs font-bold">U</span>
          </div>
        )}
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[13px] font-semibold text-white truncate">
            {fullName}
          </span>
          <span className="text-[10px] text-white/70 font-medium uppercase tracking-wider truncate">
            {(t.navbar as any)?.[role?.toLowerCase() || ""] || role || "User"}
          </span>
        </div>
        <div className="text-white/70 hover:text-white cursor-pointer ml-auto shrink-0 transition-colors">
          <MoreVertical size={16} />
        </div>
      </div>

    </div>
  );
};

export default Menu;
