"use client";

import React, { useState, useMemo } from "react";
import { 
  Search, 
  X, 
  ChevronDown, 
  CheckCircle2, 
  MessageSquare, 
  Phone, 
  Mail, 
  BookOpen, 
  CreditCard, 
  Calendar, 
  GraduationCap, 
  QrCode, 
  Users, 
  Layers, 
  ArrowRight, 
  Clock, 
  ShieldCheck, 
  Headphones, 
  Sparkles,
  ExternalLink
} from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import ShareParentLinkModal from "@/components/ShareParentLinkModal";

interface GuideItem {
  id: string;
  category: "finance" | "timetable" | "grades" | "mobile" | "staff" | "admin";
  badge: { fr: string; en: string; ar: string };
  badgeColor: string;
  icon: React.ReactNode;
  title: { fr: string; en: string; ar: string };
  description: { fr: string; en: string; ar: string };
  steps: { fr: string[]; en: string[]; ar: string[] };
  href?: string;
  actionText?: { fr: string; en: string; ar: string };
  isModalTrigger?: boolean;
}

interface FaqItem {
  category: "finance" | "timetable" | "grades" | "mobile" | "staff" | "admin";
  question: { fr: string; en: string; ar: string };
  answer: { fr: string; en: string; ar: string };
}

const GUIDES: GuideItem[] = [
  {
    id: "partial-payments",
    category: "finance",
    badge: { fr: "Finances & Scolarité", en: "Finance & Tuition", ar: "المالية والمصاريف" },
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <CreditCard className="text-blue-600" size={20} />,
    title: {
      fr: "Encaisser une tranche & Suivre les reliquats",
      en: "Record Installments & Track Balances",
      ar: "تسجيل الأقساط ومتابعة المبالغ المتبقية"
    },
    description: {
      fr: "Comment enregistrer un paiement partiel de scolarité et suivre les échéances impayées dans la file de recouvrement.",
      en: "How to record a partial tuition payment and track overdue amounts in the recovery queue.",
      ar: "كيفية تسجيل دفع جزئي لمصاريف الدراسة ومتابعة المتأخرات في جدول الاستخلاص."
    },
    steps: {
      fr: [
        "Accédez au menu Finance > Paiements Partiels.",
        "Cliquez sur 'Encaisser' sur l'élève concerné et saisissez le montant versé (la cascade s'applique automatiquement sur les mois).",
        "Consultez la File de Recouvrement pour relancer les reliquats échus avant la fin du mois."
      ],
      en: [
        "Go to Finance > Partial Payments in the menu.",
        "Click 'Collect' on the student row and enter the paid amount (applied automatically across pending months).",
        "Check the Recovery Queue to follow up on overdue balances before month-end."
      ],
      ar: [
        "انتقل إلى المالية > المدفوعات الجزئية في القائمة.",
        "انقر على 'استخلاص' بجانب التلميذ وأدخل المبلغ المدفوع (يتم احتساب الأشهر تلقائياً).",
        "راجع قائمة الاستخلاص لمتابعة المتأخرات قبل نهاية الشهر."
      ]
    },
    href: "/list/payments-partial",
    actionText: { fr: "Ouvrir les Recouvrements", en: "Open Recovery Queue", ar: "فتح جدول الاستخلاص" }
  },
  {
    id: "timetable-management",
    category: "timetable",
    badge: { fr: "Emploi du Temps", en: "Timetable", ar: "جدول الأوقات" },
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
    icon: <Calendar className="text-indigo-600" size={20} />,
    title: {
      fr: "Gérer l'emploi du temps & Exporter en PDF",
      en: "Manage Timetable & Export to PDF",
      ar: "إدارة جدول الحصص والتصدير بصيغة PDF"
    },
    description: {
      fr: "Planification des créneaux de cours (1h, 1h30, 2h) sans conflit d'enseignant ni de salle, avec impression haute définition.",
      en: "Schedule course sessions (1h, 1.5h, 2h) conflict-free for teachers and classrooms, with printable HD PDF export.",
      ar: "توزيع الحصص الدراسية بدون تعارض في القاعات أو الأساتذة مع إمكانية الطباعة بجودة عالية."
    },
    steps: {
      fr: [
        "Rendez-vous dans Académie > Emploi du Temps.",
        "Filtrez par classe ou par enseignant pour visualiser la grille horaire hebdomadaire.",
        "Cliquez sur 'Exporter PDF' en haut à droite pour obtenir la grille officielle prête à afficher dans l'école."
      ],
      en: [
        "Go to Academics > Timetable.",
        "Filter by class or teacher to view the weekly schedule grid.",
        "Click 'Export PDF' at the top right to download the official printable schedule."
      ],
      ar: [
        "توجه إلى التعليم > جدول الأوقات.",
        "حدد الفصل أو المعلم لعرض جدول الحصص الأسبوعي.",
        "انقر على 'تصدير PDF' في الأعلى للحصول على الجدول الرسمي جاهزاً للطباعة."
      ]
    },
    href: "/admin/timetable",
    actionText: { fr: "Gérer l'Emploi du Temps", en: "Open Timetable", ar: "عرض جدول الأوقات" }
  },
  {
    id: "grades-report-cards",
    category: "grades",
    badge: { fr: "Notes & Bulletins", en: "Grades & Bulletins", ar: "الأعداد وبطاقات الأعداد" },
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    icon: <GraduationCap className="text-purple-600" size={20} />,
    title: {
      fr: "Saisie des notes & Impression des bulletins",
      en: "Grade Entry & Report Card Generation",
      ar: "رصد الأعداد وطباعة بطاقات الأعداد"
    },
    description: {
      fr: "Saisie rapide sur le barème officiel tunisien (0 à 20) et génération des bulletins trimestriels avec coefficients.",
      en: "Fast grading using the official 0-20 scale and generation of quarterly report cards with coefficients.",
      ar: "رصد الأعداد حسب المعايير الرسمية (0 إلى 20) واستخراج بطاقات الأعداد الثلاثية مع الضوارب."
    },
    steps: {
      fr: [
        "Allez dans Académie > Grades (ou Résultats).",
        "Sélectionnez la classe et le trimestre (Trimestre 1, 2 ou 3).",
        "Saisissez les notes de contrôle, synthèse ou TP, puis téléchargez les bulletins au format A4 officiel."
      ],
      en: [
        "Go to Academics > Grades (or Results).",
        "Select the class and target term (Term 1, 2, or 3).",
        "Enter test and exam marks; generate customized A4 report cards with the school logo."
      ],
      ar: [
        "توجه إلى التعليم > الأعداد (أو النتائج).",
        "اختر الفصل والثلاثي المعني (الثلاثي 1 أو 2 أو 3).",
        "أدخل فروض المراقبة والتأليفية، ثم استخرج بطاقات الأعداد الرسمية A4 مع شعار المدرسة."
      ]
    },
    href: "/admin/grades",
    actionText: { fr: "Saisie des Notes & Bulletins", en: "Grades & Bulletins", ar: "رصد الأعداد والنتائج" }
  },
  {
    id: "parent-mobile-invite",
    category: "mobile",
    badge: { fr: "Application Mobile", en: "Mobile App", ar: "تطبيق الجوال" },
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <QrCode className="text-emerald-600" size={20} />,
    title: {
      fr: "Inviter les parents & Générer le flyer QR Code",
      en: "Invite Parents & Generate QR Flyer",
      ar: "دعوة الأولياء وإنشاء رمز QR للطباعة"
    },
    description: {
      fr: "Permettez aux parents d'accéder à l'application mobile SnapSchool pour suivre notes, absences et paiements.",
      en: "Enable families to join the SnapSchool mobile app to view grades, attendance, and tuition statuses.",
      ar: "تمكين الأولياء من الدخول لتطبيق الهاتف لمتابعة أعداد أبنائهم والغيابات والدفعات."
    },
    steps: {
      fr: [
        "Cliquez sur le bouton ci-dessous pour ouvrir l'outil d'invitation parentale.",
        "Imprimez la circulaire officielle avec code QR ou partagez le lien d'accès directement sur WhatsApp.",
        "Validez les demandes d'inscription des parents dans l'onglet des requêtes."
      ],
      en: [
        "Click the button below to launch the parent invitation tool.",
        "Print the official QR registration flyer or share the invitation link on WhatsApp.",
        "Approve incoming parent registration requests in the requests tab."
      ],
      ar: [
        "انقر على الزر أدناه لفتح أداة دعوة الأولياء.",
        "اطبع المنشور الرسمي الذي يحتوي على رمز QR أو شارك رابط التسجيل عبر واتساب.",
        "قم بتأكيد طلبات انضمام الأولياء في نافذة الطلبات."
      ]
    },
    isModalTrigger: true,
    actionText: { fr: "Générer le Code QR & Inviter", en: "Generate QR & Invite", ar: "إنشاء رمز QR والدعوة" }
  },
  {
    id: "teacher-salaries",
    category: "staff",
    badge: { fr: "Personnel & Salaires", en: "Staff & Payroll", ar: "المعلمون والرواتب" },
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <Users className="text-amber-600" size={20} />,
    title: {
      fr: "Verser une avance & Clôturer les salaires",
      en: "Record Salary Advances & Settle Month",
      ar: "تسجيل التسبيقات وتسوية الرواتب الشهرية"
    },
    description: {
      fr: "Enregistrement des acomptes accordés en cours de mois avec déduction automatique sur le solde final.",
      en: "Log mid-month advances with automated deduction from the net month-end payout.",
      ar: "تسجيل التسبيقات المالية أثناء الشهر مع خصمها آلياً من الراتب النهائي عند نهاية الشهر."
    },
    steps: {
      fr: [
        "Consultez Personnes > Enseignants (ou Personnel).",
        "Cliquez sur 'Gérer le Salaire' sur le profil pour verser une avance ponctuelle (catégorisée automatiquement en AVANCE).",
        "En fin de mois, validez le virement : le total des avances est automatiquement déduit du net à payer."
      ],
      en: [
        "Go to People > Teachers (or Staff).",
        "Click 'Manage Salary' on the profile to disburse an advance (automatically tracked as ADVANCE).",
        "At month-end, finalize payment: all advances are automatically deducted from the remaining owed balance."
      ],
      ar: [
        "توجه إلى المستخدمين > الأساتذة (أو الموظفون).",
        "انقر على 'إدارة الراتب' لتسجيل تسبيق مالي (يتم تصنيفه تلقائياً في المصاريف).",
        "في نهاية الشهر، عند صرف الراتب يتم خصم مجموع التسبيقات آلياً من المبلغ الصافي."
      ]
    },
    href: "/list/teachers",
    actionText: { fr: "Gérer les Enseignants", en: "Manage Teachers", ar: "إدارة الأساتذة" }
  },
  {
    id: "attendance-discipline",
    category: "admin",
    badge: { fr: "Présence & Discipline", en: "Attendance", ar: "الحضور والغياب" },
    badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
    icon: <Layers className="text-slate-600" size={20} />,
    title: {
      fr: "Pointage des absences & Alertes immédiates",
      en: "Attendance Tracking & Instant Alerts",
      ar: "تسجيل الغيابات وتنبيه الأولياء"
    },
    description: {
      fr: "Saisie d'assiduité par séance de cours et notification instantanée sur le smartphone des parents.",
      en: "Log period-by-period absences and send instant push notifications to parents' smartphones.",
      ar: "تسجيل غياب وتأخر التلاميذ في كل حصة مع إشعار فوري للأولياء على هواتفهم."
    },
    steps: {
      fr: [
        "Ouvrez Opérations > Présence.",
        "Sélectionnez la classe et le créneau pour cocher les élèves absents ou en retard.",
        "Le pointage s'enregistre instantanément et alimente le rapport journalier de la direction."
      ],
      en: [
        "Navigate to Operations > Attendance.",
        "Select the class and time slot to mark absent or tardy students.",
        "Records update in real-time and feed into the administrative daily activity report."
      ],
      ar: [
        "افتح العمليات > الحضور.",
        "حدد الفصل والحصة لتسجيل المتغيبين أو المتأخرين بنقرة واحدة.",
        "يتم حفظ السجل فوراً ويُدرج ضمن التقرير اليومي للإدارة."
      ]
    },
    href: "/admin/attendance",
    actionText: { fr: "Pointer les Présences", en: "Open Attendance", ar: "تسجيل الحضور" }
  }
];

