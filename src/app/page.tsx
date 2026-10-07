"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  GraduationCap,
  Menu,
  Maximize2,
  Smartphone,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import styles from "./landing.module.css";

const previews = [
  {
    label: "Vue d’ensemble",
    src: "/landing/dashboard-command-center.png",
    alt: "Tableau de bord SnapSchool : effectifs, recettes et dépenses",
    eyebrow: "Pilotage quotidien",
    caption: "Les chiffres essentiels de votre école, au même endroit.",
    details: ["Recettes, dépenses et marge", "Élèves, enseignants et classes", "Décisions rapides, sans Excel"],
  },
  {
    label: "Finances",
    src: "/landing/finance-recovery.png",
    alt: "Suivi des paiements scolaires et des salaires dans SnapSchool",
    eyebrow: "Suivi financier",
    caption: "Suivez les paiements, les impayés et les salaires en dinars.",
    details: ["Échéances et impayés à relancer", "Paiements partiels et reçus", "Vue claire de la trésorerie"],
  },
  {
    label: "Emploi du temps",
    src: "/landing/timetable-grid.png",
    alt: "Emploi du temps bilingue par classe dans SnapSchool",
    eyebrow: "Organisation scolaire",
    caption: "Organisez les cours, les enseignants et les salles.",
    details: ["Une vue par classe", "Cours, enseignants et salles", "Conflits visibles avant publication"],
  },
];
const plans = [
  {
    name: "Essentiel",
    price: "120",
    description: "Pour les petites structures.",
    features: [
      "Jusqu’à 150 élèves",
      "3 comptes administrateur",
      "Notes et examens",
      "Application parents",
      "Support WhatsApp",
    ],
  },
  {
    name: "Pro Académie",
    price: "290",
    description: "Pour une école qui grandit.",
    features: [
      "Jusqu’à 600 élèves",
      "Enseignants illimités",
      "Assistant Hnia IA",
      "Emplois du temps et finances",
      "Import Excel et support prioritaire",
    ],
  },
  {
    name: "Sur mesure",
    price: null,
    description: "Pour les groupes et réseaux scolaires.",
    features: [
      "Plusieurs établissements",
      "Capacité adaptée à vos besoins",
      "Intégrations sur mesure",
      "Formation sur place",
      "Interlocuteur dédié",
    ],
  },
];
const faqs = [
  {
    question: "SnapSchool est-il adapté à mon établissement ?",
    answer:
      "SnapSchool est conçu pour les écoles privées en Tunisie : primaire, collège et lycée. Il réunit les dossiers élèves, les notes, les emplois du temps et les finances en dinars.",
  },
  {
    question: "Puis-je reprendre mes données existantes ?",
    answer:
      "Oui. Notre équipe vous accompagne pour importer vos fichiers Excel et configurer les élèves, les enseignants et les classes de votre établissement.",
  },
  {
    question: "Que peuvent consulter les parents ?",
    answer:
      "Depuis l’application mobile, les parents retrouvent les emplois du temps, les absences, les résultats, les annonces et les paiements de leurs enfants.",
  },
  {
    question: "Comment découvrir la plateforme ?",
    answer:
      "Créez un compte pour demander votre accès, ou contactez-nous sur WhatsApp pour une démonstration guidée et choisir la formule adaptée à votre école.",
  },
];
const whatsapp = "https://wa.me/21623889444";
const navigation = [
  { href: "#apercu", label: "La plateforme" },
  { href: "#hnia-ia", label: "Hnia IA" },
  { href: "#tarifs", label: "Tarifs" },
];

