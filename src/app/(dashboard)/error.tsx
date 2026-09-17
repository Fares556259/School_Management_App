"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // If it's a chunk/deployment mismatch error, automatically refresh to fetch fresh chunks
    const isChunkOrCallError =
      error.message?.includes("reading 'call'") ||
      error.message?.includes("Loading chunk") ||
      error.message?.includes("Failed to fetch dynamically imported module") ||
      error.name === "ChunkLoadError";

    if (isChunkOrCallError && typeof window !== "undefined") {
      const lastReload = sessionStorage.getItem("last_chunk_error_reload");
      const now = Date.now();
      // Only auto-reload once within a 15-second window to prevent reload loops
      if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
        sessionStorage.setItem("last_chunk_error_reload", String(now));
        window.location.reload();
        return;
      }
    }
    console.error("Dashboard Error:", error);
  }, [error]);

  const isStaleDeployment =
    error.message?.includes("reading 'call'") ||
    error.message?.includes("Loading chunk") ||
    error.name === "ChunkLoadError";

  return (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center p-6 bg-slate-50 rounded-lg border border-slate-200">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
        <AlertCircle className="text-red-600 w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">
        {isStaleDeployment ? "Mise à jour de l'application" : "Une erreur est survenue"}
      </h2>
      <p className="text-slate-600 text-center max-w-md mb-8 text-sm">
        {isStaleDeployment
          ? "Une nouvelle version de l'application a été déployée. Veuillez recharger la page pour charger les données à jour."
          : "Une erreur inattendue est survenue lors du chargement de cette page."}
        {error.message && (
          <span className="block mt-2 text-xs font-mono text-red-500 bg-red-50 p-2 rounded">
            {error.message}
          </span>
        )}
      </p>
      <button
        onClick={() => {
          if (isStaleDeployment) {
            window.location.reload();
          } else {
            reset();
          }
        }}
        className="flex items-center gap-2 px-6 py-3 bg-[#181d26] text-white rounded-lg font-semibold hover:bg-black transition-colors shadow-sm"
      >
        <RefreshCcw size={18} />
        {isStaleDeployment ? "Recharger la page" : "Réessayer"}
      </button>
    </div>
  );
}
