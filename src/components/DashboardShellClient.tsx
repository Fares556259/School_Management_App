"use client";

import { useState, useCallback, useEffect } from "react";
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

  // Silent background heartbeat to dispatch any pending reminders opportunistically
  useEffect(() => {
    const ping = () => {
    };
    ping();
    const interval = setInterval(ping, 30_000);
    return () => clearInterval(interval);
  }, []);

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
      <div className="sticky top-0 z-20 border-b border-ink-200/70 bg-paper/90 backdrop-blur-md print:hidden">
        <Navbar adminData={adminData} role={role!} onMobileMenuOpen={openDrawer} />
      </div>

      {children}
    </>
  );
};

export default DashboardShellClient;
