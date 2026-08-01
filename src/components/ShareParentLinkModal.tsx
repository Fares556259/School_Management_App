"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Share2,
  Copy,
  Check,
  QrCode,
  Users,
  Building2,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";

interface ClassOption {
  id: number;
  name: string;
  studentCount?: number;
}

interface PendingRequest {
  id: string;
  parentName: string;
  parentSurname?: string;
  parentPhone: string;
  relation: string;
  address?: string;
  email?: string;
  studentId?: string;
  studentFullName?: string;
  classId: number;
  className: string;
  childrenList?: { name: string; surname: string; sex: string; birthday?: string; classId: number; className?: string }[];
  createdAt: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const MODAL_TEXTS = {
  en: {
    title: "Parent Registrations & Requests",
    subtitle: "Share the registration link and validate parent requests",
    class: "Class :",
    registrationLink: "Registration Link",
    requests: "Requests",
    whatsappMessageLabel: "WhatsApp Invitation Message",
    whatsappMessageBody: (className: string, schoolName: string, link: string) => 
      `Dear parents of class ${className}, join the SnapSchool app of ${schoolName} to track your child's grades, absences, and report cards by clicking this link: ${link}`,
    shareWhatsapp: "Share on WhatsApp",
    copyLink: "Copy link",
    linkCopied: "Link copied!",
    qrCodeTitle: "QR Code for Display / Meeting",
    qrCodeDesc: (className: string) => 
      `Print this QR code or display it during parent-teacher meetings for class ${className}.`,
    testLink: "Test parent registration page",
    pendingRequests: "Pending Registration Requests",
    refresh: "Refresh",
    loading: "Loading requests...",
    noRequests: "No pending requests for this class.",
    addressNotProvided: "Address not provided",
    childrenToRegister: "Child(ren) to register",
    girl: "Girl",
    boy: "Boy",
    notSpecified: "Not specified",
    approve: "Approve",
    reject: "Reject",
    errorProcessing: "Error during processing",
    networkError: "Network error",
  },
  fr: {
    title: "Inscriptions & Demandes Parents",
    subtitle: "Partagez le lien d'inscription et validez les demandes parents",
    class: "Classe :",
    registrationLink: "Lien d'inscription",
    requests: "Demandes",
    whatsappMessageLabel: "Message d'invitation WhatsApp",
    whatsappMessageBody: (className: string, schoolName: string, link: string) => 
      `Chers parents de la classe ${className}, rejoignez l'application SnapSchool de l'établissement ${schoolName} pour suivre les notes, absences et bulletins de votre enfant en cliquant sur ce lien : ${link}`,
    shareWhatsapp: "Partager sur WhatsApp",
    copyLink: "Copier le lien",
    linkCopied: "Lien copié !",
    qrCodeTitle: "Code QR pour affichage / réunion",
    qrCodeDesc: (className: string) => 
      `Imprimez ce code QR ou affichez-le lors des réunions de parents d'élèves de la classe ${className}.`,
    testLink: "Tester la page d'inscription parent",
    pendingRequests: "Demandes d'inscription en attente",
    refresh: "Actualiser",
    loading: "Chargement des demandes...",
    noRequests: "Aucune demande en attente de validation pour cette classe.",
    addressNotProvided: "Adresse non renseignée",
    childrenToRegister: "Enfant(s) à inscrire",
    girl: "Fille",
    boy: "Garçon",
    notSpecified: "Non spécifié",
    approve: "Approuver",
    reject: "Refuser",
    errorProcessing: "Erreur lors du traitement",
    networkError: "Erreur réseau",
  },
  ar: {
    title: "تسجيلات وطلبات الأولياء",
    subtitle: "شارك رابط التسجيل وقم بالتحقق من طلبات الأولياء",
    class: "القسم :",
    registrationLink: "رابط التسجيل",
    requests: "الطلبات",
    whatsappMessageLabel: "رسالة دعوة واتساب",
    whatsappMessageBody: (className: string, schoolName: string, link: string) => 
      `أعزائي أولياء أمور قسم ${className}، انضموا إلى تطبيق SnapSchool لمؤسسة ${schoolName} لمتابعة درجات وغيابات وتقارير طفلكم عبر الضغط على هذا الرابط: ${link}`,
    shareWhatsapp: "مشاركة عبر واتساب",
    copyLink: "نسخ الرابط",
    linkCopied: "تم نسخ الرابط!",
    qrCodeTitle: "رمز QR للعرض / الاجتماعات",
    qrCodeDesc: (className: string) => 
      `قم بطباعة رمز QR هذا أو عرضه أثناء اجتماعات أولياء الأمور لقسم ${className}.`,
    testLink: "تجربة صفحة تسجيل الولي",
    pendingRequests: "طلبات التسجيل المعلقة",
    refresh: "تحديث",
    loading: "جاري تحميل الطلبات...",
    noRequests: "لا توجد طلبات معلقة لهذا القسم.",
    addressNotProvided: "العنوان غير متوفر",
    childrenToRegister: "الطفل (الأطفال) المراد تسجيلهم",
    girl: "بنت",
    boy: "ولد",
    notSpecified: "غير محدد",
    approve: "موافقة",
    reject: "رفض",
    errorProcessing: "حدث خطأ أثناء المعالجة",
    networkError: "خطأ في الشبكة",
  }
};

export default function ShareParentLinkModal({
  isOpen,
  onClose,
  classes = [],
  initialClassId,
  schoolName = "SnapSchool",
  schoolSubdomain,
  onApproved,
}: {
  isOpen: boolean;
  onClose: () => void;
  classes?: ClassOption[];
  initialClassId?: number;
  schoolName?: string;
  schoolSubdomain?: string;
  onApproved?: () => void;
}) {
  const router = useRouter();
  const { locale } = useLanguage();
  const isRTL = locale === 'ar';
  const t = MODAL_TEXTS[locale as keyof typeof MODAL_TEXTS] || MODAL_TEXTS.en;

  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"link" | "requests">("link");

  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(initialClassId || classes[0].id);
    }
  }, [classes, initialClassId, selectedClassId]);

  useEffect(() => {
    if (isOpen) {
      fetchPendingRequests();
    }
  }, [isOpen]);

  async function fetchPendingRequests() {
    try {
      setLoadingRequests(true);
      const res = await fetch("/api/parent-requests");
      const data = await res.json();
      if (res.ok && data.requests) {
        setPendingRequests(data.requests);
      }
    } catch (err) {
      console.error("Failed to fetch pending requests", err);
    } finally {
      setLoadingRequests(false);
    }
  }

  if (!isOpen) return null;

  const currentClass = classes.find((c) => c.id === selectedClassId) || classes[0];
  const displaySchoolName = schoolName && !schoolName.includes("@") ? schoolName : "SnapSchool";
  const schoolSlug = (displaySchoolName && displaySchoolName !== "SnapSchool") ? slugify(displaySchoolName) : (schoolSubdomain || "snapschool-academy");

  const joinUrl = typeof window !== "undefined"
    ? `${window.location.origin}/join/${schoolSlug}?classId=${currentClass?.id || ""}`
    : `/join/${schoolSlug}?classId=${currentClass?.id || ""}`;

  const whatsappMessage = t.whatsappMessageBody(currentClass?.name || "", displaySchoolName, joinUrl);
  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAction = async (requestId: string, action: "APPROVE" | "REJECT") => {
    try {
      setProcessingId(requestId);
      const res = await fetch("/api/parent-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
        router.refresh();
        if (onApproved) {
          onApproved();
        }
      } else {
        alert(data.error || t.errorProcessing);
      }
    } catch (err) {
      alert(t.networkError);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = pendingRequests.filter(
    (r) => !selectedClassId || r.classId === selectedClassId
  );

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans" dir={isRTL ? "rtl" : "ltr"}>
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">{t.title}</h3>
              <p className="text-xs text-blue-100">{t.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs & Class Selector */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Class Select Dropdown */}
          <div className="w-full sm:w-auto flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase">{t.class}</label>
            <select
              value={selectedClassId || ""}
              onChange={(e) => setSelectedClassId(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              dir="ltr"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.studentCount ? `(${c.studentCount})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-slate-200/70 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("link")}
              className={`flex-1 sm:flex-none px-3.5 py-1 text-xs font-bold rounded-lg transition-all ${
                activeTab === "link"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📲 {t.registrationLink}
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`flex-1 sm:flex-none px-3.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "requests"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>{t.requests}</span>
              {pendingRequests.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === "link" ? (
            <>
              {/* WhatsApp Message Preview */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-green-600" />
                  {t.whatsappMessageLabel}
                </label>
                <div className={`bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 text-xs text-slate-700 leading-relaxed ${isRTL ? "font-sans" : "font-mono"}`} dir={isRTL ? "rtl" : "ltr"}>
                  {whatsappMessage}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href={whatsappShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.01]"
                >
                  <MessageSquare className="w-4 h-4 fill-white" />
                  {t.shareWhatsapp}
                </a>

                <button
                  onClick={copyToClipboard}
                  className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" /> {t.linkCopied}
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> {t.copyLink}
                    </>
                  )}
                </button>
              </div>

              {/* QR Code Section */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                <div className="w-24 h-24 bg-white p-2 rounded-xl border border-slate-200 shrink-0 flex items-center justify-center shadow-xs">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(joinUrl)}`}
                    alt="QR Code"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs mb-1 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-blue-600" /> {t.qrCodeTitle}
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed mb-2">
                    {t.qrCodeDesc(currentClass?.name || "")}
                  </p>
                  <a
                    href={joinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 w-fit"
                  >
                    {t.testLink} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </>
          ) : (
            /* Pending Requests Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-xs text-slate-700 uppercase">
                  {t.pendingRequests} ({filteredRequests.length})
                </h4>
                <button
                  onClick={fetchPendingRequests}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  {t.refresh}
                </button>
              </div>

              {loadingRequests ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                  {t.loading}
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 p-6">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                  {t.noRequests}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredRequests.map((r) => (
                    <div
                      key={r.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-slate-300 transition-colors"
                    >
                      <div className="space-y-1 w-full">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {r.parentName} {r.parentSurname || ""}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold">
                            {r.relation}
                          </span>
                        </div>
                        <p className={`text-xs text-slate-600 ${isRTL ? "font-sans" : "font-mono"}`} dir={isRTL ? "rtl" : "ltr"}>📱 <span dir="ltr" className="inline-block">{r.parentPhone}</span> • 📍 {r.address || t.addressNotProvided}</p>
                        
                        <div className="pt-1.5 space-y-1">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                            {t.childrenToRegister} ({r.childrenList?.length || 1}) :
                          </span>
                          {r.childrenList && r.childrenList.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2 mt-1">
                              {r.childrenList.map((c, i) => (
                                <div key={i} className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold text-slate-900">{c.name} {c.surname}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.sex === "FEMALE" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"}`}>
                                      {c.sex === "FEMALE" ? t.girl : t.boy}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] text-slate-600 font-medium">
                                    <span>🎂 <span dir="ltr" className="inline-block">{c.birthday ? new Date(c.birthday).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'fr-FR') : t.notSpecified}</span></span>
                                    <span>🏫 <span dir="ltr" className="inline-block">{c.className || r.className}</span></span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-800 font-semibold">{r.studentFullName} <span dir="ltr" className="inline-block">({r.className})</span></span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                        <button
                          disabled={processingId === r.id}
                          onClick={() => handleAction(r.id, "APPROVE")}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          {processingId === r.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" /> {t.approve}
                            </>
                          )}
                        </button>
                        <button
                          disabled={processingId === r.id}
                          onClick={() => handleAction(r.id, "REJECT")}
                          className="px-3 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" /> {t.reject}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
