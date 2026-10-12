"use client";

import { resetParentPassword, resetTeacherPassword } from "@/lib/crudActions";
import { useState } from "react";

const ResetPasswordButton = ({ parentId, teacherId }: { parentId?: string; teacherId?: string }) => {
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const handleReset = async () => {
    setLoading(true);
    setStatus("idle");
    
    let result;
    if (parentId) {
      result = await resetParentPassword(parentId);
    } else if (teacherId) {
      result = await resetTeacherPassword(teacherId);
    } else {
      setLoading(false);
      return;
    }
    
    setLoading(false);

    if (result.success) {
      if (parentId && "temporaryPassword" in result && typeof result.temporaryPassword === "string") {
        setTemporaryPassword(result.temporaryPassword);
      }
      setStatus("success");
      if (!parentId) {
        setTimeout(() => {
          setIsOpen(false);
          setTimeout(() => setStatus("idle"), 300);
        }, 2000);
      }
    } else {
      setStatus("error");
      setErrorMessage(result.error || "Failed to reset password.");
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-8 h-8 flex items-center justify-center rounded-control border shadow-sm transition-colors bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300 hover:text-indigo-700"
        title="Reset Password"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z"/>
          <circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>
        </svg>
      </button>

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={() => !loading && setIsOpen(false)}
        >
          <div 
            className="bg-white rounded-dialog shadow-2xl max-w-[400px] w-full relative overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {status === "success" ? (
              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <h2 className="text-[20px] font-semibold text-ink-900 mb-2">Accès réinitialisé</h2>
                <p className="text-[14px] text-[#5a5a5a]">
                  {parentId
                    ? "Le compte parent et tous ses enfants associés restent inchangés. Communiquez ce mot de passe temporaire de manière sécurisée."
                    : "The user can configure a new password on their next login."}
                </p>
                {temporaryPassword && (
                  <div className="mt-5 w-full rounded-control border border-brand-200 bg-brand-50 p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-700">Mot de passe temporaire</p>
                    <code className="block break-all text-[18px] font-bold tracking-wide text-ink-900">{temporaryPassword}</code>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(temporaryPassword);
                        setCopied(true);
                      }}
                      className="mt-3 w-full rounded-control border border-brand-200 bg-white px-3 py-2 text-[13px] font-semibold text-brand-700 hover:bg-brand-50"
                    >
                      {copied ? "Copié" : "Copier le mot de passe"}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setStatus("idle");
                    setTemporaryPassword("");
                    setCopied(false);
                  }}
                  className="mt-5 rounded-control bg-ink-900 px-5 py-2.5 text-[13px] font-semibold text-white"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex gap-4 mb-6">
                  <div className="w-12 h-12 shrink-0 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center border border-indigo-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-[18px] font-semibold text-ink-900 mb-1.5">Réinitialiser l’accès ?</h2>
                    <p className="text-[14px] text-[#5a5a5a] leading-relaxed">
                      {parentId
                        ? "Un mot de passe temporaire sera créé pour ce même compte. Les enfants et les données associées resteront liés."
                        : "The existing password will be cleared for secure setup."}
                    </p>
                  </div>
                </div>

                {status === "error" && (
                  <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-[8px] flex items-start gap-2.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500 shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                    <p className="text-[13px] text-rose-700 leading-relaxed">{errorMessage}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 px-4 py-2.5 text-[14px] font-medium text-ink-600 bg-white border border-ink-200 hover:bg-ink-50 rounded-[8px] transition-all"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 text-[14px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-[8px] transition-all disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-indigo-200 border-t-white rounded-full animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      "Yes, Reset Password"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ResetPasswordButton;
