"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import ShareParentLinkModal from "@/components/ShareParentLinkModal";
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
  CreditCard, 
  UsersRound, 
  BookOpen, 
  DoorOpen, 
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
  ChevronDown,
  Layers,
  QrCode,
  Building2
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
  icon: any;
  label: string;
  href: string;
  visible: string[];
}

interface MenuSection {
  title: string;
  icon?: any;
  items: MenuItem[];
}

const menuItems: MenuSection[] = [
  {
    title: "MAIN",
    icon: Home,
    items: [
      { icon: Home, label: "Home", href: "/", visible: ["admin", "teacher", "student", "parent"] }
    ],
  },
  {
    title: "ACADEMICS",
    icon: GraduationCap,
    items: [
      { icon: Calendar, label: "Timetable", href: "/admin/timetable", visible: ["admin", "teacher", "student", "parent"] },
      { icon: FileText, label: "Exams", href: "/list/exams", visible: ["admin", "teacher", "student", "parent"] },
      { icon: Sparkles, label: "AI Scheduler", href: "/admin/timetable/ai", visible: ["admin"] },
      { icon: DoorOpen, label: "Classes", href: "/list/classes", visible: ["admin", "teacher", "superuser"] },
      { icon: GraduationCap, label: "Results", href: "/list/results", visible: ["admin", "teacher", "student", "parent"] },
      { icon: Percent, label: "Grades", href: "/admin/grades", visible: ["admin", "superuser"] },
    ],
  },
  {
    title: "PEOPLE",
    icon: Users,
    items: [
      { icon: Users, label: "Students", href: "/list/students", visible: ["admin", "teacher"] },
      { icon: UsersRound, label: "Parents", href: "/list/parents", visible: ["admin", "teacher", "superuser"] },
      { icon: UserRound, label: "Teachers", href: "/list/teachers", visible: ["admin", "teacher"] },
      { icon: Contact, label: "Staff", href: "/list/staff", visible: ["admin", "superuser"] },
    ],
  },
  {
    title: "FINANCE",
    icon: CreditCard,
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
    icon: Layers,
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
    icon: Settings,
    items: [
      { icon: User, label: "Profile", href: "/profile", visible: ["admin", "teacher", "student", "parent"] },
      { icon: Settings, label: "Settings", href: "/settings", visible: ["admin", "teacher", "student", "parent"] },
      { icon: CircleHelp, label: "Help & Support", href: "/help", visible: ["admin", "teacher", "student", "parent"] },
      { icon: LogOut, label: "Logout", href: "/logout", visible: ["admin", "teacher", "student", "parent"] },
    ],
  },
];

