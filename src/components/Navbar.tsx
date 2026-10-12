"use client";

import Image from "next/image"
import LanguageSwitcher from "./LanguageSwitcher";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { useEffect, useState } from "react";
import { Menu as MenuIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { getUserAvatar } from "@/lib/avatar";

const Navbar = ({ adminData: initialAdminData, role = "User", onMobileMenuOpen }: { adminData?: any, role?: string, onMobileMenuOpen?: () => void }) => {
  const { t } = useLanguage();
  const [adminData, setAdminData] = useState<any>(initialAdminData);

  const pathname = usePathname();
  
  const pathSegments = pathname?.split('/').filter(Boolean) || [];

  // Update effect for adminData if prop changes from layout refresh
  useEffect(() => {
    setAdminData(initialAdminData);
  }, [initialAdminData]);

  return (
    <header className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 md:px-6 lg:px-8">
      {/* LEFT: Hamburger (mobile only) + PAGE TITLE */}
      <div className="flex items-center gap-3 flex-1">
        {/* Hamburger — only visible on mobile */}
        <button
          type="button"
          onClick={onMobileMenuOpen}
          className="ss-icon-button shrink-0 md:hidden"
          aria-label="Ouvrir la navigation"
        >
          <MenuIcon size={20} />
        </button>

        {/* Page title — always visible, smaller on mobile */}
        <h1 className="truncate text-lg font-semibold leading-tight tracking-[-0.02em] text-ink-900 md:text-xl">
          {(() => {
            if (pathSegments.length === 0) return "Dashboard";
            const lastSegment = pathSegments[pathSegments.length - 1];
            const isId = /^[0-9a-fA-F-]{10,}$|^\d+$/.test(lastSegment) || lastSegment.length > 20;
            const targetSegment = isId && pathSegments.length > 1 ? pathSegments[pathSegments.length - 2] : lastSegment;
            return (t.menu as any)?.[targetSegment] || targetSegment.charAt(0).toUpperCase() + targetSegment.slice(1);
          })()}
        </h1>
      </div>

      {/* RIGHT: UTILITIES */}
      <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
        {/* LANGUAGE SWITCHER */}
        <LanguageSwitcher />

        {/* USER PROFILE */}
        <div className="ms-1 flex items-center border-s border-ink-200 ps-3 sm:ms-2 sm:ps-4">
          <Image
            src={getUserAvatar(adminData?.img, role, adminData?.sex)}
            alt="Profile"
            width={32}
            height={32}
            className="h-8 w-8 rounded-full border border-ink-200 object-cover"
          />
          <form action="/api/auth/signout" method="POST" className="ms-2 hidden sm:block">
            <button type="submit" className="rounded-control px-2 py-1.5 text-xs font-medium text-ink-600 transition hover:bg-white hover:text-ink-900">
              {(t.menu as any)?.logout || "Sign out"}
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}

export default Navbar