const FAQS: FaqItem[] = [
  {
    category: "finance",
    question: {
      fr: "Comment fonctionne le paiement échelonné (par mois / tranches) pour un élève ?",
      en: "How does installment / monthly tuition payment work for a student?",
      ar: "كيف يعمل نظام الدفع بالأقساط أو بالأشهر بالنسبة للتلميذ؟"
    },
    answer: {
      fr: "SnapSchool gère automatiquement la cascade des mensualités scolaires. Lorsque vous enregistrez un versement partiel, le montant règle en priorité les mois les plus anciens. S'il reste un solde, il apparaît immédiatement en surbrillance orange dans la 'File de Recouvrement' avec sa date d'échéance prévue.",
      en: "SnapSchool automatically handles tuition cascades. When a partial payment is entered, funds cover the earliest unpaid months first. Any remaining balance is immediately highlighted in orange in the 'Recovery Queue' with its expected due date.",
      ar: "يعتمد تطبيق SnapSchool على التوزيع التلقائي لمصاريف الدراسة. عند تسجيل دفعة جزئية، يقوم النظام بسداد الأشهر الأقدم أولاً. وفي حال تبقي رصيد غير مدفوع، يظهر باللون البرتقالي في 'جدول الاستخلاص' مع تاريخ الاستحقاق المحدد."
    }
  },
  {
    category: "staff",
    question: {
      fr: "Comment enregistrer une avance (acompte) sur salaire pour un enseignant ?",
      en: "How do I record a salary advance for a teacher and how is it deducted?",
      ar: "كيف أقوم بتسجيل تسبيق (تسبقة) على راتب الأستاذ وكيف يتم خصمها؟"
    },
    answer: {
      fr: "Dans la liste des enseignants ou du personnel, ouvrez l'action 'Gérer le Salaire' puis choisissez 'Verser une Avance'. Saisissez le montant en DT et le mode de règlement. L'avance est instantanément consignée dans le journal des dépenses sous la catégorie 'AVANCE' et sera automatiquement déduite du net à payer lors de la clôture mensuelle.",
      en: "From the Teachers or Staff list, click 'Manage Salary' and select 'Give Advance'. Enter the amount in TND and payment method. The advance is immediately logged in expenses under the 'ADVANCE' category and is automatically subtracted when closing the monthly payout.",
      ar: "من قائمة الأساتذة أو الموظفين، انقر على 'إدارة الراتب' ثم اختر 'صرف تسبيق'. أدخل المبلغ بالدينار وطريقة الدفع. يتم تسجيل التسبيق فوراً في جدول المصاريف تحت تصنيف 'AVANCE'، ويتم خصمه تلقائياً من الراتب النهائي عند نهاية الشهر."
    }
  },
  {
    category: "mobile",
    question: {
      fr: "Comment inviter les parents et les aider à utiliser l'application mobile ?",
      en: "How do I invite parents and help them set up the mobile app?",
      ar: "كيف أدعو الأولياء لمساعدتهم على تنصيب تطبيق الهاتف؟"
    },
    answer: {
      fr: "Votre établissement dispose d'un lien d'inscription dédié et d'un Code QR imprimable. Cliquez sur 'Inviter / QR Code' dans le menu ou sur cette page pour imprimer des circulaires distribuables aux réunions de parents, ou partagez directement le lien pré-rédigé sur WhatsApp. Dès qu'un parent crée son compte, sa demande s'affiche dans votre tableau de bord pour validation en un clic.",
      en: "Your institution has a unique registration link and printable QR flyer. Click 'Invite / QR Code' in the menu or on this page to print parent handouts, or forward the pre-formatted link on WhatsApp. As soon as a parent requests access, you can approve them in one click from the dashboard.",
      ar: "تمتلك مدرستكم رابط تسجيل خاصاً ورمز QR قابل للطباعة. انقر على زر 'دعوة / رمز QR' لطباعة مناشير ورقية أو إرسال الرابط مباشرة عبر واتساب. بمجرد قيام الولي بالتسجيل، يظهر طلبه في لوحة التحكم لتأكيده بنقرة واحدة."
    }
  },
  {
    category: "grades",
    question: {
      fr: "Comment imprimer les bulletins scolaires officiels avec les coefficients tunisiens ?",
      en: "How do I generate and print official report cards with coefficients?",
      ar: "كيف أقوم بطباعة بطاقات الأعداد الرسمية بالضوارب التونسية؟"
    },
    answer: {
      fr: "Allez dans 'Grades' (ou 'Résultats'). Choisissez la classe et le trimestre. Une fois les notes de contrôles et de synthèses validées, cliquez sur 'Générer le Bulletin'. Le système calcule la moyenne générale pondérée avec les coefficients officiels et exporte un document PDF A4 prêt pour l'impression, avec le logo de votre école et l'espace signature.",
      en: "Navigate to 'Grades' (or 'Results'). Select the class and term. Once continuous assessments and exam marks are submitted, click 'Generate Bulletin'. The platform computes the weighted GPA based on official coefficients and exports a ready-to-print A4 PDF with your school logo and signature section.",
      ar: "انتقل إلى صفحة 'الأعداد' (أو 'النتائج'). اختر الفصل والثلاثي. بعد رصد أعداد المراقبة والتأليف، انقر على 'استخراج بطاقة الأعداد'. يقوم النظام بحساب المعدل العام وفق الضوارب الرسمية وتصدير ملف PDF A4 جاهز للطباعة بشعار المؤسسة وإمضاء الإدارة."
    }
  },
  {
    category: "timetable",
    question: {
      fr: "Puis-je adapter la durée des séances dans l'emploi du temps (1h, 1h30, 2h) ?",
      en: "Can I customize session durations in the timetable (1h, 1.5h, 2h)?",
      ar: "هل يمكنني تعديل مدة الحصص في جدول الأوقات (ساعة، ساعة ونصف، ساعتان)؟"
    },
    answer: {
      fr: "Oui. Le planificateur d'emploi du temps supporte les durées de cours flexibles. Les disponibilités des professeurs ainsi que l'occupation des salles sont contrôlées en temps réel pour empêcher tout chevauchement. La grille peut être exportée à tout moment en PDF.",
      en: "Yes. The timetable planner accommodates flexible slot durations. Teacher availability and room occupancy are checked in real-time to avoid any scheduling collisions. The full grid can be exported to PDF at any time.",
      ar: "نعم. يدعم جدول الحصص الفترات الزمنية المرنة. يتم التحقق في الوقت الفعلي من عدم تعارض قاعات التدريس وتفرغ الأساتذة لمنع أي تداخل. كما يمكن استخراج الجدول وطباعته في أي وقت."
    }
  },
  {
    category: "admin",
    question: {
      fr: "Comment changer le trimestre actif ou modifier l'année scolaire de l'établissement ?",
      en: "How do I switch active terms or update the academic year?",
      ar: "كيف أقوم بتغيير الثلاثي الفعلي أو تحديث السنة الدراسية؟"
    },
    answer: {
      fr: "L'administrateur peut se rendre dans 'Paramètres' pour définir l'année scolaire active (ex. 2024-2025) ainsi que le trimestre en cours (Trimestre 1, 2 ou 3). Cette modification ajuste automatiquement tous les filtres de calculs de notes et de scolarité dans l'application.",
      en: "Administrators can open 'Settings' to update the active academic year (e.g., 2024-2025) and current term (Term 1, 2, or 3). All grade calculations, fee schedules, and filter defaults update immediately across the platform.",
      ar: "يمكن للمدير الدخول إلى 'الإعدادات' لتحديد السنة الدراسية الحالية (مثل 2024-2025) والثلاثي النشط (الثلاثي 1 أو 2 أو 3). ينعكس هذا التغيير فوراً على حسابات الأعداد ومصاريف الدراسة في جميع الواجهات."
    }
  },
  {
    category: "admin",
    question: {
      fr: "Que faire si un enseignant ou un membre du personnel a oublié son mot de passe ?",
      en: "What if a teacher or staff member forgets their password?",
      ar: "ماذا أفعل إذا نسي أحد الأساتذة أو الموظفين كلمة المرور الخاصة به؟"
    },
    answer: {
      fr: "L'utilisateur peut cliquer sur 'Mot de passe oublié' sur la page de connexion pour recevoir un lien par email. L'administrateur de l'école peut également vérifier son adresse email ou déclencher une réinitialisation depuis la fiche du profil.",
      en: "Users can click 'Forgot Password' on the sign-in page to receive an automated reset email. School administrators can also verify their email or trigger a reset directly from their staff profile.",
      ar: "يمكن للمستخدم النقر على 'نسيت كلمة المرور' في صفحة تسجيل الدخول ليتوصل برابط عبر بريده الإلكتروني، أو يمكن للمدير التحقق من حسابه وإعادة تهيئة الرمز من صفحة ملف المستخدم."
    }
  },
  {
    category: "admin",
    question: {
      fr: "Les données de notre école sont-elles sauvegardées et sécurisées ?",
      en: "Is our school data backed up and secure?",
      ar: "هل بيانات مدرستنا محمية ومحفوظة بنسخ احتياطية؟"
    },
    answer: {
      fr: "Absolument. Chaque établissement bénéficie d'une isolation stricte de ses données (architecture multi-tenant sécurisée). Les connexions sont chiffrées via SSL/TLS et des sauvegardes automatiques quotidiennes sont garanties.",
      en: "Absolutely. Each school operates in a strictly isolated multi-tenant environment. All connections are encrypted over SSL/TLS, and automated daily database backups ensure uninterrupted data integrity.",
      ar: "بالتأكيد. تتمتع كل مؤسسة بعزل تام لبياناتها المشفرة بنظام الحماية SSL/TLS، مع إجراء نسخ احتياطية آلية يومية لضمان سلامة جميع البيانات المالية والأكاديمية."
    }
  }
];