const Menu = ({ role, adminData, schoolConfig }: { role?: string, adminData?: any, schoolConfig?: any }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const { t, locale } = useLanguage();

  const academicYear = schoolConfig?.academicYear || "2024-2025";
  const currentTerm = schoolConfig?.currentSemester || 1;

  const getBadgeTranslations = () => {
    switch(locale) {
      case "ar": return { year: "السنة", term: "الثلاثي", online: "متصل" };
      case "fr": return { year: "Année", term: "Trimestre", online: "En ligne" };
      case "en": 
      default: return { year: "Year", term: "Term", online: "Online" };
    }
  };
  const badgeT = getBadgeTranslations();


  useEffect(() => {
    // Reset pending state when pathname changes
    setPendingHref(null);
  }, [pathname]);

  const fullName = adminData?.name || adminData?.surname 
    ? `${adminData.name || ""} ${adminData.surname || ""}`.trim() 
    : "Administrateur";

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

  const isRTL = locale === "ar";

  return (
    <div className="flex flex-col min-h-full h-full text-sm pb-2">
      {/* 1. TOP STANDALONE LINK (Accueil / Dashboard) */}
      <div className="flex flex-col gap-1 mb-2 px-1">
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
                className={`flex items-center justify-center lg:justify-start gap-3 py-2.5 px-3 rounded-xl transition-all duration-200 group relative ${
                  isActive 
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20 font-semibold" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium"
                }`}
              >
                <div className="transition-transform duration-200 shrink-0">
                  <item.icon size={19} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "text-white" : "text-slate-500 group-hover:text-slate-800"} />
                </div>
                <span className="hidden lg:block tracking-tight text-[14px]">
                  {(t.menu as any)[labelToKey[item.label]] || item.label}
                </span>
              </Link>
            );
        })}
      </div>

      {/* 2. CATEGORY ACCORDIONS (Académie, Personnes, Finance, Opérations, Système) */}
      <div className="flex flex-col gap-1 px-1 flex-1">
        {menuItems.filter(s => s.title !== "MAIN").map((section) => {
          const isExpanded = expandedSections[section.title];
          const visibleItems = section.items.filter(item => item.visible.some(v => activeRoles.includes(v)));
          
          if (visibleItems.length === 0) return null;

          const SectionIcon = section.icon;

          return (
            <div className="flex flex-col" key={section.title}>
              {/* Section Header (Accordion Toggle) */}
              <button 
                type="button"
                onClick={() => toggleSection(section.title)}
                className={`flex items-center justify-center lg:justify-between w-full py-2 px-3 rounded-xl transition-all duration-200 group cursor-pointer select-none ${
                  isExpanded 
                    ? "bg-slate-100/90 text-slate-900 font-semibold" 
                    : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 font-medium"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {SectionIcon && (
                    <SectionIcon 
                      size={18} 
                      className={`shrink-0 transition-colors ${isExpanded ? "text-blue-600" : "text-slate-500 group-hover:text-slate-800"}`} 
                    />
                  )}
                  <span className="hidden lg:block font-medium text-[13.5px] tracking-tight truncate">
                    {(t.menu as any)?.[section.title.toLowerCase()] || section.title}
                  </span>
                </div>
                <ChevronDown 
                  size={15} 
                  className={`hidden lg:block shrink-0 text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-blue-600' : ''}`} 
                />
              </button>

              {/* Sub-items list */}
              <div 
                className={`flex flex-col gap-0.5 overflow-hidden transition-all duration-300 ease-in-out ${
                  isExpanded ? 'max-h-[500px] opacity-100 mt-1 lg:pl-3' : 'max-h-0 opacity-0'
                }`}
              >
                <div className={`flex flex-col gap-1 lg:border-l lg:border-slate-200 lg:pl-2.5 py-1 ${isRTL ? 'lg:border-l-0 lg:border-r lg:pr-2.5 lg:pl-0' : ''}`}>
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
                        className={`flex items-center justify-center lg:justify-start gap-2.5 py-2 px-2.5 rounded-lg transition-all duration-200 group relative ${
                          isActive 
                            ? "bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600" 
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-normal"
                        }`}
                      >
                        <div className={`transition-colors shrink-0 ${
                          isActive 
                            ? "text-blue-600" 
                            : "text-slate-400 group-hover:text-slate-600"
                        }`}>
                          {typeof item.icon === 'string' ? (
                            <div className="relative w-[17px] h-[17px]">
                               <Image 
                                 src={item.icon} 
                                 alt="" 
                                 fill
                                 className={isActive ? "" : "opacity-75"}
                               />
                            </div>
                          ) : (
                            <item.icon size={17} strokeWidth={isActive ? 2.5 : 2} />
                          )}
                        </div>
                        <span className="hidden lg:block tracking-tight text-[13px] transition-transform duration-200 truncate">
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

        {/* 3. SUBTLE UTILITY CARD (App Mobile & Parents) - Clean Outline Design */}
        {(role === "admin" || role === "superadmin" || role === "superuser" || role === "teacher") && (
          <div className="hidden lg:flex flex-col gap-2 p-3 my-2 mx-1 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-100/70 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <Smartphone size={15} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[12px] font-bold text-slate-800 leading-tight truncate">
                  Application Mobile
                </span>
                <span className="text-[10.5px] text-slate-500 leading-tight">
                  Accès Parents & Profs
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="mt-0.5 w-full flex items-center justify-center gap-2 py-1.5 px-2.5 rounded-lg bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 font-semibold text-[11px] tracking-wide transition-all shadow-2xs cursor-pointer"
            >
              <QrCode size={13} className="text-blue-600 shrink-0" />
              <span>Inviter / QR Code</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. BOTTOM FOOTER SECTION (Academic Status & Account) */}
      <div className="flex flex-col gap-2 mt-auto pt-3 border-t border-slate-200">
        {/* SCHOOL & ACADEMIC YEAR BADGE */}
        <div className="hidden lg:flex items-center gap-2.5 px-3 py-2 mx-1 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="w-7 h-7 rounded-lg bg-emerald-100/70 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <Building2 size={14} />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[12px] font-bold text-slate-800 truncate">
                {badgeT.year} {academicYear}
              </span>
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <span className="text-[10.5px] text-slate-500 font-medium">
              {badgeT.term} {currentTerm} • {badgeT.online}
            </span>
          </div>
        </div>

        {/* USER PROFILE FOOTER */}
        <div className="hidden lg:flex items-center gap-2.5 px-2.5 py-1.5 mx-1 rounded-xl hover:bg-slate-100 transition-colors">
          {adminData?.img ? (
            <Image src={adminData.img} alt="" width={32} height={32} className="rounded-full object-cover w-8 h-8 shrink-0 border border-slate-200" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0">
              <span className="text-blue-700 text-xs font-bold">
                {fullName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[12.5px] font-bold text-slate-800 truncate">
              {fullName}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider truncate">
              {(t.navbar as any)?.[role?.toLowerCase() || ""] || role || "User"}
            </span>
          </div>
          <button 
            type="button" 
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer ml-auto shrink-0 transition-colors"
            title="Options"
          >
            <MoreVertical size={15} />
          </button>
        </div>
      </div>

      {/* Share Parent Link Modal */}
      <ShareParentLinkModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        schoolName={schoolConfig?.schoolName}
        schoolSubdomain={schoolConfig?.schoolSubdomain}
      />
    </div>
  );
};

export default Menu;

