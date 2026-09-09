"use client";

import { useState, useCallback } from "react";
import MobileNav from "@/components/MobileNav";
import Navbar from "@/components/Navbar";

interface DashboardShellClientProps {
  role?: string;
  adminData?: any;
  schoolConfig?: any;
  children: React.ReactNode;
}

/**
 * Thin client shell that owns mobile-drawer open/close state.
 * The heavy lifting (data fetching, auth) stays in the server layout.
 */
const DashboardShellClient = ({
  role,
  adminData,
  schoolConfig,
  children,
}: DashboardShellClientProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <>
      {/* Mobile slide-in nav drawer (md:hidden internally) */}
      <MobileNav
        isOpen={drawerOpen}
        onClose={closeDrawer}
        role={role}
        adminData={adminData}
        schoolConfig={schoolConfig}
      />

      {/* Top navbar with hamburger wired in */}
      <div className="print:hidden sticky top-0 bg-[#F5F6F8]/80 backdrop-blur-md z-20">
        <Navbar adminData={adminData} role={role!} onMobileMenuOpen={openDrawer} />
      </div>

      {children}
    </>
  );
};

export default DashboardShellClient;