const HelpPage = () => {
  const { locale } = useLanguage();
  const lang = (locale === "ar" || locale === "en") ? locale : "fr";
  const isRTL = locale === "ar";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Filtered guides based on search and category
  const filteredGuides = useMemo(() => {
    return GUIDES.filter((guide) => {
      const matchesCategory = selectedCategory === "all" || guide.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const title = guide.title[lang].toLowerCase();
      const desc = guide.description[lang].toLowerCase();
      const badge = guide.badge[lang].toLowerCase();
      const stepsText = guide.steps[lang].join(" ").toLowerCase();

      return title.includes(q) || desc.includes(q) || badge.includes(q) || stepsText.includes(q);
    });
  }, [selectedCategory, searchQuery, lang]);

  // Filtered FAQs based on search and category
  const filteredFaqs = useMemo(() => {
    return FAQS.filter((faq) => {
      const matchesCategory = selectedCategory === "all" || faq.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const question = faq.question[lang].toLowerCase();
      const answer = faq.answer[lang].toLowerCase();

      return question.includes(q) || answer.includes(q);
    });
  }, [selectedCategory, searchQuery, lang]);

  const categories = [
    { id: "all", label: { fr: "Tous les guides", en: "All Guides", ar: "جميع الأدلة" }, icon: BookOpen },
    { id: "finance", label: { fr: "Finances & Scolarité", en: "Finance & Fees", ar: "المالية والمصاريف" }, icon: CreditCard },
    { id: "timetable", label: { fr: "Emploi du Temps", en: "Timetable", ar: "جدول الأوقات" }, icon: Calendar },
    { id: "grades", label: { fr: "Notes & Bulletins", en: "Grades & Bulletins", ar: "الأعداد والنتائج" }, icon: GraduationCap },
    { id: "mobile", label: { fr: "Application Mobile", en: "Mobile App", ar: "تطبيق الجوال" }, icon: QrCode },
    { id: "staff", label: { fr: "Personnel & Salaires", en: "Staff & Salaries", ar: "الأساتذة والرواتب" }, icon: Users },
    { id: "admin", label: { fr: "Présence & Administration", en: "Admin & Attendance", ar: "الحضور والإدارة" }, icon: Layers },
  ];

  const quickSearchTags = [
    { label: "Paiements Partiels", query: "paiement" },
    { label: "Avance Salaire", query: "avance" },
    { label: "Emploi du Temps PDF", query: "temps" },
    { label: "Code QR Parents", query: "qr" },
    { label: "Bulletins Trimestriels", query: "bulletin" },
    { label: "Absences & Présence", query: "présence" },
  ];

  return (
    <div className={`w-full max-w-7xl mx-auto flex flex-col gap-6 py-2 pb-24 ${isRTL ? "rtl text-right" : "ltr text-left"}`}>
      
      {/* 1. TOP HERO BANNER (Matches SnapSchool Command Center design) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-xs relative overflow-hidden">
        {/* Subtle decorative top border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold mb-3">
              <BookOpen size={13} className="shrink-0" />
              <span>
                {lang === "ar"
                  ? "مركز المساعدة والتوثيق • SnapSchool v2.0"
                  : lang === "en"
                  ? "Help Center & Documentation • SnapSchool v2.0"
                  : "Centre d'Aide & Documentation • SnapSchool v2.0"}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {lang === "ar"
                ? "كيف يمكننا مساعدتك اليوم؟"
                : lang === "en"
                ? "How can we help you today?"
                : "Comment pouvons-nous vous aider ?"}
            </h1>

            <p className="text-sm sm:text-base text-slate-500 mt-1.5 leading-relaxed">
              {lang === "ar"
                ? "أدلة توضيحية خطوة بخطوة، إجراءات التصرف المالي والمدرسي، ومساعدة تقنية مباشرة لمؤسستكم."
                : lang === "en"
                ? "Step-by-step guides, school operational procedures, and direct technical support for your institution."
                : "Guides opératoires pour les directeurs et secrétaires, gestion des frais de scolarité, emplois du temps et support direct."}
            </p>
          </div>

          {/* Quick status pill */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs shrink-0 self-stretch sm:self-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold text-slate-700">
                {lang === "ar" ? "الدعم الفني متاح الآن" : lang === "en" ? "Live Support Online" : "Support technique en ligne"}
              </span>
            </div>
            <span className="text-slate-400 font-medium">| Tunis (GMT+1)</span>
          </div>
        </div>

        {/* Live Search Bar */}
        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col gap-3">
          <div className="relative w-full">
            <Search className={`absolute ${isRTL ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 text-slate-400`} size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === "ar"
                  ? "ابحث عن وظيفة، دليل، أو استفسار (مثال: الاستخلاص، جدول الأوقات، بطاقات الأعداد، واتساب، التسبيقات)..."
                  : lang === "en"
                  ? "Search a guide or question (e.g. partial payments, timetable, QR code, salary advance, bulletins)..."
                  : "Rechercher un guide ou une question (ex: reliquat, emploi du temps, code QR, avance enseignant, bulletins)..."
              }
              className={`w-full ${isRTL ? "pr-11 pl-10" : "pl-11 pr-10"} py-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-3 focus:ring-blue-500/15 transition-all shadow-2xs`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className={`absolute ${isRTL ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors`}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Search quick tag chips */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500 pt-1">
            <span className="font-semibold text-slate-400">
              {lang === "ar" ? "مقترحات سريعة :" : lang === "en" ? "Suggestions:" : "Recherches fréquentes :"}
            </span>
            {quickSearchTags.map((tag, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSearchQuery(tag.query)}
                className="px-2.5 py-1 rounded-lg bg-slate-100/80 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200/60 text-slate-600 transition-all cursor-pointer font-medium"
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. CATEGORY TABS / FILTER CHIPS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                isActive
                  ? "bg-blue-600 text-white shadow-xs shadow-blue-500/20"
                  : "bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200"
              }`}
            >
              <Icon size={16} className={isActive ? "text-white" : "text-slate-500"} />
              <span>{cat.label[lang]}</span>
            </button>
          );
        })}
      </div>

      {/* 3. MAIN CONTENT GRID: GUIDES & FAQ (LEFT) + SUPPORT & TOOLS (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: GUIDES & FAQS */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          
          {/* SECTION A: ACTIONABLE GUIDES */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span className="w-1.5 h-5 bg-blue-600 rounded-full inline-block"></span>
                <span>
                  {lang === "ar"
                    ? "أدلة وإجراءات التصرف المدرسي"
                    : lang === "en"
                    ? "Management Guides & Procedures"
                    : "Guides & Procédures de Gestion"}
                </span>
              </h2>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                {filteredGuides.length} {lang === "ar" ? "دليل" : lang === "en" ? "guides" : "guides"}
              </span>
            </div>

            {filteredGuides.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
                <p className="font-semibold text-slate-700">
                  {lang === "ar" ? "لا توجد نتائج مطابقة لبحثك" : lang === "en" ? "No guides match your search" : "Aucun guide ne correspond à votre recherche"}
                </p>
                <button
                  type="button"
                  onClick={() => { setSearchQuery(""); setSelectedCategory("all"); }}
                  className="mt-3 text-xs font-semibold text-blue-600 hover:underline"
                >
                  {lang === "ar" ? "إعادة ضبط البحث" : lang === "en" ? "Reset filters" : "Réinitialiser la recherche"}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredGuides.map((guide) => (
                  <div
                    key={guide.id}
                    className="bg-white border border-slate-200/90 rounded-2xl p-5 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between group relative"
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${guide.badgeColor}`}>
                          {guide.badge[lang]}
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                          {guide.icon}
                        </div>
                      </div>

                      <h3 className="text-[15px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                        {guide.title[lang]}
                      </h3>

                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                        {guide.description[lang]}
                      </p>

                      {/* 3 Step preview */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
                        {guide.steps[lang].map((step, sIdx) => (
                          <div key={sIdx} className="flex items-start gap-2 text-[12px] text-slate-600">
                            <span className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0 mt-0.5">
                              {sIdx + 1}
                            </span>
                            <span className="leading-tight flex-1">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-5 pt-3 border-t border-slate-100">
                      {guide.isModalTrigger ? (
                        <button
                          type="button"
                          onClick={() => setIsShareModalOpen(true)}
                          className="w-full py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100/80 text-blue-700 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border border-blue-200/70"
                        >
                          <span>{guide.actionText?.[lang]}</span>
                          <ArrowRight size={14} className={isRTL ? "rotate-180" : ""} />
                        </button>
                      ) : (
                        <Link
                          href={guide.href || "#"}
                          className="w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold text-xs transition-all flex items-center justify-center gap-2 border border-slate-200 hover:border-blue-200"
                        >
                          <span>{guide.actionText?.[lang]}</span>
                          <ArrowRight size={14} className={isRTL ? "rotate-180" : ""} />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION B: MEANINGFUL FAQS */}
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span className="w-1.5 h-5 bg-emerald-500 rounded-full inline-block"></span>
                <span>
                  {lang === "ar"
                    ? "الأسئلة الشائعة والأجوبة التفصيلية"
                    : lang === "en"
                    ? "Frequently Asked Questions (FAQ)"
                    : "Questions Fréquemment Posées (FAQ)"}
                </span>
              </h2>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                {filteredFaqs.length} {lang === "ar" ? "سؤال" : lang === "en" ? "questions" : "questions"}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {filteredFaqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className={`bg-white border transition-all rounded-2xl overflow-hidden ${
                      isOpen
                        ? "border-blue-400/80 shadow-sm ring-2 ring-blue-500/10"
                        : "border-slate-200/90 hover:border-slate-300"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between p-4 sm:p-5 text-start focus:outline-none cursor-pointer select-none"
                    >
                      <span className={`text-[14px] font-bold transition-colors pr-2 ${isOpen ? "text-blue-600" : "text-slate-800"}`}>
                        {faq.question[lang]}
                      </span>
                      <ChevronDown
                        size={18}
                        className={`text-slate-400 transition-transform duration-200 shrink-0 ${
                          isOpen ? "rotate-180 text-blue-600" : ""
                        }`}
                      />
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 sm:px-5 pb-5 pt-1 text-[13.5px] text-slate-600 leading-relaxed border-t border-slate-100 mx-1 mt-1">
                            {faq.answer[lang]}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: APP-MATCHING WHITE SUPPORT CARD & QUICK ACTIONS */}
        <div className="lg:col-span-4 flex flex-col gap-5 sticky top-20">
          
          {/* 1. SUPPORT CARD (Replaces the pitch-black card with light theme matching SnapSchool) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs relative overflow-hidden">
            {/* Top accent gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-blue-600" />

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Headphones size={20} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] font-bold text-slate-900 leading-tight">
                  {lang === "ar" ? "فريق الدعم المباشر" : lang === "en" ? "SnapSchool Support" : "Support SnapSchool"}
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {lang === "ar" ? "متصل الآن للمساعدة" : lang === "en" ? "Online to assist you" : "En ligne pour vous aider"}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-5">
              {lang === "ar"
                ? "هل تواجه استفساراً في الحسابات أو رصد الأعداد أو جدول الأوقات؟ فريقنا الفني في تونس متواجد للرد عليكم في دقائق."
                : lang === "en"
                ? "Have a question about tuition tracking, schedules, or grading? Our technical team is available to help in minutes."
                : "Une question sur vos encaissements, l'emploi du temps ou les bulletins ? Notre équipe d'assistance vous répond directement."}
            </p>

            {/* Direct Contact Buttons */}
            <div className="flex flex-col gap-2.5">
              {/* WhatsApp Direct */}
              <a
                href="https://wa.me/21623889444?text=Bonjour%20SnapSchool%20Support,%20j%27ai%20besoin%20d%27assistance%20sur%20mon%20espace%20%C3%A9tablissement"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-900 transition-all font-semibold text-xs group"
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare size={16} className="text-emerald-600 shrink-0" />
                  <span>{lang === "ar" ? "محادثة عبر واتساب" : lang === "en" ? "Chat on WhatsApp" : "Discuter sur WhatsApp"}</span>
                </div>
                <span className="text-[11px] bg-white text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200 font-bold tracking-tight">
                  +216 23 889 444
                </span>
              </a>

              {/* Direct Call */}
              <a
                href="tel:+21623889444"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 transition-all font-semibold text-xs group"
              >
                <div className="flex items-center gap-2.5">
                  <Phone size={16} className="text-blue-600 shrink-0" />
                  <span>{lang === "ar" ? "اتصال هاتفي مباشر" : lang === "en" ? "Direct Phone Call" : "Appel Téléphonique"}</span>
                </div>
                <span className="text-[11px] text-slate-600 font-medium">
                  +216 23 889 444
                </span>
              </a>

              {/* Direct Email */}
              <a
                href="mailto:contact@snapschool.tn?subject=Demande%20d%27assistance%20SnapSchool"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 transition-all font-semibold text-xs group"
              >
                <div className="flex items-center gap-2.5">
                  <Mail size={16} className="text-slate-500 shrink-0" />
                  <span>{lang === "ar" ? "البريد الإلكتروني" : lang === "en" ? "Email Support" : "Support par E-mail"}</span>
                </div>
                <span className="text-[11px] text-slate-600 font-medium">
                  contact@snapschool.tn
                </span>
              </a>
            </div>

            {/* Operating Hours Note */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-1.5 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                <Clock size={13} className="text-slate-400 shrink-0" />
                <span>
                  {lang === "ar"
                    ? "أوقات العمل : من الاثنين إلى السبت، 08:00 - 19:00"
                    : lang === "en"
                    ? "Hours: Mon – Sat, 08:00 AM – 07:00 PM"
                    : "Horaires : Lun – Sam, 08h00 – 19h00 (Heure de Tunis)"}
                </span>
              </div>
              <span className="text-[10.5px] text-slate-400">
                {lang === "ar"
                  ? "متوسط وقت الرد : أقل من 15 دقيقة"
                  : lang === "en"
                  ? "Average response time: < 15 minutes"
                  : "Délai de réponse moyen : < 15 minutes"}
              </span>
            </div>
          </div>

          {/* 2. PARENT FLYER & MOBILE ACCESS CARD */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/90 p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100/70 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                <QrCode size={16} />
              </div>
              <div>
                <h4 className="text-[13px] font-bold text-slate-800 leading-tight">
                  {lang === "ar" ? "تطبيق الأولياء والهاتف" : lang === "en" ? "Parent Mobile App" : "Application Parents & Profs"}
                </h4>
                <p className="text-[11px] text-slate-500">
                  {lang === "ar" ? "منشور QR ورابط التسجيل" : lang === "en" ? "Flyer QR Code & Link" : "Flyer officiel & QR Code"}
                </p>
              </div>
            </div>

            <p className="text-[11.5px] text-slate-600 leading-relaxed">
              {lang === "ar"
                ? "اطبع بطاقات الدعوة التي تتضمن رمز QR لتوزيعها على الأولياء أو شارك الرابط في مجموعات واتساب."
                : lang === "en"
                ? "Generate official printable flyers with QR code for parent meetings or share on WhatsApp."
                : "Générez la circulaire officielle avec code QR pour inviter les parents d'élèves en réunion ou par WhatsApp."}
            </p>

            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="mt-1 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold text-xs transition-all shadow-2xs cursor-pointer"
            >
              <QrCode size={14} className="text-blue-600" />
              <span>
                {lang === "ar" ? "فتح أداة الدعوة والرمز" : lang === "en" ? "Open Invitation Tool" : "Ouvrir l'outil d'invitation"}
              </span>
            </button>
          </div>

          {/* 3. PLATFORM SECURITY BADGE */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
              <span className="font-medium">
                {lang === "ar" ? "بيانات مشفرة وآمنة 100%" : lang === "en" ? "100% Encrypted & Secure" : "Données chiffrées & isolées"}
              </span>
            </div>
            <span className="text-[10.5px] text-slate-400 font-semibold uppercase tracking-wider">
              Tunis DC
            </span>
          </div>

        </div>
      </div>

      {/* Share Parent Link Modal (accessible from any guide or button on this page) */}
      <ShareParentLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

    </div>
  );
};

export default HelpPage;
