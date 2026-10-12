"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import Menu from "@/components/Menu";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  role?: string;
  adminData?: any;
  schoolConfig?: any;
}

const MobileNav = ({ isOpen, onClose, role, adminData, schoolConfig }: MobileNavProps) => {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-close when navigation happens
  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  // Prevent body scroll when drawer open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-ink-950/40 backdrop-blur-[2px] md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="fixed inset-y-0 start-0 z-50 flex w-[min(88vw,300px)] animate-in flex-col border-e border-ink-200 bg-white shadow-overlay slide-in-from-left-4 duration-200 md:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        {/* Drawer header */}
        <div className="flex shrink-0 items-center justify-between border-b border-ink-200 px-4 py-3.5">
          <Link
            href={role === "superadmin" || role === "superuser" ? "/superadmin" : role ? `/${role}` : "/"}
            onClick={onClose}
            className="flex items-center gap-2.5 min-w-0"
          >
            <Image
              src={schoolConfig?.schoolLogo || "/logo.png"}
              alt={schoolConfig?.schoolName ? `${schoolConfig.schoolName} logo` : "SnapSchool logo"}
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-control border border-ink-200 bg-white object-contain"
            />
            <span className="max-w-[170px] truncate text-[15px] font-semibold tracking-tight text-ink-900">
              {schoolConfig?.schoolName || "SnapSchool"}
            </span>
          </Link>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            className="ss-icon-button shrink-0"
            aria-label="Fermer la navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Menu — reuse the same desktop Menu component, which already handles role/locale */}
        <div className="flex-1 overflow-y-auto p-3">
          <Menu role={role} adminData={adminData} schoolConfig={schoolConfig} mobile />
        </div>
      </div>
    </>
  );
};

export default MobileNav;
