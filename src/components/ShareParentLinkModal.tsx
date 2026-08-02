"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Share2,
  Copy,
  Check,
  QrCode,
  AlertCircle,
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
    whatsappMessageBody: (schoolName: string, link: string) => 
      `Dear parents, join the SnapSchool app of ${schoolName} to track your child's grades, absences, and report cards by clicking this link: ${link}`,
    shareWhatsapp: "Share on WhatsApp",
    copyLink: "Copy link",
    linkCopied: "Link copied!",
    qrCodeTitle: "QR Code for Display / Meeting",
    qrCodeDesc: () => 
      `Print this QR code or display it during parent-teacher meetings.`,
    testLink: "Test parent registration page",
    pendingRequests: "Pending Registration Requests",
    refresh: "Refresh",
    loading: "Loading requests...",
    noRequests: "No pending requests.",
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
    registrationLink: "Lien d'inscription",
    requests: "Demandes",
    whatsappMessageLabel: "Message d'invitation WhatsApp",
    whatsappMessageBody: (schoolName: string, link: string) => 
      `Chers parents, rejoignez l'application SnapSchool de l'établissement ${schoolName} pour suivre les notes, absences et bulletins de vos enfants en cliquant sur ce lien : ${link}`,
    shareWhatsapp: "Partager sur WhatsApp",
    copyLink: "Copier le lien",
    linkCopied: "Lien copié !",
    qrCodeTitle: "Code QR pour affichage / réunion",
    qrCodeDesc: () => 
      `Imprimez ce code QR ou affichez-le lors des réunions de parents d'élèves.`,
    testLink: "Tester la page d'inscription parent",
    pendingRequests: "Demandes d'inscription en attente",
    refresh: "Actualiser",
    loading: "Chargement des demandes...",
    noRequests: "Aucune demande en attente de validation.",
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
    registrationLink: "رابط التسجيل",
    requests: "الطلبات",
    whatsappMessageLabel: "رسالة دعوة واتساب",
    whatsappMessageBody: (schoolName: string, link: string) => 
      `أعزائي الأولياء، انضموا إلى تطبيق SnapSchool لمؤسسة ${schoolName} لمتابعة درجات وغيابات وتقارير أبنائكم عبر الضغط على هذا الرابط: ${link}`,
    shareWhatsapp: "مشاركة عبر واتساب",
    copyLink: "نسخ الرابط",
    linkCopied: "تم نسخ الرابط!",
    qrCodeTitle: "رمز QR للعرض / الاجتماعات",
    qrCodeDesc: () => 
      `قم بطباعة رمز QR هذا أو عرضه أثناء اجتماعات أولياء الأمور.`,
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

  const [copied, setCopied] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"link" | "requests">("link");

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

  const displaySchoolName = schoolName && !schoolName.includes("@") ? schoolName : "SnapSchool";
  const schoolSlug = (displaySchoolName && displaySchoolName !== "SnapSchool") ? slugify(displaySchoolName) : (schoolSubdomain || "snapschool-academy");

  const joinUrl = typeof window !== "undefined"
    ? `${window.location.origin}/join/${schoolSlug}`
    : `/join/${schoolSlug}`;

  const whatsappMessage = t.whatsappMessageBody(displaySchoolName, joinUrl);
  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAction = async (requestId: string, action: "APPROVE" | "REJECT") => {
    try {
      setErrorMsg(null);
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
        setErrorMsg(data.error || t.errorProcessing);
      }
    } catch (err) {
      setErrorMsg(t.networkError);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = pendingRequests;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans" dir={isRTL ? "rtl" : "ltr"}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{t.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{t.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-4">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => {
                setActiveTab("link");
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === "link" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.registrationLink}
            </button>
            <button
              onClick={() => {
                setActiveTab("requests");
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === "requests" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span>{t.requests}</span>
              {pendingRequests.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === "requests" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"
                }`}>
                  {pendingRequests.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 text-rose-700 animate-in fade-in zoom-in duration-200">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm font-medium">{errorMsg}</div>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === "link" ? (
            <div className="space-y-6">
              {/* WhatsApp Preview */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-500" />
                  {t.whatsappMessageLabel}
                </label>
                <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 leading-relaxed ${isRTL ? "font-sans" : "font-mono"}`} dir={isRTL ? "rtl" : "ltr"}>
                  {whatsappMessage}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href={whatsappShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-4 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  {t.shareWhatsapp}
                </a>

                <button
                  onClick={copyToClipboard}
                  className="py-2.5 px-4 bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" /> {t.linkCopied}
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> {t.copyLink}
                    </>
                  )}
                </button>
              </div>

              {/* QR Code Section */}
              <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <div className="w-24 h-24 bg-white p-2 rounded-lg border border-gray-200 shrink-0 flex items-center justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(joinUrl)}`}
                    alt="QR Code"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-center sm:text-start">
                  <h4 className="font-semibold text-gray-900 text-sm mb-1 flex items-center justify-center sm:justify-start gap-1.5">
                    <QrCode className="w-4 h-4 text-gray-500" /> {t.qrCodeTitle}
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed mb-3">
                    {t.qrCodeDesc()}
                  </p>
                  <a
                    href={joinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center justify-center sm:justify-start gap-1 w-fit mx-auto sm:mx-0"
                  >
                    {t.testLink} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            /* Pending Requests Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700">
                  {t.pendingRequests} ({filteredRequests.length})
                </h4>
                <button
                  onClick={fetchPendingRequests}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {t.refresh}
                </button>
              </div>

              {loadingRequests ? (
                <div className="py-12 text-center text-sm text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-gray-400" />
                  {t.loading}
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-100 border-dashed">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                  {t.noRequests}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRequests.map((r) => (
                    <div
                      key={r.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-4 transition-colors"
                    >
                      {/* Request Header */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {r.parentName} {r.parentSurname || ""}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                              {r.relation}
                            </span>
                          </div>
                          <div className={`text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1 ${isRTL ? "font-sans" : "font-mono"}`} dir={isRTL ? "rtl" : "ltr"}>
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                              <span dir="ltr">{r.parentPhone}</span>
                            </span>
                            {r.address && (
                              <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                <span>{r.address}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            disabled={processingId === r.id}
                            onClick={() => handleAction(r.id, "REJECT")}
                            className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5 text-gray-400" /> {t.reject}
                          </button>
                          <button
                            disabled={processingId === r.id}
                            onClick={() => handleAction(r.id, "APPROVE")}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            {processingId === r.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" /> {t.approve}
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Children List */}
                      <div className="pt-3 border-t border-gray-100">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                          {t.childrenToRegister} ({r.childrenList?.length || 1})
                        </span>
                        {r.childrenList && r.childrenList.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {r.childrenList.map((c, i) => (
                              <div key={i} className="p-3 bg-gray-50 rounded-md text-sm flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <div className="font-medium text-gray-900">{c.name} {c.surname}</div>
                                  <div className="text-xs text-gray-500 flex items-center gap-2">
                                    <span>{c.birthday ? new Date(c.birthday).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'fr-FR') : t.notSpecified}</span>
                                    <span>•</span>
                                    <span className="font-medium" dir="ltr">{c.className || r.className}</span>
                                  </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.sex === "FEMALE" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"}`}>
                                  {c.sex === "FEMALE" ? t.girl : t.boy}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 bg-gray-50 rounded-md text-sm font-medium text-gray-900">
                            {r.studentFullName} <span className="text-gray-500 font-normal" dir="ltr">({r.className})</span>
                          </div>
                        )}
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
