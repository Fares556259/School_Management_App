"use client";

import { useEffect, useState } from "react";
import {
  User,
  Phone,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Plus,
  Trash2,
  Globe,
  Smartphone,
  Check,
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

type Lang = "fr" | "ar";

const translations = {
  fr: {
    selectLanguageTitle: "Choisissez votre langue",
    selectLanguageSubtitle: "Veuillez sélectionner la langue pour votre formulaire d'inscription",
    schoolHeader: "Inscription Parents",
    subtitle: "Rejoignez l'application pour suivre les notes, absences et bulletins.",
    mainClass: "Classe principale :",
    parentSectionTitle: "INFORMATIONS DU PARENT",
    firstName: "Prénom *",
    firstNamePlaceholder: "Prénom du parent",
    lastName: "Nom de famille *",
    lastNamePlaceholder: "Nom de famille du parent",
    phone: "Téléphone *",
    relation: "Lien de parenté",
    relationFather: "Père",
    relationMother: "Mère",
    relationGuardian: "Tuteur légal",
    address: "Adresse *",
    addressPlaceholder: "ex: Rue Habib Bourguiba, Tunis",
    childrenSectionTitle: "Enfants",
    childrenSubtitle: "Inscrire au moins un élève",
    addSibling: "Ajouter un frère/sœur",
    childLabel: "Élève #",
    childFirstName: "Prénom *",
    childFirstNamePlaceholder: "Prénom de l'enfant",
    childLastName: "Nom de famille *",
    childLastNamePlaceholder: "Nom de famille de l'enfant",
    sex: "Sexe *",
    sexMale: "Garçon",
    sexFemale: "Fille",
    birthday: "Date de naissance *",
    classLabel: "Classe *",
    delete: "Supprimer",
    submitButton: "Envoyer ma demande à la direction",
    submitting: "Transmission de votre demande...",
    successTitle: "Demande d'inscription transmise !",
    successDesc: "La direction de l'établissement validera votre demande très prochainement.",
    successMobileNote: "Vous pourrez vous connecter à l'application mobile avec votre numéro :",
    guideStep1: "Téléchargez l'application (Fichier APK)",
    guideStep2: "Cliquez sur \"Ouvrir\" une fois le téléchargement terminé",
    guideStep3: "Allez dans Paramètres ➔ \"Autoriser depuis cette source\"",
    guideStep4: "Cliquez sur \"Installer\", l'application est prête !",
    requiredError: "Veuillez remplir votre prénom, nom de famille et numéro de téléphone.",
    requiredChildError: "Veuillez remplir les informations complètes pour l'enfant #",
    invalidLink: "Lien invalide ou expiré",
    backToHome: "Retour à l'accueil",
    downloadAppTitle: "Téléchargez l'application",
    downloadAppDesc: "Pour suivre les notes, absences et emploi du temps de votre enfant, téléchargez gratuitement notre application.",
    appStore: "App Store",
    googlePlay: "Google Play",
  },
  ar: {
    selectLanguageTitle: "اختر لغتك المفضلة",
    selectLanguageSubtitle: "الرجاء اختيار اللغة لمتابعة عملية التسجيل",
    schoolHeader: "تسجيل الأولياء",
    subtitle: "انضم إلى التطبيق لمتابعة الأعداد، الغيابات وبطاقات الأعداد.",
    mainClass: "القسم الرئيسي :",
    parentSectionTitle: "معلومات الولي",
    firstName: "الاسم *",
    firstNamePlaceholder: "اسم الولي",
    lastName: "اللقب *",
    lastNamePlaceholder: "لقب الولي",
    phone: "رقم الهاتف *",
    relation: "صلة القرابة",
    relationFather: "أب",
    relationMother: "أم",
    relationGuardian: "ولي أمر",
    address: "العنوان *",
    addressPlaceholder: "مثال: شارع الحبيب بورقيبة، تونس",
    childrenSectionTitle: "الأبناء",
    childrenSubtitle: "تسجيل تلميذ واحد على الأقل",
    addSibling: "إضافة أخ/أخت",
    childLabel: "التلميذ رقم ",
    childFirstName: "اسم التلميذ *",
    childFirstNamePlaceholder: "اسم التلميذ",
    childLastName: "لقب التلميذ *",
    childLastNamePlaceholder: "لقب التلميذ",
    sex: "الجنس *",
    sexMale: "ولد",
    sexFemale: "بنت",
    birthday: "تاريخ الولادة *",
    classLabel: "القسم *",
    delete: "حذف",
    submitButton: "إرسال الطلب إلى إدارة المدرسة",
    submitting: "جاري إرسال طلب التسجيل...",
    successTitle: "تم إرسال طلب التسجيل بنجاح!",
    successDesc: "ستقوم إدارة المدرسة بمراجعة وتأكيد طلبكم في أقرب وقت ممكن.",
    successMobileNote: "يمكنكم تسجيل الدخول إلى تطبيق الجوال باستخدام رقم الهاتف :",
    guideStep1: "قم بتحميل التطبيق (ملف APK)",
    guideStep2: "اضغط على \"فتح\" بعد انتهاء التحميل",
    guideStep3: "اذهب إلى الإعدادات ➔ \"السماح من هذا المصدر\"",
    guideStep4: "اضغط على \"تثبيت\"، التطبيق جاهز للاستخدام!",
    requiredError: "الرجاء تعبئة الاسم، اللقب ورقم الهاتف.",
    requiredChildError: "الرجاء تعبئة المعلومات الكاملة للتلميذ رقم ",
    invalidLink: "رابط غير صلح أو منتهي الصلاحية",
    backToHome: "العودة إلى الصفحة الرئيسية",
    downloadAppTitle: "حمل التطبيق الآن",
    downloadAppDesc: "لمتابعة أعداد، غيابات وجدول أوقات ابنك، قم بتحميل تطبيقنا المجاني.",
    appStore: "آب ستور",
    googlePlay: "جوجل بلاي",
  },
};

export default function PublicParentJoinPage({ params }: PageProps) {
  const classIdParam = params?.classId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Language selection modal state
  const [showLangModal, setShowLangModal] = useState(true);
  const [lang, setLang] = useState<Lang>("fr");

  const t = translations[lang];
  const isRtl = lang === "ar";

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

  const selectLanguage = (selectedLang: Lang) => {
    setLang(selectedLang);
    setShowLangModal(false);
  };

  const addSibling = () => {
    const newId = `child-${Date.now()}`;
    setChildren((prev) => [
      ...prev,
      {
        id: newId,
        name: "",
        surname: parentSurname || "",
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
      setError(t.requiredError);
      return;
    }

    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (!c.name.trim() || !c.surname.trim() || !c.birthday) {
        setError(`${t.requiredChildError}${i + 1}.`);
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
          <p className="text-sm font-medium text-slate-500">Chargement...</p>
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
          <h2 className="text-xl font-bold text-slate-900">{t.invalidLink}</h2>
          <p className="text-sm text-slate-500">{error}</p>
          <a
            href="/"
            className="inline-block px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
          >
            {t.backToHome}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-screen bg-gradient-to-b from-blue-50/70 via-slate-50 to-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans relative"
    >
      {/* ── 1. INITIAL LANGUAGE CHOICE MODAL ── */}
      {showLangModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md p-6 sm:p-8 text-center space-y-6">
            {/* Header Icon & School Badge */}
            <div className="space-y-3">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-600/30">
                <Globe className="w-7 h-7" />
              </div>

              <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-100 uppercase tracking-wider">
                {classData?.schoolName && !classData.schoolName.includes("@")
                  ? classData.schoolName
                  : "SnapSchool Academy"}
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Bienvenue / أهلاً بكم
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Veuillez choisir votre langue pour continuer
                <br />
                <span className="text-slate-400 font-normal text-xs">الرجاء اختيار اللغة لمتابعة التسجيل</span>
              </p>
            </div>

            {/* Language Choice Cards */}
            <div className="space-y-3 pt-1">
              {/* French Choice */}
              <button
                type="button"
                onClick={() => selectLanguage("fr")}
                className="w-full p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-600 bg-slate-50/60 hover:bg-blue-50/40 flex items-center gap-4 text-left transition-all duration-200 group shadow-xs hover:shadow-md cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-2xl shrink-0 border border-slate-200/80 shadow-xs group-hover:scale-105 transition-transform">
                  🇫🇷
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <h3 className="font-bold text-slate-900 group-hover:text-blue-600 text-sm sm:text-base flex items-center gap-2">
                    Français
                  </h3>
                  <p className="text-xs text-slate-500 truncate">
                    Formulaire d&apos;inscription en français
                  </p>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-200/60 group-hover:bg-blue-600 text-slate-400 group-hover:text-white flex items-center justify-center transition-all shrink-0">
                  <Check className="w-4 h-4" />
                </div>
              </button>

              {/* Arabic Choice */}
              <button
                type="button"
                onClick={() => selectLanguage("ar")}
                className="w-full p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-600 bg-slate-50/60 hover:bg-blue-50/40 flex items-center gap-4 text-left transition-all duration-200 group shadow-xs hover:shadow-md cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-2xl shrink-0 border border-slate-200/80 shadow-xs group-hover:scale-105 transition-transform">
                  🇹🇳
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <h3 className="font-bold text-slate-900 group-hover:text-blue-600 text-sm sm:text-base flex items-center gap-2">
                    العربية
                  </h3>
                  <p className="text-xs text-slate-500 truncate">
                    استمارة التسجيل باللغة العربية
                  </p>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-200/60 group-hover:bg-blue-600 text-slate-400 group-hover:text-white flex items-center justify-center transition-all shrink-0">
                  <Check className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. MAIN REGISTRATION FORM ── */}
      <div className="w-full max-w-xl">
        {/* Top Header Controls: School Badge + Language Switcher Pill */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
          <div className="inline-flex items-center gap-2.5 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-xs">
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

          {/* Persistent Language Switcher Pill */}
          <div className="flex items-center bg-white p-1 rounded-full border border-slate-200 shadow-xs">
            <button
              onClick={() => setLang("fr")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                lang === "fr"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🇫🇷</span> Français
            </button>
            <button
              onClick={() => setLang("ar")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                lang === "ar"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🇹🇳</span> العربية
            </button>
          </div>
        </div>

        {/* Page Title & Subtitle */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {t.schoolHeader}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t.subtitle}
          </p>
        </div>

        {/* Form Container Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Header banner */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-base leading-tight">{t.schoolHeader}</h2>
                <p className="text-xs text-blue-100">{classData?.schoolName}</p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {success ? (
              <div className="text-center space-y-8 py-8 animate-in zoom-in duration-500">
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner relative">
                    <div className="absolute inset-0 bg-emerald-400/20 blur-xl rounded-full animate-pulse"></div>
                    <CheckCircle2 className="w-10 h-10 relative z-10" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">{t.successTitle}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
                      {t.successDesc}
                    </p>
                  </div>
                </div>

                <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl border border-blue-100 text-left" dir={isRtl ? "rtl" : "ltr"}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-xs flex items-center justify-center shrink-0">
                      <Smartphone className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{t.downloadAppTitle}</h4>
                      <p className="text-xs text-slate-500">{t.downloadAppDesc}</p>
                    </div>
                  </div>

                  <div className="text-xs text-slate-700 mb-5 bg-white/80 p-4 rounded-xl border border-white shadow-sm flex flex-col gap-3 font-medium">
                    <p className="flex items-start gap-2.5"><span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-[-1px]">1</span> <span className="flex-1">{t.guideStep1 || "Téléchargez l'application (Fichier APK)"}</span></p>
                    <p className="flex items-start gap-2.5"><span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-[-1px]">2</span> <span className="flex-1">{t.guideStep2 || "Cliquez sur Ouvrir"}</span></p>
                    <p className="flex items-start gap-2.5"><span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-[-1px]">3</span> <span className="flex-1">{t.guideStep3 || "Allez dans Paramètres ➔ Autoriser depuis cette source"}</span></p>
                    <p className="flex items-start gap-2.5"><span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-[-1px]">4</span> <span className="flex-1">{t.guideStep4 || "Cliquez sur Installer, l'application est prête !"}</span></p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
                    <a href={process.env.NEXT_PUBLIC_APK_DOWNLOAD_URL || "#"} download target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-6 py-3.5 rounded-2xl flex items-center justify-center gap-3 transition-transform hover:scale-105">
                      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      <div className="text-center font-bold text-sm">
                        {lang === "fr" ? "Télécharger l'application" : "تنزيل التطبيق"}
                      </div>
                    </a>
                  </div>
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
                    <User className="w-4 h-4" /> {t.parentSectionTitle}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        {t.firstName}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={t.firstNamePlaceholder}
                        value={parentName}
                        onChange={(e) => setParentName(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        {t.lastName}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={t.lastNamePlaceholder}
                        value={parentSurname}
                        onChange={(e) => setParentSurname(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        {t.phone}
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+216 98 123 456"
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        {t.relation}
                      </label>
                      <select
                        value={relation}
                        onChange={(e) => setRelation(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                      >
                        <option value="Père">{t.relationFather}</option>
                        <option value="Mère">{t.relationMother}</option>
                        <option value="Tuteur">{t.relationGuardian}</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        {t.address}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={t.addressPlaceholder}
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
                      <h3 className="text-base font-bold text-slate-900">{t.childrenSectionTitle}</h3>
                      <p className="text-xs text-slate-500">{t.childrenSubtitle}</p>
                    </div>

                    <button
                      type="button"
                      onClick={addSibling}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> {t.addSibling}
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
                            {t.childLabel}{idx + 1}
                          </span>

                          {children.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSibling(child.id)}
                              className="text-xs font-bold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> {t.delete}
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              {t.childFirstName}
                            </label>
                            <input
                              type="text"
                              required
                              placeholder={t.childFirstNamePlaceholder}
                              value={child.name}
                              onChange={(e) => updateChildField(child.id, "name", e.target.value)}
                              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              {t.childLastName}
                            </label>
                            <input
                              type="text"
                              required
                              placeholder={t.childLastNamePlaceholder}
                              value={child.surname}
                              onChange={(e) => updateChildField(child.id, "surname", e.target.value)}
                              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              {t.sex}
                            </label>
                            <select
                              value={child.sex}
                              onChange={(e) => updateChildField(child.id, "sex", e.target.value)}
                              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                            >
                              <option value="MALE">{t.sexMale}</option>
                              <option value="FEMALE">{t.sexFemale}</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              {t.birthday}
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
                              {t.classLabel}
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
                        {t.submitButton}
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
