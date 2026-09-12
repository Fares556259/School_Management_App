import React from "react";
import Script from "next/script";
import { verifyCallToken } from "@/lib/call/token";
import CallRoomClient from "./CallRoomClient";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface CallPageProps {
  searchParams: {
    auth?: string;
  };
}

export default function CallPage({ searchParams }: CallPageProps) {
  const token = searchParams.auth;
  const payload = token ? verifyCallToken(token) : null;

  if (!token || !payload) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mb-4 text-2xl border border-red-500/30">
          ⚠️
        </div>
        <h1 className="text-xl font-bold mb-2">Lien d&apos;appel expiré ou invalide</h1>
        <p className="text-slate-400 text-sm max-w-md mb-6">
          Cette session d&apos;appel vocal Hnia n&apos;est plus valide. Veuillez retourner sur Telegram et taper <code className="text-emerald-400 bg-emerald-950/50 px-2 py-1 rounded">/call</code> pour générer un nouveau lien sécurisé.
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-sm hover:bg-slate-700 transition"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <CallRoomClient token={token} initialPayload={payload} />
    </>
  );
}
