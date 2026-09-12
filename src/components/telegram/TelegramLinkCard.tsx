"use client";

import { useState, useEffect } from "react";
import {
  Send,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Unlink,
  MessageSquare,
  Sparkles,
  Clock,
  ShieldCheck,
} from "lucide-react";
import {
  getTelegramLinkStatus,
  requestTelegramLinkCode,
  disconnectTelegramAccount,
} from "@/app/(dashboard)/admin/actions/telegramActions";

export default function TelegramLinkCard() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    const res = await getTelegramLinkStatus();
    if (res.success) {
      setStatus(res);
      if (!res.isLinked && res.linkCode) {
        // Check if existing code is not expired
        if (res.linkCodeExpiry && new Date(res.linkCodeExpiry) > new Date()) {
          setActiveCode(res.linkCode);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleGenerateCode = async () => {
    setActionLoading(true);
    setMsg(null);
    const res = await requestTelegramLinkCode();
    if (res.success && res.code) {
      setActiveCode(res.code);
      setMsg({
        type: "success",
        text: "Code généré avec succès ! Cliquez sur le lien ou envoyez-le au bot.",
      });
    } else {
      setMsg({
        type: "error",
        text: res.error || "Impossible de générer le code.",
      });
    }
    setActionLoading(false);
  };

  const handleDisconnect = async () => {
    if (!confirm("Voulez-vous vraiment dissocier votre compte Telegram ?")) return;
    setActionLoading(true);
    const res = await disconnectTelegramAccount();
    if (res.success) {
      setActiveCode(null);
      await fetchStatus();
      setMsg({ type: "success", text: "Compte Telegram dissocié avec succès." });
    } else {
      setMsg({ type: "error", text: res.error || "Erreur lors de la déconnexion." });
    }
    setActionLoading(false);
  };

  const handleCopyCode = () => {
    if (!activeCode) return;
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-6 rounded-[12px] border border-[#dddddd] bg-[#f8fafc] animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-48 mb-3"></div>
        <div className="h-4 bg-slate-100 rounded w-80"></div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-[12px] border border-[#dddddd] flex flex-col gap-6 bg-[#f8fafc]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2AABEE]/10 text-[#2AABEE] flex items-center justify-center shrink-0">
            <Send size={20} className="translate-x-[-1px] translate-y-[1px]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-medium text-[#181d26]">
                Assistant Telegram (Hnia)
              </h2>
              {status?.isLinked ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 size={12} /> Connecté
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  Non lié
                </span>
              )}
            </div>
            <p className="text-[13px] text-[#5a5a5a]">
              Gérez votre école en parlant ou par message vocal avec @HniaSnapSchoolBot
            </p>
          </div>
        </div>

        <button
          onClick={fetchStatus}
          className="self-start sm:self-auto p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-[#dddddd]"
          title="Actualiser le statut"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {msg && (
        <div
          className={`p-3.5 rounded-lg text-[13px] flex items-center gap-2 border ${
            msg.type === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-rose-50 text-rose-700 border-rose-200"
          }`}
        >
          <span>{msg.text}</span>
        </div>
      )}

      {/* Linked State */}
      {status?.isLinked ? (
        <div className="flex flex-col gap-4 bg-white p-5 rounded-[10px] border border-[#dddddd]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Compte Telegram
              </span>
              <span className="text-[14px] font-medium text-[#181d26]">
                {status.telegramUsername ? `@${status.telegramUsername}` : `ID: ${status.telegramId}`}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                École associée
              </span>
              <span className="text-[14px] font-medium text-[#181d26]">
                {status.schoolName}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Briefing matinal
              </span>
              <span className="text-[14px] font-medium text-emerald-600 flex items-center gap-1">
                <Clock size={13} /> Actif à 7h30
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-[#eeeeee] flex flex-wrap items-center justify-between gap-3">
            <a
              href="https://t.me/HniaSnapSchoolBot"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2AABEE] hover:bg-[#229ED9] text-white text-[13px] font-medium rounded-[6px] transition-colors shadow-sm"
            >
              <MessageSquare size={15} />
              <span>Ouvrir la conversation</span>
              <ExternalLink size={13} />
            </a>

            <button
              onClick={handleDisconnect}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] text-rose-600 hover:bg-rose-50 rounded-[6px] transition-colors disabled:opacity-50"
            >
              <Unlink size={14} />
              <span>Dissocier ce compte</span>
            </button>
          </div>
        </div>
      ) : (
        /* Not Linked State */
        <div className="flex flex-col gap-5 bg-white p-5 rounded-[10px] border border-[#dddddd]">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-indigo-600">
              <Sparkles size={16} />
              <span className="text-[13px] font-semibold uppercase tracking-wider">
                Fonctionnalités disponibles sur Telegram
              </span>
            </div>
            <p className="text-[13px] text-[#444444] leading-relaxed">
              Discutez directement avec SnapSchool comme avec un collaborateur :
              enregistrez les règlements des familles, notez des dépenses, vérifiez les absences du jour,
              ou demandez le bilan financier du mois par texte ou note vocale (arabe tunisien, français, anglais).
            </p>
          </div>

          {activeCode ? (
            <div className="flex flex-col gap-3 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
              <span className="text-[12px] font-medium text-indigo-900">
                Votre code d&apos;association à 6 chiffres (valide 15 minutes) :
              </span>
              <div className="flex items-center gap-3">
                <div className="text-[28px] font-mono font-bold text-indigo-700 tracking-[0.25em] bg-white px-4 py-1.5 rounded-lg border border-indigo-200 shadow-sm">
                  {activeCode}
                </div>
                <button
                  onClick={handleCopyCode}
                  className="p-2.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors shadow-sm"
                  title="Copier le code"
                >
                  {copied ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
                </button>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <a
                  href={`https://t.me/HniaSnapSchoolBot?start=${activeCode}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#2AABEE] hover:bg-[#229ED9] text-white text-[13px] font-medium rounded-[6px] transition-colors shadow-sm"
                >
                  <Send size={14} />
                  <span>Activer en 1 clic sur Telegram</span>
                  <ExternalLink size={13} />
                </a>

                <span className="text-[12px] text-slate-500">
                  ou envoyez le code au bot <strong className="text-slate-700">@HniaSnapSchoolBot</strong>
                </span>
              </div>
            </div>
          ) : (
            <div>
              <button
                onClick={handleGenerateCode}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-medium rounded-[6px] transition-colors shadow-sm disabled:opacity-50"
              >
                <ShieldCheck size={16} />
                <span>{actionLoading ? "Génération..." : "Lier mon compte Telegram"}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
