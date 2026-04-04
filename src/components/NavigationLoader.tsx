"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Loading from "@/app/(dashboard)/loading";

export default function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // When the path or search params change, it means a navigation has finished
    setLoading(false);
  }, [pathname, searchParams]);

  // We need a way to detect the START of a navigation. 
  // In Next.js App Router, there's no native 'routeChangeStart'.
  // However, we can listen for click events on Links in the Sidebar.
  
  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const anchor = target.closest("a");

      if (anchor && anchor.href && !anchor.hasAttribute("download") && anchor.href !== window.location.href) {
        // Only trigger for internal links starting with http that are different from current page
        if (anchor.href.startsWith("http")) {
            try {
                const url = new URL(anchor.href);
                if (url.origin === window.location.origin) {
                    setLoading(true);
                }
            } catch (err) {
                console.warn("Invalid navigation URL:", anchor.href);
            }
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
