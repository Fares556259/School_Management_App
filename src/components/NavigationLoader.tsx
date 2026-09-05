"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function NavigationWatcher({ onNavFinish }: { onNavFinish: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    onNavFinish();
  }, [pathname, searchParams, onNavFinish]);

  return null;
}

export default function NavigationLoader() {
  const [loading, setLoading] = useState(false);

  const handleNavFinish = useCallback(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;

      const target = event.target as HTMLElement;
      const anchor = target.closest("a");

      if (
        anchor &&
        anchor.href &&
        !anchor.hasAttribute("download") &&
        anchor.target !== "_blank" &&
        anchor.getAttribute("data-no-loader") !== "true"
      ) {
        const rawHref = anchor.getAttribute("href") || "";

        if (rawHref.startsWith("#") || rawHref.startsWith("javascript:") || rawHref === "") {
          return;
        }

        try {
          const url = new URL(anchor.href, window.location.origin);
          if (
            url.origin === window.location.origin &&
            (url.pathname !== window.location.pathname || url.search !== window.location.search)
          ) {
            setLoading(true);
          }
        } catch (err) {}
      }
    };

    document.addEventListener("click", handleAnchorClick);
    return () => document.removeEventListener("click", handleAnchorClick);
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <NavigationWatcher onNavFinish={handleNavFinish} />
      </Suspense>
      {loading && (
        <div className="fixed top-0 right-0 bottom-0 left-[14%] md:left-[8%] lg:left-[16%] xl:left-[14%] z-[9999] pointer-events-none flex items-center justify-center bg-white/40 backdrop-blur-[2px] animate-in fade-in duration-200">
           <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/10">
             <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
           </div>
        </div>
      )}
    </>
  );
}
