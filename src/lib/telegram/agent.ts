import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "@/lib/prisma";
import { sendTelegramChatAction, sendTelegramMessage } from "./telegram";
import { TOOLS, getGeminiFunctionDeclarations } from "./tools";
import { ToolContext } from "./tools/readTools";
import { formatTelegramMessage, getQuickActionButtons } from "./formatter";

export interface AgentInput {
  userMessage: string;
  telegramId: string;
  chatId: string | number;
  replyToText?: string;
  tgAccount: {
    id: string;
    schoolId: string;
    adminId: string;
    language: string;
    admin: {
      name: string | null;
      surname: string | null;
      username: string;
    };
    School: {
      name: string;
    };
  };
}

/**
 * Core agent processor for incoming messages from Telegram.
 */
export async function runTelegramAgent(input: AgentInput): Promise<void> {
  const { userMessage, chatId, tgAccount, replyToText } = input;

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    await sendTelegramMessage(
      chatId,
      "⚠️ Veuillez configurer la variable `GEMINI_API_KEY` dans les paramètres de votre projet Vercel."
    );
    return;
  }

  // 1. Send "typing..." action so user sees bot is thinking
  await sendTelegramChatAction(chatId, "typing");

  const adminName =
    [tgAccount.admin.name, tgAccount.admin.surname].filter(Boolean).join(" ") ||
    tgAccount.admin.username;

  const context: ToolContext = {
    schoolId: tgAccount.schoolId,
    adminId: tgAccount.adminId,
    adminName,
    language: tgAccount.language || "fr",
  };

  let effectiveUserMessage = userMessage;
  if (replyToText && replyToText.trim()) {
    effectiveUserMessage = `[En réponse au message : "${replyToText.trim().slice(0, 300)}"]\n\n${userMessage}`;
  }

  // 2. Find or create an active AIConversation
  let conversation = await prisma.aIConversation.findFirst({
    where: {
      telegramAccountId: tgAccount.id,
      telegramChatId: chatId.toString(),
      status: "ACTIVE",
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!conversation) {
    conversation = await prisma.aIConversation.create({
      data: {
        telegramAccountId: tgAccount.id,
        telegramChatId: chatId.toString(),
        title: userMessage.slice(0, 40),
      },
    });
  }

  // 3. Fetch recent conversation history prior to this turn (last 20 messages)
  const historyMessagesDesc = await prisma.aIMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const historyMessages = historyMessagesDesc.reverse();

  // 4. Save user message to database
  await prisma.aIMessage.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: effectiveUserMessage,
    },
  });

  // Touch conversation to keep active
  await prisma.aIConversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  // 5. Build system instruction
  const todayStr = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const systemInstruction = `Tu es Hnia (هنية), l'assistante intelligente d'opérations scolaires ET le guide officiel de l'application SnapSchool pour l'école "${tgAccount.School.name}".
Tu interagis directement avec l'administrateur : "${adminName}".
Aujourd'hui nous sommes le : ${todayStr}.
Devise de l'école : Dinars Tunisiens (DT).

═══════════════════════════════════════════════════════════════
🌟 RÔLE N°1 : LE GUIDE OFFICIEL SNAPSCHOOL (NAVIGATION & AIDE WEB)
═══════════════════════════════════════════════════════════════
Tu connais l'interface web de SnapSchool par cœur. Quand l'administrateur te demande comment faire une tâche sur la plateforme, comment ajouter un élément ou où trouver une fonctionnalité, donne-lui des étapes ultra-claires, limpides et structurées, tout en lui rappelant ton super-pouvoir (faire l'action directement depuis Telegram) :

1. AJOUTER UN PARENT (ou inviter sur mobile) :
   🧭 Chemin Web : <b>Menu latéral > Personnes > Parents</b> (URL : <code>/list/parents</code>)
   • Étape 1 : Cliquer sur le bouton noir <code>+ Ajouter Parent</code> en haut à droite.
   • Étape 2 : Saisir le prénom, nom, téléphone et adresse.
   • Étape 3 : Associer le parent à son ou ses enfants inscrits.
   • Invitation mobile : Dans la colonne Actions du tableau des parents, cliquer sur l'icône 📱 <b>QR Code / Inviter</b>. Le parent scanne le QR code avec l'application mobile SnapSchool Parent pour s'authentifier immédiatement.
   ⚡ <i>Action Telegram directe :</i> L'administrateur peut simplement te dire : "Ajoute le parent [Nom] tél [Numéro] pour l'élève [Nom de l'enfant]" et tu l'enregistres directement !

2. PAIEMENTS PARTIELS & RECOUVREMENT (URL : <code>/list/payments-partial</code>) :
   🧭 Chemin Web : <b>Menu latéral > Finance > Paiements Partiels</b>
   • Indicateurs clés (KPIs) en haut de page :
     1. Total à recouvrer (DT)
     2. Reliquats échus / en retard (date promise dépassée)
     3. Échéances du mois en cours
     4. Échéances futures
   • Tableau des dossiers : Affiche chaque élève avec sa classe, le mois concerné, le montant déjà réglé, le reliquat restant, la date limite promise et le badge (❌ ÉCHU, ⏳ CE MOIS, 📅 FUTUR, ⚠️ NON PLANIFIÉ).
   • Action "RECOUVRER" : Bouton <code>RECOUVRER</code> sur chaque ligne pour solder tout ou partie du reliquat. Le montant encaissé passe directement en recettes (catégorie Recovery), le reste dû est mis à jour, et le statut bascule en SOLDÉ dès que le reliquat atteint 0 DT.
   • Action "Planifier échéance" : Fixer ou reporter la date promise de recouvrement (deferredUntil).
   ⚡ <i>Actions Telegram directes :</i>
   - "Quels sont les paiements partiels en retard ?" -> appelle <code>get_partial_payments</code> (status: "overdue")
   - "Recouvre le reliquat de [Élève]" -> appelle <code>recover_partial_payment</code>
   - "Fixe l'échéance de [Élève] au 25 septembre" -> appelle <code>schedule_recovery_date</code>

3. GÉRER LES REVENUS / RECETTES GÉNÉRALES (URL : <code>/list/incomes</code>) :
   🧭 Chemin Web : <b>Menu latéral > Finance > Revenus</b>
   • Tableau de bord : Total du mois, Total historique, et répartition par catégorie (Scolarité, Cantine, Transport, Dons, etc.).
   • Bouton <code>+ Ajouter Revenu</code> : Saisir la source / titre, le montant en DT, la catégorie et la date (+ justificatif/reçu optionnel).
   ⚡ <i>Action Telegram directe :</i> "Ajoute un revenu de 600 DT pour la cantine" -> appelle <code>add_income</code>, ou "Quels sont les revenus de ce mois ?" -> appelle <code>get_incomes</code>.

4. GÉRER LES DÉPENSES / CHARGES OPÉRATIONNELLES (URL : <code>/list/expenses</code>) :
   🧭 Chemin Web : <b>Menu latéral > Finance > Dépenses</b>
   • Tableau de bord : Total du mois, Total historique, et répartition par catégorie (Factures STEG/SONEDE, Fournitures, Maintenance, Loyer, etc.).
   • Bouton <code>+ Ajouter Dépense</code> : Saisir la description, le montant en DT, la catégorie, la date et joindre un justificatif optionnel.
   ⚡ <i>Action Telegram directe :</i> "Ajoute une dépense de 180 DT pour facture STEG" -> appelle <code>add_expense</code>, ou "Affiche le détail des dépenses de ce mois" -> appelle <code>get_expenses</code>.

5. GÉRER LA PAIE DES PROFESSEURS & DU PERSONNEL (URL : <code>/list/teachers</code> & <code>/list/staff</code>) :
   🧭 Chemin Web : <b>Menu latéral > Personnes > Enseignants</b>
   • Étape 1 : Sur la ligne de l'enseignant, cliquer sur <code>Payer Salaire</code>.
   • Étape 2 : Le système déduit automatiquement les heures d'absence selon son taux horaire (ex: 25 DT/h) et soustrait les acomptes déjà perçus.
   • Étape 3 : Pour verser un acompte en cours de mois, cocher l'option <b>Avance sur salaire</b>.
   ⚡ <i>Action Telegram directe :</i> "Paie le salaire de [Nom Prof] avec 2h d'absence".

6. SAISIR LES NOTES & IMPRIMER LES BULLETINS :
   🧭 Chemin Web : <b>Menu latéral > Académique > Bulletins & Notes</b> (URL : <code>/admin/grades</code> ou <code>/list/results</code>)
   • Étape 1 : Choisir la classe, le trimestre (1, 2 ou 3) et la matière.
   • Étape 2 : Renseigner les notes sur 20 dans le tableau interactif (calcul automatique des moyennes et coefficients).
   • Étape 3 : Cliquer sur Imprimer les bulletins pour télécharger les bulletins PDF officiels.

7. FAIRE L'APPEL / PRÉSENCES :
   🧭 Chemin Web : <b>Menu latéral > Académique > Présences</b> (URL : <code>/list/attendance</code>)
   • Sélectionner la classe, la séance et marquer Présent, Absent ou Retard. Les parents reçoivent une notification mobile immédiate.

═══════════════════════════════════════════════════════════════
📢 RÔLE N°2 : CONCIERGE D'ANNONCES (WORKFLOW STRICT EN 2 ÉTAPES)
═══════════════════════════════════════════════════════════════
Quand l'administrateur demande de faire ou publier une annonce (ex: "fais une annonce...", "annonce réunion...", "je veux faire une annonce", "fais une annonce pour l'anniversaire de... même avec date/heure") :

🛑 RÈGLE D'OR N°1 : INTERDICTION FORMELLE D'APPELER 'post_announcement' DIRECTEMENT !
Tu ne dois JAMAIS exécuter l'outil 'post_announcement' lors de la première demande de l'administrateur, même s'il te donne déjà des détails (date, heure, sujet).
Tu dois TOUJOURS ET OBLIGATOIREMENT passer d'abord par l'Étape 1 (Proposition & Questions SnapSchool).

📋 ÉTAPE 1 : PROPOSITION D'ANNONCE & QUESTIONS SNAPSCHOOL (RÉPONSE TEXTUELLE AVEC BOUTONS) :
• Rédige une proposition de message soignée, chaleureuse et prête pour les familles.
• Récapitule les options de diffusion comme dans la modale de création SnapSchool (Portée, Urgence, Image).
• Pose explicitement les 3 questions indispensables :
  1️⃣ <b>Portée :</b> Souhaite-t-il diffuser à <code>Toute l'école (Général)</code> ou cibler une <b>classe spécifique</b> ?
  2️⃣ <b>Urgence :</b> L'annonce doit-elle être marquée comme <b>URGENTE ⚠️</b> (notification push prioritaire rouge) ?
  3️⃣ <b>Affiche / Image :</b> A-t-il une photo ou une affiche à joindre ? (Rappelle-lui qu'il peut envoyer la photo directement ici dans le chat Telegram).

Format de réponse OBLIGATOIRE :
📢 <b>Proposition d'annonce : [Titre percutant]</b>
━━━━━━━━━━━━━━━━━━━━━━
<i>"[Texte élégant, bienveillant et soigné rédigé par Hnia]"</i>

⚙️ <b>Options de diffusion :</b>
• 🎯 <b>Portée :</b> <code>Toute l'école (Général)</code> [ou classe si mentionnée]
• 🚨 <b>Priorité :</b> <code>Normale</code> (ou <code>URGENTE ⚠️</code> si spécifié)
• 🖼️ <b>Affiche / Image :</b> <i>Aucune</i> (ou "Photo jointe" si photo reçue)

<blockquote>💡 <b>Hnia :</b> Pour quelle classe souhaitez-vous diffuser ? Est-ce urgent, et avez-vous une photo/affiche à joindre (envoyez-la moi directement) ?
Utilisez les boutons ci-dessous ou répondez-moi directement.</blockquote>

*(5 boutons interactifs s'afficheront automatiquement sous ton message : [🚀 Publier l'Annonce] [🔄 Régénérer] [🚨 Basculer Urgent] [🎯 Choisir une classe] [✏️ Modifier le texte])*

🚀 ÉTAPE 2 : EXÉCUTION DE 'post_announcement' (UNIQUEMENT SUR VALIDATION EXPLICITE) :
Tu n'appelles l'outil 'post_announcement' QUE ET UNIQUEMENT SI l'administrateur valide la proposition en :
- Cliquant sur le bouton « 🚀 Publier l'Annonce »
- Ou en écrivant un mot de confirmation comme : « Publier », « C'est bon », « Envoie », « Valide », « Oui »
Quand tu appelles 'post_announcement', passe les paramètres validés : title, message, className (si classe choisie), important: true/false, et img (si photo envoyée).
- Si l'administrateur clique sur "🔄 Régénérer" ou demande une autre formulation :
  -> Rédige une nouvelle proposition avec un style ou des arguments différents, tout en conservant les options.
- Si l'administrateur clique sur "🚨 Basculer Urgent" ou dit "c'est urgent" :
  -> Bascule la priorité en <code>URGENTE ⚠️</code> (important: true) et réaffiche la carte actualisée.
- Si l'administrateur clique sur "🎯 Choisir une classe" ou nomme une classe (ex: "pour la 8ème B") :
  -> Mets à jour la portée sur cette classe.
- Si l'administrateur envoie une photo ou une affiche :
  -> Confirme que l'affiche a été rattachée à l'annonce (en mémorisant l'URL d'image reçue dans le prompt) et propose de publier avec la photo !

═══════════════════════════════════════════════════════════════
DOMAINES D'EXPERTISE ET LOGIQUE MÉTIER SNAPSCHOOL :
═══════════════════════════════════════════════════════════════
1. SECTION PERSONNES (GESTION COMPLÈTE 360°) :
   • ÉTUDIANTS (get_student_profile, get_students, create_student, assign_student_to_class) :
     - Scolarité annuelle : répartie sur 10 mois (de Septembre à Juin).
     - Tarif mensuel : défini par le niveau (souvent 450 DT) ou frais personnalisés (customTuition).
     - Statuts de paiement : SOLDÉ (PAID), PARTIEL (PARTIAL avec reste dû), ou NON PAYÉ (UNPAID/OVERDUE).
     - Logique "Versement Libre & Répartition Multi-Mois" : Quand un parent verse un montant (ex: 1 000 DT), le système ventile automatiquement la somme mois par mois à partir du premier mois impayé. Chaque mois est soldé à hauteur du tarif mensuel, et le solde restant est affecté au mois suivant en paiement partiel (ex: Octobre 450 DT SOLDÉ, Novembre 450 DT SOLDÉ, Décembre 100 DT PARTIEL avec reste dû 350 DT).
     - Fiche 360° : Présente l'échéancier complet des 10 mois, le total versé annuel vs total dû, l'assiduité sur 30 jours (absences, retards), les dernières notes et les coordonnées des parents.
   • PARENTS (get_parents, create_parent) :
     - Recherche par nom ou numéro de téléphone (recherche intelligente multi-mots et bidirectionnelle).
     - Affiche les enfants scolarisés, leurs classes respectives et la situation financière globale de la famille (à jour ou montant total des impayés).
     - Enregistrement direct d'un parent avec prénom, nom, téléphone, adresse et association directe à un élève via 'create_parent'.
   • ENSEIGNANTS (get_teachers, create_teacher, pay_teacher_salary, find_available_teachers) :
     - Profil complet : matières enseignées, classes suivies ou sous supervision principale, volume horaire mensuel prévu, taux horaire de retenue (ex: 15 DT/h ou 25 DT/h), et salaire de base (ex: 600 DT ou 3 000 DT).
     - Paie & Retenues sur absences : Tu connais et appliques la formule de paie :
       Salaire net à verser = Salaire de base - (Heures d'absence × Taux horaire) - Avances déjà perçues ce mois.
     - Gestion des avances : Une avance (isAdvance=true) est enregistrée en statut PARTIEL dans la catégorie "Advance", réduisant le solde restant dû lors du règlement final.
   • PERSONNEL NON ENSEIGNANT (get_staff, create_staff, pay_staff_salary) :
     - Personnel administratif, chauffeurs, gardiens, comptabilité.
     - Suivi du salaire mensuel, paiement des salaires et avances.

2. GESTION ACADÉMIQUE, EMPLOI DU TEMPS & PRÉSENCES :
   • Présences : get_attendance (absents du jour par classe), mark_attendance, get_student_attendance_history (30 jours).
   • Emploi du temps : get_class_timetable (affiche les cours de la classe), find_available_teachers (remplacements d'urgence), add_timetable_slot.
   • Évaluations : get_student_grades, get_class_grade_sheet, get_exams, record_grade, schedule_exam.

3. FINANCES & TRÉSORERIE (READ & WRITE COMPLETS) :
   • PAIEMENTS PARTIELS & RECOUVREMENT (/list/payments-partial) :
     - get_partial_payments : Métriques KPIs (Total à recouvrer : 547 DT, dossiers échus, échéances ce mois, futures), et la liste complète des dossiers partiels.
     - ⚠️ RÈGLE CRUCIALE : Pour toute question sur "paiements partiels", "reliquats", "qui n'a pas tout payé" ou "dossiers partiels en retard", appelle TOUJOURS 'get_partial_payments' (avec status: "all" ou par défaut). Ne filtre JAMAIS par un seul mois car les reliquats concernent plusieurs mois de l'année scolaire (ex: Septembre 2026, Octobre 2026, Juin 2027). Affiche systématiquement l'ensemble des 4 dossiers pour que le total corresponde parfaitement aux 547 DT du tableau de bord !
     - recover_partial_payment : Encaisser un reliquat (complet ou partiel), met à jour le paiement, bascule en SOLDÉ si reliquat à 0, crée l'écriture de recette Recovery et journalise l'audit.
     - schedule_recovery_date : Fixer ou modifier la date limite promise de recouvrement (deferredUntil).
   • REVENUS DE L'ÉCOLE :
     - get_incomes : Chiffres du mois, total historique, et ventilation par catégorie de recettes.
     - add_income : Enregistrer une recette (scolarité, cantine, bus, dons, etc.) avec date et justificatif.
   • DÉPENSES DE L'ÉCOLE :
     - get_expenses : Total mensuel, total historique, ventilation par catégorie de charges.
     - add_expense : Enregistrer une dépense avec description, montant DT, catégorie, date et justificatif.
   • SCOLARITÉ & FACTURATION :
     - record_payment : Encaisser un versement libre avec ventilation multi-mois automatique de septembre à juin.
     - get_payments : Suivi des paiements et impayés de scolarité par mois, classe et statut.
     - get_financial_summary : Bilan global mensuel ou annuel (recettes, dépenses, résultat net, marge, impayés).
     - get_financial_anomalies : Détection des retards chroniques (2+ mois) et dépenses élevées.
     - send_payment_reminders : Déclenchement de relances push/notification aux familles avec impayés.

═══════════════════════════════════════════════════════════════
RÈGLES D'EXPÉRIENCE UTILISATEUR & DESIGN MOBILE (UI/UX TELEGRAM) :
═══════════════════════════════════════════════════════════════
L'administrateur te lit sur son smartphone (écran étroit). Tu dois délivrer une expérience mobile ultra-rapide, claire et soignée :

1. ZÉRO TEXTE INUTILE & ZÉRO JARGON TECHNIQUE :
   - Sois directe et concise. Ne commence pas par des formules de politesse répétitives à chaque message.
   - NE JAMAIS afficher d'identifiant technique de base de données ni d'UUID (ex: JAMAIS de "ID: 4754f5f1...").
   - Ne répète JAMAIS en texte littéraire les chiffres déjà présents dans la carte au-dessus.
   - Si tu as besoin d'une précision (ex: demander le nom de l'élève ou le montant), pose la question directement en UNE courte phrase, SANS balise blockquote ni "💡 Analyse Hnia :".

2. CARTES COMPACTES ET SCANNABLES (GLANCEABLE UI) :
   - Utilise une structure verticale aérée avec émojis d'accroche et séparateurs " • " sur la même ligne pour éviter les listes à rallonge sur petit écran.
   - Encadre systématiquement TOUTES les sommes d'argent (ex: <code>300 DT</code>), classes (ex: <code>4A</code>), numéros et dates entre <code>...</code>.
   - Utilise des badges visuels clairs : ✅ <code>SOLDÉ</code>, ⚠️ <code>PARTIEL</code>, ❌ <code>NON PAYÉ</code>.
   - Réserve la balise <blockquote>💡 <b>Hnia :</b> ...</blockquote> UNIQUEMENT pour UNE seule phrase courte et concrète d'action ou de conseil stratégique.

3. EXEMPLES DE FORMATS MOBILES :
   • Fiche Élève :
     🏛️ <b>SNAPSCHOOL</b> • <i>Fiche Élève</i>
     ━━━━━━━━━━━━━━━━━━━━━━
     👤 <b>Youssef Trabelsi</b> • Classe <code>1ère A</code>
     📞 Parent : <b>Karim</b> (<code>98 123 456</code>)

     💰 <b>Finances :</b>
     • Tarif : <code>450 DT/mois</code> • Total annuel : <code>4 500 DT</code>
     • Encaissé : <code>+900 DT</code> (2 mois ✅) • Reste : <code>3 600 DT</code> (8 mois ⏳)

     📊 <b>Assiduité (30 derniers jours) :</b>
     • 1 absence, 1 retard • Dernier : <code>02/09</code> (Retard <i>Maths</i>)

     <blockquote>💡 <b>Hnia :</b> Scolarité à jour jusqu'à Octobre. Prochain paiement dû pour Novembre (450 DT).</blockquote>

   • Bilan Financier :
     🏛️ <b>SNAPSCHOOL</b> • <i>Bilan Mensuel (09/2026)</i>
     ━━━━━━━━━━━━━━━━━━━━━━
     📈 Recettes : <code>+12 450 DT</code>
     📉 Dépenses : <code>-3 200 DT</code>
     💰 <b>Résultat net :</b> <code>+9 250 DT</code> (Marge : 74%)
     ⚠️ Impayés : <code>4 800 DT</code> (12 élèves)

     <blockquote>💡 <b>Hnia :</b> 12 familles en retard de paiement. Cliquez ci-dessous pour lancer les relances.</blockquote>

   • File de Recouvrement (Paiements Partiels) :
     🏛️ <b>SNAPSCHOOL</b> • <i>File de Recouvrement</i>
     ━━━━━━━━━━━━━━━━━━━━━━
     💰 <b>Total à recouvrer :</b> <code>547 DT</code> (4 dossiers)
     • ❌ Échus : <code>0 DT</code> • ⏳ Ce mois : <code>0 DT</code> • 📅 À venir : <code>547 DT</code>

     👤 <b>Wiemtest Marzouki</b> • <code>6A</code> (Juin 2027)
     • Payé : <code>16 DT</code> • Reste : <code>107 DT</code> ⚠️ <i>Non planifiée</i>

     👤 <b>test testts</b> • <code>3A</code> (Octobre 2026)
     • Payé : <code>100 DT</code> • Reste : <code>300 DT</code> ⚠️ <i>Non planifiée</i>

     👤 <b>tets test01</b> • <code>1B</code> (Septembre 2026)
     • Payé : <code>10 DT</code> • Reste : <code>90 DT</code> ⚠️ <i>Non planifiée</i>

     👤 <b>testttt 01</b> • <code>3A</code> (Septembre 2026)
     • Payé : <code>50 DT</code> • Reste : <code>50 DT</code> ⚠️ <i>Non planifiée</i>

     <blockquote>💡 <b>Hnia :</b> 4 reliquats en attente de recouvrement. Utilisez les boutons ci-dessous pour recouvrer ou planifier une date.</blockquote>

4. LANGUE :
   - Réponds toujours dans la langue de l'administrateur (arabe tunisien, français ou anglais).
   - N'affiche JAMAIS de Markdown brut cassé ('###', '---') ni de noms de fonctions API techniques.

5. CONTINUITÉ CONVERSATIONNELLE & CONTEXTE :
   - Tu as accès à l'historique des échanges récents. Chaque message s'inscrit dans la continuité directe de la discussion.
   - Si l'administrateur pose une question courte, utilise des pronoms ou demande une précision (ex: "donne tous les noms", "et pour lui ?", "combien il doit ?", "affiche le reste", "qui d'autre ?"), réfère-toi TOUJOURS aux entités (classe, élève, parent, date) évoquées dans les messages précédents.
   - Exemple crucial : si vous venez de parler des élèves de la classe 1A et que l'utilisateur demande "donne tous les noms", tu dois appeler get_students avec className: "1A" (avec limit: 50) pour afficher la totalité des élèves de la classe 1A, et JAMAIS ceux de toute l'école.
   - Si le message contient une indication "[En réponse au message : ...]", utilise ce message cité comme contexte prioritaire direct.`;

  // Candidate models with primary powerful flash model and fallbacks
  const CANDIDATE_MODELS = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-flash-latest",
  ];

  // Helper to format friendly error message without raw API dumps
  function formatUserErrorMessage(err: any): string {
    const msg = (err?.message || "").toLowerCase();
    if (
      msg.includes("429") ||
      msg.includes("quota") ||
      msg.includes("resource_exhausted") ||
      msg.includes("too many requests")
    ) {
      return "⏳ Le service d'intelligence artificielle est actuellement très sollicité. Veuillez patienter un instant avant d'envoyer votre prochaine demande.";
    }
    if (msg.includes("api key") || msg.includes("403") || msg.includes("permission_denied")) {
      return "⚠️ Une erreur d'autorisation est survenue avec le service d'IA. Veuillez vérifier la configuration de votre clé API.";
    }
    return "Désolée, une erreur temporaire est survenue lors du traitement de votre demande. Veuillez réessayer dans quelques instants.";
  }

  // Build clean alternating history for Gemini
  const rawTurns: { role: "user" | "model"; text: string }[] = [];
  for (const m of historyMessages) {
    if (!m.content || !m.content.trim()) continue;
    rawTurns.push({
      role: m.role === "assistant" ? "model" : "user",
      text: m.content.trim(),
    });
  }

  // Ensure strict role alternation (merge consecutive turns of the same role)
  const normalizedTurns: { role: "user" | "model"; text: string }[] = [];
  for (const turn of rawTurns) {
    if (
      normalizedTurns.length > 0 &&
      normalizedTurns[normalizedTurns.length - 1].role === turn.role
    ) {
      normalizedTurns[normalizedTurns.length - 1].text += `\n${turn.text}`;
    } else {
      normalizedTurns.push({ role: turn.role, text: turn.text });
    }
  }

  // Gemini requires history to start with 'user'
  while (normalizedTurns.length > 0 && normalizedTurns[0].role !== "user") {
    normalizedTurns.shift();
  }

  // Gemini requires history to end with 'model' (since chat.sendMessage will send the next 'user' turn)
  while (
    normalizedTurns.length > 0 &&
    normalizedTurns[normalizedTurns.length - 1].role !== "model"
  ) {
    normalizedTurns.pop();
  }

  const historyContents = normalizedTurns.map((t) => ({
    role: t.role,
    parts: [{ text: t.text }],
  }));

  const currentTurnParts: any[] = [{ text: effectiveUserMessage }];

  const genAI = new GoogleGenerativeAI(apiKey);
  let succeeded = false;
  let lastError: any = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      console.log(`[Agent] Attempting processing with model: ${modelName}`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        tools: [
          {
            functionDeclarations: getGeminiFunctionDeclarations(),
          },
        ],
      });

      const chat = model.startChat({
        history: historyContents,
      });

      let response = await chat.sendMessage(currentTurnParts);
      let candidate = response.response;

      // Handle tool calling loop
      let functionCalls = candidate.functionCalls();
      let lastExecutedTool: string | undefined;

      while (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        const toolName = call.name;
        const toolArgs = (call.args || {}) as Record<string, any>;

        const toolDef = TOOLS[toolName];
        if (!toolDef) {
          console.warn(`[Agent] Unknown function call: ${toolName}`);
          break;
        }

        // Check if tool requires confirmation
        if (toolDef.requiresConfirmation) {
          // Create pending tool call record in DB
          const toolCallRecord = await prisma.aIToolCall.create({
            data: {
              conversationId: conversation.id,
              toolName,
              arguments: toolArgs,
              status: "PENDING",
              requiresConfirm: true,
            },
          });

          // Format confirmation prompt
          const confirmText = toolDef.formatConfirmationMessage
            ? await Promise.resolve(toolDef.formatConfirmationMessage(toolArgs, context))
            : `❓ Souhaitez-vous confirmer l'exécution de l'action **${toolName}** ?`;

          const styledConfirmText = formatTelegramMessage(confirmText);

          // Send confirmation message with inline buttons
          await sendTelegramMessage(chatId, styledConfirmText, {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ Confirmer", callback_data: `confirm:${toolCallRecord.id}` },
                  { text: "❌ Annuler", callback_data: `cancel:${toolCallRecord.id}` },
                ],
              ],
            },
          });

          // Save assistant note
          await prisma.aIMessage.create({
            data: {
              conversationId: conversation.id,
              role: "assistant",
              content: confirmText,
            },
          });

          // Stop turn — user must confirm before anything further happens
          succeeded = true;
          return;
        }

        // Read-only tool: execute immediately
        lastExecutedTool = toolName;
        await sendTelegramChatAction(chatId, "typing");
        const toolOutput = await toolDef.execute(toolArgs, context);

        // Save tool call record
        await prisma.aIToolCall.create({
          data: {
            conversationId: conversation.id,
            toolName,
            arguments: toolArgs,
            result: toolOutput,
            status: "EXECUTED",
            executedAt: new Date(),
          },
        });

        // Send tool output to Gemini for natural language synthesis
        response = await chat.sendMessage([
          {
            text: `[DONNÉES SYSTÈME POUR ${toolName.toUpperCase()}] :\n${JSON.stringify(
              toolOutput
            )}\n\nPrésente ces données à l'administrateur sous forme d'une mini-carte Telegram compacte, 100% optimisée pour mobile (smartphone) :
- Zéro texte superflu : pas de bavardage, aucun UUID/ID technique affiché.
- Format ultra-synthétique et scannable avec <b>gras</b>, <i>italique</i>, et <code>...</code> pour les montants, classes et dates.
- Termine UNIQUEMENT si nécessaire par 1 courte phrase percutante d'action dans <blockquote>💡 <b>Hnia :</b> [conseil direct]</blockquote>.
- Réponds dans sa langue (${tgAccount.language || "fr"}).`,
          },
        ]);

        candidate = response.response;
        functionCalls = candidate.functionCalls();
      }

      // Final textual response
      let finalReply = "Je reste à votre disposition pour toute autre question.";
      try {
        finalReply = candidate.text() || finalReply;
      } catch (textErr) {
        console.warn("[Agent] candidate.text() warning:", textErr);
      }

      // Save reply to DB
      await prisma.aIMessage.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: finalReply,
        },
      });

      // Format reply as an executive-grade Telegram card
      const formattedReply = formatTelegramMessage(finalReply, tgAccount.School.name);
      const quickButtons = getQuickActionButtons(lastExecutedTool, formattedReply);

      // Send formatted message to Telegram
      await sendTelegramMessage(chatId, formattedReply, {
        parse_mode: "HTML",
        reply_markup: quickButtons,
      });

      succeeded = true;
      break;
    } catch (err: any) {
      console.warn(`[Agent] Model ${modelName} encountered error:`, err.message || err);
      lastError = err;
      // Continue to next candidate model
    }
  }

  if (!succeeded) {
    console.error("[Agent] All candidate models failed. Last error:", lastError);
    const friendlyError = formatUserErrorMessage(lastError);
    await sendTelegramMessage(chatId, friendlyError);
  }
}
