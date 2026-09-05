"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Normalize dynamic sub-routes like /list/teachers/[id] so in-memory navigation
  // within the same detail view does not trigger an AnimatePresence unmount/remount
  const routeKey = pathname ? pathname.replace(/\/list\/teachers\/[^/]+/, "/list/teachers/[id]") : pathname;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routeKey}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="flex-1 w-full h-full print:h-auto print:block"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
