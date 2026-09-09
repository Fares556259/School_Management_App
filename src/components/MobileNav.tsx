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

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200/80 shrink-0">
          <Link
            href={role === "superadmin" || role === "superuser" ? "/superadmin" : role ? `/${role}` : "/"}
            onClick={onClose}
            className="flex items-center gap-2.5 min-w-0"
          >
            <Image
              src={schoolConfig?.schoolLogo || "/logo.png"}
              alt="logo"
              width={32}
              height={32}
              className="w-8 h-8 object-contain rounded-lg border border-slate-200 shadow-xs bg-white shrink-0"
            />
            <span className="font-bold text-[15px] text-slate-900 tracking-tight truncate max-w-[170px]">
              {schoolConfig?.schoolName || "SnapSchool"}
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Fermer la navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Menu — reuse the same desktop Menu component, which already handles role/locale */}
        <div className="flex-1 overflow-y-auto p-3">
          <Menu role={role} adminData={adminData} schoolConfig={schoolConfig} />
        </div>
      </div>
    </>
  );
};

export default MobileNav;
