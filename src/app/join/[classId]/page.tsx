"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import {
  User,
  Phone,
  Mail,
  Building2,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  HelpCircle,
  Sparkles,
  Smartphone,
} from "lucide-react";

interface PageProps {
  params: Promise<{ classId: string }>;
}

export default function PublicParentJoinPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const classId = resolvedParams.classId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [classData, setClassData] = useState<{
    classId: number;
    className: string;
    levelName: string;
    schoolName: string;
    schoolLogo: string | null;
    schoolId: string;
    students: { id: string; fullName: string; hasParent: boolean }[];
  } | null>(null);

  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [customStudentName, setCustomStudentName] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [relation, setRelation] = useState("Père");
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function fetchClassInfo() {
      try {
        setLoading(true);
        const res = await fetch(`/api/join/class-info?classId=${classId}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Classe non trouvée");
        } else {
          setClassData(data);
          if (data.students && data.students.length > 0) {
            setSelectedStudentId(data.students[0].id);
          }
        }
      } catch (err: any) {
        setError("Impossible de charger les informations de la classe.");
      } finally {
        setLoading(false);
      }
    }
    fetchClassInfo();
  }, [classId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentName.trim() || !parentPhone.trim()) {
      setError("Veuillez remplir votre nom et votre numéro de téléphone.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch("/api/join/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: classData?.classId,
          studentId: selectedStudentId !== "custom" ? selectedStudentId : null,
          customStudentName: selectedStudentId === "custom" ? customStudentName : null,
          parentName,
          parentPhone,
          relation,
          email: email || null,
          schoolId: classData?.schoolId,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Une erreur est survenue lors de la soumission.");
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError("Une erreur réseau est survenue. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-600/30 mx-auto animate-pulse">
            S
          </div>
          <p className="text-sm font-medium text-slate-500">Chargement des informations de la classe...</p>
        </div>
      </div>
    );
  }

  if (error && !classData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Lien invalide</h2>
          <p className="text-sm text-slate-500">{error}</p>
          <a
            href="/"
            className="inline-block px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
          >
            Retour à l&apos;accueil
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/70 via-slate-50 to-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-lg">
        {/* School Header Badge */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2.5 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm mb-4">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">
              S
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight">
              {classData?.schoolName || "SnapSchool"}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Inscription Parents
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Rejoignez l&apos;application pour suivre les notes, absences et bulletins.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Class banner */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight">Classe : {classData?.className}</h2>
                <p className="text-xs text-blue-100">{classData?.levelName}</p>
              </div>
            </div>
            <div className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold backdrop-blur-md">
              {classData?.students.length || 0} Élèves
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {success ? (
              <div className="text-center space-y-5 py-4">
                <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">Demande envoyée avec succès !</h3>
                  <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
                    La direction de l&apos;établissement <span className="font-semibold text-slate-800">{classData?.schoolName}</span> a bien reçu votre inscription. Dès validation, vous recevrez l&apos;accès à l&apos;application SnapSchool.
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 flex items-center gap-3 text-left">
                  <Smartphone className="w-5 h-5 text-blue-600 shrink-0" />
                  <span>Vous pourrez vous connecter à l&apos;application mobile avec le numéro : <strong>{parentPhone}</strong></span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-start gap-2.5 text-xs font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                {/* 1. Student Selection */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">
                    1. Sélectionnez votre enfant dans la classe *
                  </label>
                  <div className="relative">
                    <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3.5 text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 appearance-none"
                    >
                      {classData?.students.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.fullName} {st.hasParent ? "✓ (Parent associé)" : ""}
                        </option>
                      ))}
                      <option value="custom">➕ Mon enfant n&apos;est pas encore sur la liste...</option>
                    </select>
                  </div>
                </div>

                {selectedStudentId === "custom" && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">
                      Nom et Prénom de l&apos;enfant *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ex: Sarah Triki"
                      value={customStudentName}
                      onChange={(e) => setCustomStudentName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                )}

                {/* 2. Parent Name */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">
                    2. Vos nom et prénom (Parent) *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="ex: Mohamed Triki"
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3.5 text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                </div>

                {/* 3. Phone & Relation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">
                      Téléphone WhatsApp *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        required
                        placeholder="+216 98 123 456"
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3.5 text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">
                      Lien de parenté
                    </label>
                    <select
                      value={relation}
                      onChange={(e) => setRelation(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 appearance-none"
                    >
                      <option value="Père">Père</option>
                      <option value="Mère">Mère</option>
                      <option value="Tuteur">Tuteur légal</option>
                    </select>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-blue-600 text-white font-bold text-sm rounded-2xl hover:bg-blue-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-blue-600/25 mt-2"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Envoyer ma demande à la direction
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Propulsé par <span className="font-semibold text-slate-600">SnapSchool</span> — Solution de gestion scolaire
        </p>
      </div>
    </div>
  );
}
