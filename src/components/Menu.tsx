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
  ClipboardList, 
  Megaphone, 
  User, 
  Settings, 
  LogOut,
  BarChart3,
  Settings2,
  CalendarCheck,
  Smartphone,
  Library,
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
      { icon: DoorOpen, label: "Classes", href: "/list/classes", visible: ["admin", "teacher", "superuser"] },
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
      { icon: Activity, label: "Audit Log", href: "/admin/audit", visible: ["admin", "superuser"] },
      { icon: ClipboardList, label: "Privacy requests", href: "/admin/privacy-requests", visible: ["admin"] },
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

const Menu = ({ role, adminData, schoolConfig, mobile = false }: { role?: string, adminData?: any, schoolConfig?: any, mobile?: boolean }) => {
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
    setExpandedSections(previous => {
      const next = { ...previous };
      let changed = false;

      menuItems.forEach(section => {
        if (section.title === "MAIN") return;

        const hasActive = section.items.some(item => {
          const targetHref = item.href === "/" ? (isSuper ? "/superadmin" : `/${role}`) : item.href;
          return (pendingHref ? pendingHref === targetHref : pathname === targetHref) ||
            (item.href !== "/" && (pendingHref || pathname).startsWith(item.href) && (item.href !== "/admin/timetable" || (pendingHref || pathname) === "/admin/timetable"));
        });

        if (hasActive && !next[section.title]) {
          next[section.title] = true;
          changed = true;
        }
      });

      return changed ? next : previous;
    });
  }, [pathname, pendingHref, role, isSuper]);

  // Proactive background prefetching for high-frequency routes on idle
  useEffect(() => {
    if (!router || !role) return;

    const timer = setTimeout(() => {
      const highPriorityRoutes = role === "admin"
        ? [
            "/list/teachers",
            "/list/students",
            "/list/classes",
            "/admin/finance",
            "/list/expenses",
            "/admin/grades",
            "/admin/timetable",
            "/list/attendance",
          ]
        : role === "teacher"
        ? [
            "/list/classes",
            "/list/students",
            "/list/assignments",
            "/admin/timetable",
          ]
        : [];

      highPriorityRoutes.forEach((route) => {
        try {
          router.prefetch(route);
        } catch {
          // ignore
        }
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [router, role]);

  const toggleSection = (title: string) => {
    setExpandedSections(prev => {
      const willExpand = !prev[title];
      if (willExpand) {
        const targetSection = menuItems.find(s => s.title === title);
        if (targetSection) {
          targetSection.items
            .filter(item => item.visible.some(v => activeRoles.includes(v)))
            .forEach(item => {
              const href = item.href === "/" ? (isSuper ? "/superadmin" : `/${role}`) : item.href;
              if (href !== "/logout") {
                try {
                  router.prefetch(href);
                } catch {
                  // ignore
                }
              }
            });
        }
      }
      return {
        ...prev,
        [title]: willExpand
      };
    });
  };

  return (
    <nav aria-label="Navigation principale" className="flex h-full min-h-full flex-col pb-2 text-sm">
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
                aria-current={isActive ? "page" : undefined}
                className={`group relative flex items-center gap-3 rounded-control px-3 py-2.5 transition-colors duration-150 ${mobile ? "justify-start" : "justify-center lg:justify-start"} ${
                  isActive
                    ? "bg-brand-600 font-semibold text-white"
                    : "font-medium text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                }`}
              >
                <div className="transition-transform duration-200 shrink-0">
                  <item.icon size={19} strokeWidth={1.75} className={isActive ? "text-white" : "text-ink-500 group-hover:text-ink-800"} />
                </div>
                <span className={`${mobile ? "block" : "hidden lg:block"} text-[14px] tracking-tight`}>
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
                onMouseEnter={() => {
                  // Prefetch all pages in this section when hovering the header
                  visibleItems.forEach(item => {
                    const href = item.href === "/" ? (isSuper ? "/superadmin" : `/${role}`) : item.href;
                    if (href !== "/logout") router.prefetch(href);
                  });
                }}
                aria-expanded={Boolean(isExpanded)}
                className={`group flex w-full cursor-pointer select-none items-center rounded-control px-3 py-2 transition-colors duration-150 ${mobile ? "justify-between" : "justify-center lg:justify-between"} ${
                  isExpanded
                    ? "bg-ink-100 font-semibold text-ink-900"
                    : "font-medium text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {SectionIcon && (
                    <SectionIcon 
                      size={18} 
                      strokeWidth={1.75}
                      className={`shrink-0 transition-colors ${isExpanded ? "text-brand-600" : "text-ink-500 group-hover:text-ink-800"}`}
                    />
                  )}
                  <span className={`${mobile ? "block" : "hidden lg:block"} truncate text-[13.5px] font-medium tracking-tight`}>
                    {(t.menu as any)?.[section.title.toLowerCase()] || section.title}
                  </span>
                </div>
                <ChevronDown 
                  size={15} 
                  strokeWidth={1.75}
                  className={`${mobile ? "block" : "hidden lg:block"} shrink-0 text-ink-400 transition-transform duration-200 group-hover:text-ink-600 ${isExpanded ? 'rotate-180 text-brand-600' : ''}`}
                />
              </button>

              {/* Sub-items list */}
              <div
                aria-hidden={!isExpanded}
                className={`flex flex-col gap-0.5 overflow-hidden transition-all duration-200 ease-out ${
                  isExpanded ? `max-h-[500px] opacity-100 mt-1 ${mobile ? "ps-3" : "lg:ps-3"}` : 'max-h-0 opacity-0'
                }`}
              >
                <div className={`flex flex-col gap-1 border-s border-ink-200 py-1 ps-2.5 ${!mobile ? "max-lg:border-0 max-lg:ps-0" : ""}`}>
                  {visibleItems.map((item) => {
                    const targetHref = item.href === "/" 
                      ? (isSuper ? "/superadmin" : `/${role}`) 
                      : item.href;
                    const isActive = 
                      (pendingHref ? pendingHref === targetHref : pathname === targetHref) || 
                      (item.href !== "/" && (pendingHref || pathname).startsWith(item.href) && (item.href !== "/admin/timetable" || (pendingHref || pathname) === "/admin/timetable"));
                    
                    if (item.href === "/logout") {
                      return (
                        <form key={item.label} action="/api/auth/signout" method="POST" className="w-full">
                          <button
                            type="submit"
                            className={`group relative flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 font-normal text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900 ${mobile ? "justify-start" : "justify-center lg:justify-start"}`}
                          >
                            <div className="shrink-0 text-ink-400 transition-colors group-hover:text-ink-600">
                              <item.icon size={17} strokeWidth={1.75} />
                            </div>
                            <span className={`${mobile ? "block" : "hidden lg:block"} truncate text-[13px] tracking-tight`}>
                              {(t.menu as any)[labelToKey[item.label]] || item.label}
                            </span>
                          </button>
                        </form>
                      );
                    }

                    return (
                      <Link
                        href={targetHref}
                        prefetch={true}
                        onClick={() => setPendingHref(targetHref)}
                        onMouseEnter={() => router.prefetch(targetHref)}
                        key={item.label}
                        aria-current={isActive ? "page" : undefined}
                        className={`group relative flex items-center gap-2.5 rounded-control px-2.5 py-2 transition-colors duration-150 ${mobile ? "justify-start" : "justify-center lg:justify-start"} ${
                          isActive
                            ? "bg-brand-50 font-semibold text-brand-700 ring-1 ring-inset ring-brand-100"
                            : "font-normal text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                        }`}
                      >
                        <div className={`transition-colors shrink-0 ${
                          isActive
                            ? "text-brand-600"
                            : "text-ink-400 group-hover:text-ink-600"
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
                            <item.icon size={17} strokeWidth={1.75} />
                          )}
                        </div>
                        <span className={`${mobile ? "block" : "hidden lg:block"} truncate text-[13px] tracking-tight`}>
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
          <div className={`${mobile ? "flex" : "hidden lg:flex"} mx-1 my-2 flex-col gap-2 rounded-panel border border-ink-200 bg-ink-50 p-3`}>
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-brand-100 text-brand-600">
                <Smartphone size={15} strokeWidth={1.75} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="truncate text-[12px] font-semibold leading-tight text-ink-800">
                  Application Mobile
                </span>
                <span className="text-[11px] leading-tight text-ink-500">
                  Accès Parents & Profs
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="mt-0.5 flex min-h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-control border border-ink-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-ink-700 transition-colors hover:bg-ink-50 hover:text-ink-900"
            >
              <QrCode size={13} strokeWidth={1.75} className="shrink-0 text-brand-600" />
              <span>Inviter / QR Code</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. BOTTOM FOOTER SECTION (Academic Status & Account) */}
      <div className="mt-auto flex flex-col gap-2 border-t border-ink-200 pt-3">
        {/* SCHOOL & ACADEMIC YEAR BADGE */}
        <div className={`${mobile ? "flex" : "hidden lg:flex"} mx-1 items-center gap-2.5 rounded-panel border border-ink-200 bg-ink-50 px-3 py-2`}>
          <div className="w-7 h-7 rounded-lg bg-emerald-100/70 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <Building2 size={14} />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[12px] font-semibold text-ink-800">
                {badgeT.year} {academicYear}
              </span>
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <span className="text-[11px] font-medium text-ink-500">
              {badgeT.term} {currentTerm} • {badgeT.online}
            </span>
          </div>
        </div>

        {/* USER PROFILE FOOTER */}
        <div className={`${mobile ? "flex" : "hidden lg:flex"} mx-1 items-center gap-2.5 rounded-control px-2.5 py-1.5 transition-colors hover:bg-ink-50`}>
          {adminData?.img ? (
            <Image src={adminData.img} alt="" width={32} height={32} className="rounded-full object-cover w-8 h-8 shrink-0 border border-slate-200" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-100">
              <span className="text-xs font-bold text-brand-700">
                {fullName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex flex-col flex-1 min-w-0">
            <span className="truncate text-[12.5px] font-semibold text-ink-800">
              {fullName}
            </span>
            <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              {(t.navbar as any)?.[role?.toLowerCase() || ""] || role || "User"}
            </span>
          </div>
          <button 
            type="button" 
            className="ms-auto shrink-0 cursor-pointer rounded-control p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
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
    </nav>
  );
};

export default Menu;

