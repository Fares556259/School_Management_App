"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Loading from "@/app/(dashboard)/loading";

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
        anchor.target !== "_blank"
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
        } catch (err) {
          // ignore
        }
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
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          <Loading />
        </div>
      )}
    </>
  );
}
