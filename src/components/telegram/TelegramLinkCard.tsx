"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
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
  QrCode,
  Smartphone,
  School,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Share2,
  Search,
} from "lucide-react";
import {
  getTelegramLinkStatus,
  requestTelegramLinkCode,
  disconnectTelegramAccount,
} from "@/app/(dashboard)/admin/actions/telegramActions";
import { QRCodeSVG } from "qrcode.react";

export default function TelegramLinkCard() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    const res = await getTelegramLinkStatus();
    if (res.success) {
      setStatus(res);
      if (!res.isLinked) {
        if (res.linkCode && res.linkCodeExpiry && new Date(res.linkCodeExpiry) > new Date()) {
          setActiveCode(res.linkCode);
        } else {
          // Automatically prepare an active code and QR so onboarding is immediate
          const codeRes = await requestTelegramLinkCode();
          if (codeRes.success && codeRes.code) {
            setActiveCode(codeRes.code);
          }
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
        text: "Nouveau code généré ! Scannez le QR code ci-dessous avec votre smartphone.",
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

  const handleCopyUsername = () => {
    navigator.clipboard.writeText("@HniaSnapSchoolBot");
    setCopiedUsername(true);
    setTimeout(() => setCopiedUsername(false), 2000);
  };

  const handleCopyDirectLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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
    <div className="p-6 rounded-[12px] border border-[#dddddd] flex flex-col gap-6 bg-[#f8fafc] shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-xs shrink-0 ring-2 ring-[#2AABEE]/25 bg-white flex items-center justify-center">
            <Image
              src="/hnia_mascot_icon.png"
              alt="Hnia AI"
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-semibold text-[#181d26]">
                Assistant Telegram (Hnia)
              </h2>
              {status?.isLinked ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 size={12} /> Connecté
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  Non lié
                </span>
              )}
            </div>
            <p className="text-[13px] text-[#5a5a5a]">
              Pilotez votre école par message texte ou note vocale avec <strong className="text-[#2AABEE]">@HniaSnapSchoolBot</strong>
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

      {/* ========================================================================= */}
      {/* 1. LINKED / CONNECTED STATE                                               */}
      {/* ========================================================================= */}
      {status?.isLinked ? (
        <div className="flex flex-col gap-6 bg-white p-6 rounded-[12px] border border-[#dddddd] shadow-2xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-slate-100">
            <div className="flex flex-col gap-1 p-3 bg-slate-50/70 rounded-xl border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone size={13} className="text-slate-400" />
                Compte Telegram
              </span>
              <span className="text-[14px] font-semibold text-[#181d26]">
                {status.telegramUsername ? `@${status.telegramUsername}` : `ID: ${status.telegramId}`}
              </span>
            </div>

            <div className="flex flex-col gap-1 p-3 bg-slate-50/70 rounded-xl border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <School size={13} className="text-slate-400" />
                École associée
              </span>
              <span className="text-[14px] font-semibold text-[#181d26] truncate">
                {status.schoolName}
              </span>
            </div>

            <div className="flex flex-col gap-1 p-3 bg-slate-50/70 rounded-xl border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={13} className="text-emerald-500" />
                Briefing matinal
              </span>
              <span className="text-[14px] font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={13} /> Actif à 7h30
              </span>
            </div>
          </div>

          {/* QR Code & Mobile Walkthrough Section */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-[#2AABEE]/5 via-indigo-50/40 to-slate-50 border border-[#2AABEE]/25 flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Left: QR Code Box */}
            <div className="flex flex-col items-center gap-2 p-3.5 bg-white rounded-2xl border border-[#2AABEE]/30 shadow-xs shrink-0">
              <div className="p-2 bg-white rounded-xl">
                <QRCodeSVG
                  value="https://t.me/HniaSnapSchoolBot"
                  size={136}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#2AABEE] uppercase tracking-wider">
                <QrCode size={13} />
                <span>Scanner au mobile</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                iPhone & Android
              </span>
            </div>

            {/* Right: Steps 1, 2, 3, 4 */}
            <div className="flex flex-col gap-3.5 flex-1 w-full">
              <div className="flex items-center gap-2">
                <Smartphone size={16} className="text-[#2AABEE]" />
                <h3 className="text-[14px] font-bold text-[#181d26]">
                  Comment ouvrir et utiliser Hnia sur votre téléphone :
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Step 1 */}
                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
                  <div className="w-6 h-6 rounded-full bg-[#2AABEE] text-white flex items-center justify-center font-bold text-[12px] shrink-0">
                    1
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[12px] font-bold text-slate-800">Scannez le QR Code</span>
                    <span className="text-[11px] text-slate-500 leading-snug">
                      Pointez l&apos;appareil photo de votre smartphone vers le code QR ci-contre.
                    </span>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
                  <div className="w-6 h-6 rounded-full bg-[#2AABEE] text-white flex items-center justify-center font-bold text-[12px] shrink-0">
                    2
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[12px] font-bold text-slate-800">Ouvrez Telegram</span>
                    <span className="text-[11px] text-slate-500 leading-snug">
                      Touchez le lien pour ouvrir la conversation avec <strong className="text-slate-700">@HniaSnapSchoolBot</strong>.
                    </span>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
                  <div className="w-6 h-6 rounded-full bg-[#2AABEE] text-white flex items-center justify-center font-bold text-[12px] shrink-0">
                    3
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[12px] font-bold text-slate-800">Parlez ou écrivez 🇹🇳 🇫🇷</span>
                    <span className="text-[11px] text-slate-500 leading-snug">
                      Posez vos questions par texte ou vocal : élèves, caisse, reçus, impayés, classes...
                    </span>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
                  <div className="w-6 h-6 rounded-full bg-[#2AABEE] text-white flex items-center justify-center font-bold text-[12px] shrink-0">
                    4
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[12px] font-bold text-slate-800">Reçus PDF & Briefings</span>
                    <span className="text-[11px] text-slate-500 leading-snug">
                      Téléchargez vos reçus officiels, bordereaux de caisse, et briefing chaque matin à 7h30.
                    </span>
                  </div>
                </div>
              </div>

              {/* Sample Voice/Text Prompts */}
              <div className="p-2.5 rounded-lg bg-white/70 border border-slate-200/70 text-[11px] text-slate-600 flex flex-wrap items-center gap-1.5">
                <Sparkles size={13} className="text-amber-500 shrink-0" />
                <span className="font-semibold text-slate-700">Exemples à tester :</span>
                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-normal">
                  « فما تلامذة موش مفرّقين في أقسام؟ »
                </code>
                <span>•</span>
                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-normal">
                  « حط أحمد في 4ème B »
                </code>
                <span>•</span>
                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-normal">
                  « Reçu de paiement de Sarah »
                </code>
                <span>•</span>
                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-normal">
                  « Recette de caisse du jour »
                </code>
              </div>
            </div>
          </div>

          {/* Fallback Option: If user cannot scan */}
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowFallback(!showFallback)}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-[#2AABEE] transition-colors self-start"
            >
              <HelpCircle size={14} className="text-[#2AABEE]" />
              <span className="underline underline-offset-2">
                {showFallback
                  ? "Masquer l'alternative sans QR code"
                  : "Impossible de scanner le QR code ? Cliquez ici pour les options manuelles"}
              </span>
              {showFallback ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showFallback && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-3 text-[12px] animate-in fade-in duration-200">
                <span className="font-semibold text-slate-800 flex items-center gap-2">
                  <Search size={14} className="text-[#2AABEE]" />
                  Deux façons simples d&apos;ouvrir Hnia sans utiliser l&apos;appareil photo :
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: Direct Search */}
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 flex flex-col justify-between gap-2.5 shadow-2xs">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-slate-800 text-[12px]">
                        Option 1 : Cherchez le bot dans Telegram
                      </span>
                      <p className="text-slate-500 text-[11px] leading-relaxed">
                        Ouvrez votre application Telegram sur téléphone, tapez dans la barre de recherche :{" "}
                        <strong className="text-slate-800">@HniaSnapSchoolBot</strong> et envoyez n&apos;importe quel message.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyUsername}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-medium transition-colors"
                    >
                      {copiedUsername ? (
                        <>
                          <Check size={13} className="text-emerald-600" />
                          <span className="text-emerald-700 font-semibold">@HniaSnapSchoolBot copié !</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copier @HniaSnapSchoolBot</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Option 2: Copy direct link */}
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 flex flex-col justify-between gap-2.5 shadow-2xs">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-slate-800 text-[12px]">
                        Option 2 : S&apos;envoyer le lien direct
                      </span>
                      <p className="text-slate-500 text-[11px] leading-relaxed">
                        Copiez le lien direct vers le bot et envoyez-le vous par WhatsApp, SMS ou email pour l&apos;ouvrir d&apos;un simple clic sur mobile.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyDirectLink("https://t.me/HniaSnapSchoolBot")}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-medium transition-colors"
                    >
                      {copiedLink ? (
                        <>
                          <Check size={13} className="text-emerald-600" />
                          <span className="text-emerald-700 font-semibold">Lien direct copié !</span>
                        </>
                      ) : (
                        <>
                          <Share2 size={13} />
                          <span>Copier le lien (t.me/HniaSnapSchoolBot)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <a
              href="https://t.me/HniaSnapSchoolBot"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2AABEE] hover:bg-[#229ED9] text-white text-[13px] font-medium rounded-[6px] transition-colors shadow-sm"
            >
              <MessageSquare size={15} />
              <span>Ouvrir sur cet ordinateur</span>
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
        /* ========================================================================= */
        /* 2. NOT LINKED / ONBOARDING STATE                                         */
        /* ========================================================================= */
        <div className="flex flex-col gap-5 bg-white p-6 rounded-[12px] border border-[#dddddd] shadow-2xs">
          {/* Header Info */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-indigo-600">
              <Sparkles size={16} />
              <span className="text-[13px] font-semibold uppercase tracking-wider">
                Associez Hnia à votre école en quelques secondes
              </span>
            </div>
            <p className="text-[13px] text-[#444444] leading-relaxed">
              Discutez directement avec SnapSchool comme avec un collaborateur :
              enregistrez les règlements des familles, notez des dépenses, vérifiez les absences du jour,
              ou demandez le bilan financier du mois par texte ou note vocale (arabe tunisien, français, anglais).
            </p>
          </div>

          {/* QR Code + 1-2-3-4 Steps Container */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-50/70 via-blue-50/40 to-slate-50 border border-indigo-100 flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Left: QR Code Box */}
            <div className="flex flex-col items-center gap-2.5 p-4 bg-white rounded-2xl border border-indigo-100 shadow-sm shrink-0">
              <div className="p-2 bg-white rounded-xl">
                <QRCodeSVG
                  value={
                    activeCode
                      ? `https://t.me/HniaSnapSchoolBot?start=${activeCode}`
                      : "https://t.me/HniaSnapSchoolBot"
                  }
                  size={140}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                <QrCode size={13} />
                <span>Scanner au mobile</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                iPhone & Android
              </span>
            </div>

            {/* Right: Steps 1, 2, 3, 4 */}
            <div className="flex flex-col gap-3.5 flex-1 w-full">
              <div className="flex items-center gap-2">
                <Smartphone size={16} className="text-indigo-600" />
                <h3 className="text-[14px] font-bold text-indigo-950">
                  Comment connecter votre téléphone en 4 étapes simples :
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Step 1 */}
                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[12px] shrink-0">
                    1
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[12px] font-bold text-slate-800">Scannez le QR Code</span>
                    <span className="text-[11px] text-slate-500 leading-snug">
                      Pointez l&apos;appareil photo de votre smartphone vers le code QR ci-contre.
                    </span>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[12px] shrink-0">
                    2
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[12px] font-bold text-slate-800">Appuyez sur Démarrer</span>
                    <span className="text-[11px] text-slate-500 leading-snug">
                      Dans Telegram, touchez le bouton <strong>Démarrer</strong> (<code className="text-indigo-600">/start</code>).
                    </span>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[12px] shrink-0">
                    3
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[12px] font-bold text-slate-800">Liaison instantanée</span>
                    <span className="text-[11px] text-slate-500 leading-snug">
                      Hnia reconnaît automatiquement votre école et associe votre compte en 1 seconde.
                    </span>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-indigo-100 shadow-2xs">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[12px] shrink-0">
                    4
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[12px] font-bold text-slate-800">Prenez le contrôle !</span>
                    <span className="text-[11px] text-slate-500 leading-snug">
                      Pilotez vos élèves, finances et cours par texte ou note vocale de n&apos;importe où.
                    </span>
                  </div>
                </div>
              </div>

              {/* Code display + Copy button */}
              {activeCode && (
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-slate-500 font-medium">Ou code manuel :</span>
                    <div className="text-[16px] font-mono font-bold text-indigo-700 tracking-wider bg-white px-3 py-1 rounded-lg border border-indigo-200 shadow-xs">
                      {activeCode}
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="p-1.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors shadow-xs"
                      title="Copier le code"
                    >
                      {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                    </button>
                  </div>

                  <a
                    href={`https://t.me/HniaSnapSchoolBot?start=${activeCode}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2AABEE] hover:bg-[#229ED9] text-white text-[12px] font-medium rounded-[6px] transition-colors shadow-xs ml-auto"
                  >
                    <Send size={13} />
                    <span>Lier sur cet ordinateur</span>
                    <ExternalLink size={12} />
                  </a>

                  <button
                    onClick={handleGenerateCode}
                    disabled={actionLoading}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                    title="Régénérer un nouveau code"
                  >
                    <RefreshCw size={14} className={actionLoading ? "animate-spin" : ""} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Fallback Option: If user cannot scan during onboarding */}
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowFallback(!showFallback)}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-indigo-600 transition-colors self-start"
            >
              <HelpCircle size={14} className="text-indigo-600" />
              <span className="underline underline-offset-2">
                {showFallback
                  ? "Masquer l'alternative sans QR code"
                  : "Impossible de scanner le QR code ? Connectez-vous manuellement"}
              </span>
              {showFallback ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showFallback && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-3 text-[12px] animate-in fade-in duration-200 shadow-2xs">
                <span className="font-semibold text-indigo-950 flex items-center gap-2">
                  <Search size={14} className="text-indigo-600" />
                  Comment associer votre école sans scanner le code :
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 flex flex-col justify-between gap-2.5">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-slate-800 text-[12px]">
                        1. Recherche + Code dans Telegram
                      </span>
                      <p className="text-slate-500 text-[11px] leading-relaxed">
                        Sur votre téléphone, ouvrez Telegram, cherchez <strong className="text-slate-800">@HniaSnapSchoolBot</strong>, puis envoyez simplement le code :{" "}
                        <code className="bg-slate-100 px-1.5 py-0.5 rounded font-bold text-indigo-700 border border-slate-200">
                          {activeCode || "..."}
                        </code>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-medium transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check size={13} className="text-emerald-600" />
                          <span className="text-emerald-700 font-semibold">Code copié !</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copier le code ({activeCode})</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 flex flex-col justify-between gap-2.5">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-slate-800 text-[12px]">
                        2. S&apos;envoyer le lien d&apos;invitation direct
                      </span>
                      <p className="text-slate-500 text-[11px] leading-relaxed">
                        Copiez le lien direct avec code intégré et collez-le dans WhatsApp pour l&apos;ouvrir directement sur votre smartphone.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyDirectLink(
                          activeCode
                            ? `https://t.me/HniaSnapSchoolBot?start=${activeCode}`
                            : "https://t.me/HniaSnapSchoolBot"
                        )
                      }
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-medium transition-colors"
                    >
                      {copiedLink ? (
                        <>
                          <Check size={13} className="text-emerald-600" />
                          <span className="text-emerald-700 font-semibold">Lien d&apos;invitation copié !</span>
                        </>
                      ) : (
                        <>
                          <Share2 size={13} />
                          <span>Copier le lien d&apos;invitation</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
