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

  const whatsappMessage = `Chers parents de la classe ${currentClass?.name || ""}, rejoignez l'application SnapSchool de l'établissement ${displaySchoolName} pour suivre les notes, absences et bulletins de votre enfant en cliquant sur ce lien : ${joinUrl}`;
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
        alert(data.error || "Erreur lors du traitement");
      }
    } catch (err) {
      alert("Erreur réseau");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = pendingRequests.filter(
    (r) => !selectedClassId || r.classId === selectedClassId
  );

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Inscriptions & Demandes Parents</h3>
              <p className="text-xs text-blue-100">Partagez le lien d&apos;inscription et validez les demandes parents</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs & Class Selector */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Class Select Dropdown */}
          <div className="w-full sm:w-auto flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Classe :</label>
            <select
              value={selectedClassId || ""}
              onChange={(e) => setSelectedClassId(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.studentCount ? `(${c.studentCount} élèves)` : ""}
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
              📲 Lien d&apos;inscription
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`flex-1 sm:flex-none px-3.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "requests"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Demandes</span>
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
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-green-600" />
                  Message d&apos;invitation WhatsApp
                </label>
                <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 text-xs text-slate-700 leading-relaxed font-mono">
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
                  Partager sur WhatsApp
                </a>

                <button
                  onClick={copyToClipboard}
                  className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" /> Lien copié !
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> Copier le lien
                    </>
                  )}
                </button>
              </div>

              {/* QR Code Section */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                <div className="w-24 h-24 bg-white p-2 rounded-xl border border-slate-200 shrink-0 flex items-center justify-center shadow-xs">
                  {/* Visual QR Code Image generated via QR API */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(joinUrl)}`}
                    alt="QR Code Inscription Parents"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs mb-1 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-blue-600" /> Code QR pour affichage / réunion
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed mb-2">
                    Imprimez ce code QR ou affichez-le lors des réunions de parents d&apos;élèves de la classe <strong className="text-slate-800">{currentClass?.name}</strong>.
                  </p>
                  <a
                    href={joinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Tester la page d&apos;inscription parent <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </>
          ) : (
            /* Pending Requests Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-xs text-slate-700 uppercase">
                  Demandes d&apos;inscription en attente ({filteredRequests.length})
                </h4>
                <button
                  onClick={fetchPendingRequests}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Actualiser
                </button>
              </div>

              {loadingRequests ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                  Chargement des demandes...
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 p-6">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                  Aucune demande en attente de validation pour cette classe.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredRequests.map((r) => (
                    <div
                      key={r.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-slate-300 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {r.parentName} {r.parentSurname || ""}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold">
                            {r.relation}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-mono">📱 {r.parentPhone} • 📍 {r.address || "Adresse non renseignée"}</p>
                        
                        <div className="pt-1.5 space-y-1">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                            Enfant(s) à inscrire ({r.childrenList?.length || 1}) :
                          </span>
                          {r.childrenList && r.childrenList.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2 mt-1">
                              {r.childrenList.map((c, i) => (
                                <div key={i} className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold text-slate-900">{c.name} {c.surname}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.sex === "FEMALE" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"}`}>
                                      {c.sex === "FEMALE" ? "Fille" : "Garçon"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] text-slate-600 font-medium">
                                    <span>🎂 {c.birthday ? new Date(c.birthday).toLocaleDateString("fr-FR") : "Non spécifié"}</span>
                                    <span>🏫 {c.className || r.className}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-800 font-semibold">{r.studentFullName} ({r.className})</span>
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
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approuver
                            </>
                          )}
                        </button>
                        <button
                          disabled={processingId === r.id}
                          onClick={() => handleAction(r.id, "REJECT")}
                          className="px-3 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Refuser
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