export default function Homepage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePreview, setActivePreview] = useState(0);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const preview = previews[activePreview];

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      const role = data.session?.user.user_metadata?.role;
      const routes: Record<string, string> = {
        admin: "/admin",
        superadmin: "/superadmin",
        teacher: "/teacher",
        student: "/student",
        parent: "/parent",
      };
      if (mounted && typeof role === "string" && routes[role])
        router.replace(routes[role]);
    });
    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <div className={styles.page} lang="fr">
      <a className={styles.skipLink} href="#contenu">
        Aller au contenu
      </a>
      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <Link
            href="/"
            className={styles.logo}
            aria-label="SnapSchool, accueil"
          >
            <span className={styles.logoMark}>
              S<span />
            </span>
            SnapSchool<span className={styles.logoDot}>.</span>
          </Link>
          <nav className={styles.desktopNav} aria-label="Navigation principale">
            {navigation.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
          <div className={styles.headerActions}>
            <Link className={styles.login} href="/sign-in">
              Connexion
            </Link>
            <Link className={styles.buttonSmall} href="/sign-up">
              Commencer <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <button
            className={styles.menuButton}
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <nav
            id="mobile-navigation"
            className={styles.mobileNav}
            aria-label="Navigation mobile"
          >
            {navigation.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Link href="/sign-in">Connexion</Link>
            <Link href="/sign-up" className={styles.button}>
              Commencer <ArrowRight size={16} />
            </Link>
          </nav>
        )}
      </header>
      <main id="contenu">
        <section className={styles.hero}>
          <div className={styles.container}>
            <div className={styles.eyebrow}>
              <span /> Pensé pour les écoles privées en Tunisie
            </div>
            <h1>
              Votre école.
              <br />
              <span>L’esprit tranquille.</span>
            </h1>
            <p className={styles.heroDescription}>
              Élèves, finances, emplois du temps et parents.
              <br className={styles.desktopBreak} /> Tout votre quotidien
              scolaire, dans un seul espace.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.button} href="/sign-up">
                Commencer gratuitement{" "}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a
                className={styles.secondaryButton}
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                Voir une démo <ArrowRight size={17} aria-hidden="true" />
              </a>
            </div>
            <p className={styles.heroNote}>
              Primaire, collège et lycée · Web & mobile
            </p>
            <div id="apercu" className={styles.showcase}>
              <div
                className={styles.previewTabs}
                role="tablist"
                aria-label="Aperçu de la plateforme"
              >
                {previews.map((item, index) => (
                  <button
                    key={item.label}
                    id={`preview-tab-${index}`}
                    role="tab"
                    aria-selected={activePreview === index}
                    aria-controls="preview-panel"
                    tabIndex={activePreview === index ? 0 : -1}
                    className={activePreview === index ? styles.activeTab : ""}
                    onClick={() => setActivePreview(index)}
                    onKeyDown={(event) => {
                      let next = index;
                      if (event.key === "ArrowRight")
                        next = (index + 1) % previews.length;
                      else if (event.key === "ArrowLeft")
                        next = (index + previews.length - 1) % previews.length;
                      else if (event.key === "Home") next = 0;
                      else if (event.key === "End") next = previews.length - 1;
                      else return;
                      event.preventDefault();
                      setActivePreview(next);
                      document.getElementById(`preview-tab-${next}`)?.focus();
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div
                className={styles.previewFrame}
                id="preview-panel"
                role="tabpanel"
                aria-labelledby={`preview-tab-${activePreview}`}
                tabIndex={0}
              >
                <div className={styles.previewBar}>
                  <div className={styles.windowDots}>
                    <span />
                    <span />
                    <span />
                  </div>
                  <span>Votre espace SnapSchool</span>
                  <button
                    className={styles.previewExpand}
                    type="button"
                    onClick={() => setPreviewExpanded(true)}
                    aria-label={`Agrandir l’aperçu ${preview.label}`}
                  >
                    Agrandir <Maximize2 size={12} aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  className={styles.previewImage}
                  onClick={() => setPreviewExpanded(true)}
                  aria-label={`Agrandir l’aperçu ${preview.label}`}
                >
                  <Image
                    key={preview.src}
                    src={preview.src}
                    alt={preview.alt}
                    fill
                    priority={activePreview === 0}
                    sizes="(max-width: 1100px) 92vw, 1040px"
                    className={styles.screenshot}
                  />
                </button>
              </div>
              <div className={styles.previewSummary} aria-live="polite">
                <div>
                  <p className={styles.previewEyebrow}>{preview.eyebrow}</p>
                  <p className={styles.previewCaption}>{preview.caption}</p>
                </div>
                <ul>
                  {preview.details.map((detail) => (
                    <li key={detail}>
                      <Check size={13} aria-hidden="true" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section
          className={`${styles.container} ${styles.benefits}`}
          aria-labelledby="benefits-title"
        >
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>MOINS DE DISPERSION, PLUS DE CLARTÉ</p>
            <h2 id="benefits-title">
              L’essentiel pour une école
              <br />
              qui tourne bien.
            </h2>
          </div>
          <div className={styles.benefitGrid}>
            <article>
              <div className={styles.featureIcon}>
                <Wallet size={23} aria-hidden="true" />
              </div>
              <h3>Des finances au clair.</h3>
              <p>
                Paiements partiels, reçus, impayés et salaires. Gardez une vue
                précise sur votre caisse, en dinars.
              </p>
              <span>
                Chaque paiement, bien suivi{" "}
                <ArrowRight size={14} aria-hidden="true" />
              </span>
            </article>
            <article>
              <div className={styles.featureIcon}>
                <CalendarDays size={23} aria-hidden="true" />
              </div>
              <h3>Un quotidien organisé.</h3>
              <p>
                Dossiers élèves, emplois du temps, absences et bulletins. Votre
                équipe travaille dans le même espace.
              </p>
              <span>
                Une école, un seul outil{" "}
                <ArrowRight size={14} aria-hidden="true" />
              </span>
            </article>
            <article>
              <div className={styles.featureIcon}>
                <Smartphone size={23} aria-hidden="true" />
              </div>
              <h3>Des familles informées.</h3>
              <p>
                Notes, annonces, horaires et paiements accessibles sur mobile.
                Les parents suivent chaque enfant simplement.
              </p>
              <span>
                Le lien avec les parents{" "}
                <ArrowRight size={14} aria-hidden="true" />
              </span>
            </article>
          </div>
        </section>

        <section
          id="hnia-ia"
          className={`${styles.container} ${styles.hnia}`}
          aria-labelledby="hnia-title"
        >
          <div className={styles.hniaCopy}>
            <p className={styles.kicker}>
              <Sparkles size={15} aria-hidden="true" /> VOTRE ASSISTANTE, HNIA
            </p>
            <h2 id="hnia-title">
              Demandez simplement.
              <br />
              Hnia vous accompagne.
            </h2>
            <p>
              Consultez votre caisse, retrouvez une information ou préparez une
              dépense. En français ou en tunisien, par texte, voix ou photo.
            </p>
            <div className={styles.hniaNote}>
              <Check size={16} aria-hidden="true" /> Vous confirmez les actions
              sensibles.
            </div>
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.textLink}
            >
              Découvrir Hnia en démo <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
          <div
            className={styles.chatExample}
            aria-label="Exemple de conversation avec Hnia"
          >
            <div className={styles.chatHeader}>
              <Image
                src="/hnia_mascot_icon.png"
                alt=""
                width={40}
                height={40}
              />
              <div>
                <strong>Hnia</strong>
                <span>Votre assistante SnapSchool</span>
              </div>
              <span className={styles.exampleLabel}>Exemple</span>
            </div>
            <div className={styles.chatBody}>
              <div className={styles.userMessage}>
                Enregistre 50 DT pour la réparation de la climatisation.
              </div>
              <div className={styles.assistantMessage}>
                Bien sûr. Voici la dépense à confirmer.
              </div>
              <div className={styles.confirmationCard}>
                <span>DÉPENSE À CONFIRMER</span>
                <div>
                  <strong>Maintenance</strong>
                  <b>50,000 DT</b>
                </div>
                <p>Réparation de la climatisation</p>
                <div className={styles.confirmationFooter}>
                  <span>
                    <Check size={14} aria-hidden="true" /> Confirmer
                  </span>
                  <span>Annuler</span>
                </div>
              </div>
            </div>
            <p className={styles.chatFootnote}>
              Sur Telegram et dans l’application mobile.
            </p>
          </div>
        </section>

        <section
          id="tarifs"
          className={`${styles.container} ${styles.pricing}`}
          aria-labelledby="pricing-title"
        >
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>UN FORMAT POUR CHAQUE ÉCOLE</p>
            <h2 id="pricing-title">Simple, jusque dans les tarifs.</h2>
            <p>Choisissez la formule qui correspond à votre établissement.</p>
          </div>
          <div className={styles.planGrid}>
            {plans.map((plan, index) => (
              <article
                className={`${styles.plan} ${index === 1 ? styles.featuredPlan : ""}`}
                key={plan.name}
              >
                <div className={styles.planTop}>
                  <h3>{plan.name}</h3>
                  {index === 1 && <span>Pour les écoles</span>}
                </div>
                <p className={styles.planDescription}>{plan.description}</p>
                <div className={styles.price}>
                  {plan.price ? (
                    <>
                      <strong>{plan.price}</strong>
                      <span>DT / mois</span>
                    </>
                  ) : (
                    <strong className={styles.quotePrice}>Sur devis</strong>
                  )}
                </div>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={16} aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.price ? (
                  <Link
                    href="/sign-up"
                    className={
                      index === 1 ? styles.button : styles.outlineButton
                    }
                  >
                    Commencer <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                ) : (
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.outlineButton}
                  >
                    Parlons de votre école{" "}
                    <ArrowRight size={16} aria-hidden="true" />
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>

        <section
          id="faq"
          className={`${styles.container} ${styles.faq}`}
          aria-labelledby="faq-title"
        >
          <div>
            <p className={styles.kicker}>EN TOUTE SIMPLICITÉ</p>
            <h2 id="faq-title">
              Quelques réponses
              <br />
              avant de commencer.
            </h2>
            <a
              className={styles.textLink}
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
            >
              Une autre question ? Écrivez-nous{" "}
              <ArrowRight size={15} aria-hidden="true" />
            </a>
          </div>
          <div className={styles.faqList}>
            {faqs.map((faq) => (
              <details key={faq.question}>
                <summary>
                  {faq.question}
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className={`${styles.container} ${styles.finalCta}`}>
          <GraduationCap size={30} strokeWidth={1.5} aria-hidden="true" />
          <h2>
            Une école bien gérée.
            <br />
            Du temps pour l’éducation.
          </h2>
          <Link href="/sign-up" className={styles.button}>
            Commencer gratuitement <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      </main>
      {previewExpanded && (
        <div
          className={styles.previewDialogBackdrop}
          role="presentation"
          onMouseDown={() => setPreviewExpanded(false)}
        >
          <section
            className={styles.previewDialog}
            role="dialog"
            aria-modal="true"
            aria-label={`Aperçu agrandi : ${preview.label}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.previewDialogHeader}>
              <div>
                <p>{preview.eyebrow}</p>
                <strong>{preview.label}</strong>
              </div>
              <button
                type="button"
                onClick={() => setPreviewExpanded(false)}
                aria-label="Fermer l’aperçu"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <Image src={preview.src} alt={preview.alt} width={1024} height={540} priority />
          </section>
        </div>
      )}
      <footer className={`${styles.container} ${styles.footer}`}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoMark}>
            S<span />
          </span>
          SnapSchool<span className={styles.logoDot}>.</span>
        </Link>
        <p>Conçu pour les écoles privées en Tunisie.</p>
        <div>
          <Link href="/privacy">Confidentialité</Link>
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            Contact
          </a>
          <span>© {new Date().getFullYear()} SnapSchool</span>
        </div>
      </footer>
    </div>
  );
}
