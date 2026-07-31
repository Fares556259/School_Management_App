"use client";

import { useEffect, useState } from "react";
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
  Plus,
  Trash2,
  Calendar,
  MapPin,
  Smartphone,
} from "lucide-react";

interface PageProps {
  params: { classId: string };
}

interface ChildItem {
  id: string;
  name: string;
  surname: string;
  sex: "MALE" | "FEMALE";
  birthday: string;
  classId: number;
}

export default function PublicParentJoinPage({ params }: PageProps) {
  const classIdParam = params?.classId;

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
    classes: { id: number; name: string }[];
  } | null>(null);

  // Parent form state
  const [parentName, setParentName] = useState("");
  const [parentSurname, setParentSurname] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [address, setAddress] = useState("");
  const [relation, setRelation] = useState("Père");
  const [email, setEmail] = useState("");

  // Children list state
  const [children, setChildren] = useState<ChildItem[]>([]);

  useEffect(() => {
    async function fetchClassInfo() {
      try {
        setLoading(true);
        const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
        const queryClassId = urlParams.get("classId");
        const apiUrl = queryClassId
          ? `/api/join/class-info?slug=${classIdParam}&classId=${queryClassId}`
          : `/api/join/class-info?slug=${classIdParam}`;

        const res = await fetch(apiUrl);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Établissement ou classe non trouvée");
        } else {
          setClassData(data);
          const initialClassId = queryClassId ? parseInt(queryClassId, 10) : data.classId;
          setChildren([
            {
              id: "child-1",
              name: "",
              surname: "",
              sex: "MALE",
              birthday: "2016-05-15",
              classId: isNaN(initialClassId) ? data.classId : initialClassId,
            },
          ]);
        }
      } catch (err: any) {
        setError("Impossible de charger les informations de l'établissement.");
      } finally {
        setLoading(false);
      }
    }
    fetchClassInfo();
  }, [classIdParam]);

  const addSibling = () => {
    const newId = `child-${Date.now()}`;
    setChildren((prev) => [
      ...prev,
      {
        id: newId,
        name: "",
        surname: parentSurname || "", // Pre-fill with parent's surname
        sex: "MALE",
        birthday: "2017-09-01",
        classId: classData?.classId || 1,
      },
    ]);
  };

  const removeSibling = (id: string) => {
    if (children.length <= 1) return;
    setChildren((prev) => prev.filter((c) => c.id !== id));
  };

  const updateChildField = (id: string, field: keyof ChildItem, value: any) => {
    setChildren((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentName.trim() || !parentSurname.trim() || !parentPhone.trim()) {
      setError("Veuillez remplir votre prénom, nom de famille et numéro de téléphone.");
      return;
    }

    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (!c.name.trim() || !c.surname.trim() || !c.birthday) {
        setError(`Veuillez remplir les informations complètes pour l'enfant #${i + 1}.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch("/api/join/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: classData?.classId,
          parentName,
          parentSurname,
          parentPhone,
          address,
          relation,
          email: email || null,
          children,
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
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-600/30 mx-auto animate-pulse">
            S
          </div>
          <p className="text-sm font-medium text-slate-500">Chargement du formulaire d&apos;inscription...</p>
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
          <h2 className="text-xl font-bold text-slate-900">Lien invalide ou expiré</h2>
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
      <div className="w-full max-w-xl">
        {/* School Header Badge */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2.5 bg-white px-4 py-2.5 rounded-full border border-slate-200 shadow-xs mb-3">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs overflow-hidden shrink-0">
              {classData?.schoolLogo ? (
                <img src={classData.schoolLogo} alt="" className="w-full h-full object-cover" />
              ) : (
                (classData?.schoolName || "S").slice(0, 1).toUpperCase()
              )}
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight">
              {classData?.schoolName && !classData.schoolName.includes("@")
                ? classData.schoolName
                : "SnapSchool Academy"}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Ajouter Nouveau Parent
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Rejoignez l&apos;application pour suivre les notes, absences et bulletins.
          </p>
        </div>

        {/* Main Form Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Header banner */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-base leading-tight">Classe principale : {classData?.className}</h2>
                <p className="text-xs text-blue-100">{classData?.levelName}</p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {success ? (
              <div className="text-center space-y-5 py-4">
                <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">Demande d&apos;inscription transmise !</h3>
                  <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
                    La direction de l&apos;établissement <span className="font-semibold text-slate-800">{classData?.schoolName}</span> validera votre demande très prochainement.
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 flex items-center gap-3 text-left">
                  <Smartphone className="w-5 h-5 text-blue-600 shrink-0" />
                  <span>Vous pourrez vous connecter à l&apos;application mobile avec votre numéro : <strong>{parentPhone}</strong></span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-start gap-2.5 text-xs font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                {/* PARENT DETAILS */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-4 h-4" /> Informations du Parent
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Prénom *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Prénom du parent"
                        value={parentName}
                        onChange={(e) => setParentName(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Nom de famille *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Nom de famille du parent"
                        value={parentSurname}
                        onChange={(e) => setParentSurname(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Téléphone *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+216 98 123 456"
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Lien de parenté
                      </label>
                      <select
                        value={relation}
                        onChange={(e) => setRelation(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                      >
                        <option value="Père">Père</option>
                        <option value="Mère">Mère</option>
                        <option value="Tuteur">Tuteur légal</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Adresse *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ex: Rue Habib Bourguiba, Tunis"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* CHILDREN SECTION */}
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Enfants</h3>
                      <p className="text-xs text-slate-500">Inscrire au moins un élève</p>
                    </div>

                    <button
                      type="button"
                      onClick={addSibling}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Ajouter un frère/sœur
                    </button>
                  </div>

                  {/* CHILDREN CARDS */}
                  <div className="space-y-4">
                    {children.map((child, idx) => (
                      <div
                        key={child.id}
                        className="relative p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                            Élève #{idx + 1}
                          </span>

                          {children.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSibling(child.id)}
                              className="text-xs font-bold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Supprimer
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Prénom *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Prénom de l'enfant"
                              value={child.name}
                              onChange={(e) => updateChildField(child.id, "name", e.target.value)}
                              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Nom de famille *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Nom de famille de l'enfant"
                              value={child.surname}
                              onChange={(e) => updateChildField(child.id, "surname", e.target.value)}
                              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Sexe *
                            </label>
                            <select
                              value={child.sex}
                              onChange={(e) => updateChildField(child.id, "sex", e.target.value)}
                              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                            >
                              <option value="MALE">Garçon</option>
                              <option value="FEMALE">Fille</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Date de naissance *
                            </label>
                            <input
                              type="date"
                              required
                              value={child.birthday}
                              onChange={(e) => updateChildField(child.id, "birthday", e.target.value)}
                              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Classe *
                            </label>
                            <select
                              value={child.classId}
                              onChange={(e) => updateChildField(child.id, "classId", parseInt(e.target.value, 10))}
                              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                            >
                              {classData?.classes?.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SUBMIT BUTTONS */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Envoyer ma demande à la direction
                        <Send className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
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
