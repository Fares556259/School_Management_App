"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Loading from "@/app/(dashboard)/loading";

export default function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // When pathname or searchParams change, navigation finished
    setLoading(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      // If event was defaultPrevented (e.g. custom smooth scroll), don't trigger loader
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

        // Do NOT trigger loader for hash links, empty links, or javascript:
        if (rawHref.startsWith("#") || rawHref.startsWith("javascript:") || rawHref === "") {
          return;
        }

        try {
          const url = new URL(anchor.href, window.location.origin);
          // Only trigger for same origin, different page/pathname/search
          if (
            url.origin === window.location.origin &&
            (url.pathname !== window.location.pathname || url.search !== window.location.search)
          ) {
            setLoading(true);
          }
        } catch (err) {
          // ignore invalid URLs
        }
      }
    };

    document.addEventListener("click", handleAnchorClick);
    return () => document.removeEventListener("click", handleAnchorClick);
  }, []);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <Loading />
    </div>
  );
}
