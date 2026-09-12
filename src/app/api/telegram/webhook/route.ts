import { NextRequest, NextResponse } from "next/server";
import {
  sendTelegramMessage,
  sendTelegramChatAction,
  answerTelegramCallbackQuery,
  getTelegramFile,
  downloadTelegramFileBuffer,
  setChatMenuButton,
} from "@/lib/telegram/telegram";
import {
  verifyAndLinkAccount,
  getLinkedAccount,
  updateAccountLanguage,
  unlinkAccount,
} from "@/lib/telegram/linking";
import { handleConfirmationCallback } from "@/lib/telegram/confirmation";
import { runTelegramAgent } from "@/lib/telegram/agent";
import { transcribeTelegramVoice } from "@/lib/telegram/voice";
import { analyzeTelegramImage, uploadTelegramPhotoToStorage } from "@/lib/telegram/vision";
import { generateCallToken } from "@/lib/call/token";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // 1. Webhook Secret Validation (only enforced if TELEGRAM_WEBHOOK_SECRET is configured)
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (expectedSecret && secretHeader !== expectedSecret) {
    console.warn("[Telegram Webhook] Unauthorized request rejected (invalid secret).");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const update = await req.json();

    // 2. Handle Inline Keyboard Button Clicks (Confirmation/Cancellation)
    if (update.callback_query) {
      const data = update.callback_query.data || "";

      // Handle language picker callbacks
      if (data.startsWith("lang:")) {
        const selectedLang = data.replace("lang:", "") as "fr" | "ar" | "en";
        const tgId = update.callback_query.from.id.toString();
        await updateAccountLanguage(tgId, selectedLang);

        const langLabels = {
          fr: "🇫🇷 Langue mise à jour en Français.",
          ar: "🇹🇳 تم تغيير اللغة إلى العربية.",
          en: "🇬🇧 Language changed to English.",
        };

        await sendTelegramMessage(
          update.callback_query.message.chat.id,
          langLabels[selectedLang] || "Langue mise à jour."
        );
        return NextResponse.json({ ok: true });
      }

      // Handle announcement concierge quick action buttons
      if (data.startsWith("announce:")) {
        const actionType = data.replace("announce:", "");
        const tgId = update.callback_query.from.id.toString();
        const chatId = update.callback_query.message.chat.id;

        await answerTelegramCallbackQuery(update.callback_query.id, "Traitement...");

        const announcePrompts: Record<string, string> = {
          publish: "Publie cette annonce telle quelle maintenant.",
          regenerate: "Propose une autre formulation différente pour cette annonce.",
          urgent: "Passe cette annonce en statut URGENT (alerte rouge prioritaire).",
          class: "Je souhaite restreindre cette annonce à une classe. Quelles sont les classes disponibles dans l'école ?",
          edit: "Je souhaite modifier le contenu de l'annonce.",
        };

        const prompt = announcePrompts[actionType] || "Que souhaitez-vous faire avec cette annonce ?";
        const tgAccount = await getLinkedAccount(tgId);
        if (tgAccount) {
          await runTelegramAgent({
            userMessage: prompt,
            chatId,
            telegramId: tgId,
            tgAccount,
          });
        }
        return NextResponse.json({ ok: true });
      }

      // Handle contextual quick action buttons
      if (data.startsWith("action:")) {
        const actionType = data.replace("action:", "");
        const tgId = update.callback_query.from.id.toString();
        const chatId = update.callback_query.message.chat.id;

        await answerTelegramCallbackQuery(update.callback_query.id, "Traitement en cours...");

        const actionPrompts: Record<string, string> = {
          send_reminders: "Envoie les rappels de paiement par notification à toutes les familles ayant des impayés ce mois-ci.",
          view_expenses: "Donne-moi le détail complet des dépenses de ce mois par catégorie.",
          record_payment: "Je souhaite enregistrer un paiement de scolarité reçu d'une famille.",
          recover_partial: "Je souhaite recouvrer un reliquat de paiement partiel pour un élève.",
          schedule_recovery: "Je souhaite fixer une date d'échéance de recouvrement pour un paiement partiel.",
          add_income: "Je souhaite ajouter un nouveau revenu / recette pour l'école.",
          add_expense: "Je souhaite enregistrer une nouvelle dépense pour l'école.",
          financial_summary: "Donne-moi le bilan financier complet de l'école (revenus, dépenses, solde).",
          pay_salary: "Je souhaite enregistrer le versement d'un salaire ou d'une avance pour un enseignant.",
          add_teacher: "Je souhaite recruter un nouvel enseignant.",
          mark_attendance: "Je souhaite marquer un élève absent ou en retard aujourd'hui.",
          attendance_history: "Montre-moi l'historique des absences récentes des élèves.",
          find_substitute: "Qui peut remplacer un enseignant absent aujourd'hui ?",
          add_slot: "Je souhaite ajouter une séance de cours à l'emploi du temps.",
          record_grade: "Je souhaite enregistrer une note pour un élève.",
          schedule_exam: "Je souhaite planifier un examen.",
        };

        const prompt = actionPrompts[actionType] || "Comment puis-je vous aider ?";
        const tgAccount = await getLinkedAccount(tgId);
        if (tgAccount) {
          await runTelegramAgent({
            userMessage: prompt,
            chatId,
            telegramId: tgId,
            tgAccount,
          });
        }
        return NextResponse.json({ ok: true });
      }

      // Handle write action confirmations
      await handleConfirmationCallback(update.callback_query);
      return NextResponse.json({ ok: true });
    }

    const message = update.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const telegramId = message.from.id.toString();
    const telegramUsername = message.from.username;
    const rawText = (message.text || message.caption || "").trim();

    // 3. Command: /start [code]
    if (rawText.startsWith("/start")) {
      const parts = rawText.split(" ");
      const startArg = parts[1]?.trim();

      if (startArg && /^\d{6}$/.test(startArg)) {
        // Deep-link code provided: /start 123456
        const linkResult = await verifyAndLinkAccount(telegramId, telegramUsername, startArg);
        if (linkResult.success) {
          await sendTelegramMessage(
            chatId,
            `🎉 **Félicitations ${linkResult.adminName} !**\nVotre compte Telegram est maintenant relié à l'école **${linkResult.schoolName}**.\n\nJe suis **Hnia**, votre assistante opérationnelle. Vous pouvez me poser des questions par texte ou par note vocale :\n• _"Qui est absent aujourd'hui ?"_\n• _"Quels sont les impayés de ce mois ?"_\n• _"J'ai reçu 500 DT de Mohamed pour septembre"_\n• _"Combien de revenus avons-nous ce mois-ci ?"_\n\nQue puis-je faire pour vous ?`,
            { parse_mode: "Markdown" }
          );
          return NextResponse.json({ ok: true });
        } else {
          await sendTelegramMessage(
            chatId,
            `⚠️ Le code fourni est invalide ou a expiré. Veuillez générer un nouveau code depuis votre tableau de bord SnapSchool.`,
            { parse_mode: "Markdown" }
          );
          return NextResponse.json({ ok: true });
        }
      }

      // Normal /start without code
      const existing = await getLinkedAccount(telegramId);
      if (existing) {
        const adminName =
          [existing.admin.name, existing.admin.surname].filter(Boolean).join(" ") ||
          existing.admin.username;
        await sendTelegramMessage(
          chatId,
          `👋 **Bonjour ${adminName} !**\nVotre compte est bien relié à **${existing.School.name}**.\n\nEnvoyez-moi un message ou une note vocale, ou tapez /help pour voir les fonctionnalités disponibles.`,
          { parse_mode: "Markdown" }
        );
        return NextResponse.json({ ok: true });
      } else {
        await sendTelegramMessage(
          chatId,
          `👋 **Bienvenue sur SnapSchool AI (Hnia) !**\n\nPour commencer à gérer votre école :\n1. Connectez-vous à votre tableau de bord sur https://www.snapschool.academy\n2. Accédez à **Paramètres > Assistant Telegram**\n3. Cliquez sur **Lier mon Telegram** pour obtenir votre code à 6 chiffres\n4. Envoyez le code ici directement ou tapez :\n   \`/link VOTRE_CODE\``,
          { parse_mode: "Markdown" }
        );
        return NextResponse.json({ ok: true });
      }
    }

    // 4. Command: /link <code>
    if (rawText.startsWith("/link")) {
      const code = rawText.replace("/link", "").trim();
      if (!code) {
        await sendTelegramMessage(
          chatId,
          `Veuillez spécifier le code à 6 chiffres. Exemple : \`/link 123456\``,
          { parse_mode: "Markdown" }
        );
        return NextResponse.json({ ok: true });
      }

      const linkResult = await verifyAndLinkAccount(telegramId, telegramUsername, code);
      if (linkResult.success) {
        await sendTelegramMessage(
          chatId,
          `🎉 **Compte relié avec succès !**\nBienvenue **${linkResult.adminName}** (${linkResult.schoolName}).\n\nVous pouvez maintenant interagir avec votre école par texte ou par note vocale.`,
          { parse_mode: "Markdown" }
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `⚠️ Code invalide ou expiré. Veuillez vérifier le code sur votre tableau de bord SnapSchool.`,
          { parse_mode: "Markdown" }
        );
      }
      return NextResponse.json({ ok: true });
    }

    // 5. Command: /unlink
    if (rawText === "/unlink") {
      const existing = await getLinkedAccount(telegramId);
      if (existing) {
        await unlinkAccount(existing.adminId);
        await sendTelegramMessage(
          chatId,
          `🔒 Votre compte Telegram a été dissocié de SnapSchool. Pour le relier à nouveau, utilisez la commande /start.`
        );
      } else {
        await sendTelegramMessage(chatId, `Aucun compte n'est actuellement relié.`);
      }
      return NextResponse.json({ ok: true });
    }

    // 6. Command: /help
    if (rawText === "/help") {
      await sendTelegramMessage(
        chatId,
        `🤖 **SnapSchool AI (Hnia / هنية) — Guide Complet**

Je suis votre assistante d'opérations scolaires. Vous pouvez me parler en langage naturel ou m'envoyer des notes vocales en **Arabe tunisien**, **Français**, ou **Anglais**.

---

📞 **Appel Vocal Direct (Nouveau !) :**
• Tapez \`/call\` pour lancer un appel téléphonique en direct avec moi dans Telegram !

🎓 **1. Pédagogie & Élèves**
• _"Donne-moi le profil complet de l'élève Mohamed"_ (Fiche 360°)
• _"Inscris un nouvel élève Youssef Trabelsi en 8ème B (Tél père: 98123456)"_
• _"Crée la classe 8ème C avec une capacité de 25 élèves"_

👥 **2. Personnel & Salaires**
• _"Ajoute un enseignant de Français nommé Karim Gharbi (Taux: 25 DT)"_
• _"Paie le salaire de Monsieur Trabelsi pour septembre avec déduction de ses absences"_
• _"Donne-moi la liste de tout le personnel de l'école"_

⏱️ **3. Présences & Discipline**
• _"Qui est absent aujourd'hui ?"_ ou _"chkoun ghayeb lyoum ?"_
• _"Marque l'élève Sarah Ben Salem ABSENTE aujourd'hui"_ (notifie les parents)
• _"Historique des absences de Mohamed sur les 30 derniers jours"_

📅 **4. Emplois du Temps & Remplacements**
• _"Qui peut remplacer un prof de maths mardi de 10h à 12h ?"_ (Remplacement d'urgence)
• _"Montre-moi l'emploi du temps de la 7ème A pour mercredi"_
• _"Ajoute une séance d'Histoire pour la 8ème B vendredi de 08:00 à 10:00"_

📝 **5. Notes & Examens**
• _"Enregistre la note 16.5/20 pour Mohamed Ben Amor en Physique"_
• _"Planifie un examen d'Anglais pour la 9ème A le 2026-10-15 à 09:00"_
• _"Donne-moi le relevé de notes de la classe 4A en Mathématiques"_

💰 **6. Finances & Relances**
• _"J'ai reçu 450 DT de Mohamed pour septembre"_
• _"Ajoute une dépense de 120 DT pour facture STEG"_
• _"Quelles sont les anomalies financières et les gros impayés ?"_
• _"Envoie les rappels de paiement à toutes les familles en retard"_

📢 **7. Communication**
• _"Publie une annonce pour demain : Réunion des parents à 16h"_

---

⚙️ **Commandes système :**
• \`/call\` — 📞 Passer un appel vocal en direct avec Hnia
• \`/lang\` — Changer la langue (Français / العربية / English)
• \`/status\` — Vérifier l'état de votre connexion
• \`/unlink\` — Dissocier votre compte Telegram`,
        { parse_mode: "Markdown" }
      );
      return NextResponse.json({ ok: true });
    }

    // 7. Command: /lang
    if (rawText === "/lang") {
      await sendTelegramMessage(chatId, "Choisissez votre langue préférée / اختر لغتك المفضلة :", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🇫🇷 Français", callback_data: "lang:fr" },
              { text: "🇹🇳 العربية (تونسي)", callback_data: "lang:ar" },
              { text: "🇬🇧 English", callback_data: "lang:en" },
            ],
          ],
        },
      });
      return NextResponse.json({ ok: true });
    }

    // 8. Command: /status
    if (rawText === "/status") {
      const account = await getLinkedAccount(telegramId);
      if (account) {
        await sendTelegramMessage(
          chatId,
          `✅ **Connecté à SnapSchool**\n• École : **${account.School.name}**\n• Administrateur : **${account.admin.username}**\n• Langue : **${account.language.toUpperCase()}**\n• Briefing matinal : **${account.dailyBriefing ? "Actif (7h30)" : "Désactivé"}**`,
          { parse_mode: "Markdown" }
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `❌ Non connecté. Utilisez /start pour associer votre compte.`
        );
      }
      return NextResponse.json({ ok: true });
    }

    // 9. Command: /call (or audio call trigger)
    const lowerText = rawText.toLowerCase();
    if (
      lowerText === "/call" ||
      lowerText.includes("appeler hnia") ||
      lowerText.includes("appel vocal") ||
      lowerText.includes("كلم هنية") ||
      lowerText.includes("call hnia")
    ) {
      const account = await getLinkedAccount(telegramId);
      if (!account) {
        await sendTelegramMessage(
          chatId,
          `⚠️ Veuillez d'abord associer votre compte SnapSchool avec /start.`
        );
        return NextResponse.json({ ok: true });
      }

      const adminName =
        [account.admin.name, account.admin.surname].filter(Boolean).join(" ") ||
        account.admin.username;

      const callToken = generateCallToken({
        adminId: account.adminId,
        schoolId: account.schoolId,
        telegramChatId: chatId,
        telegramId,
        adminName,
        schoolName: account.School.name,
        language: account.language || "fr",
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.snapschool.academy";
      const callUrl = `${appUrl}/call?auth=${callToken}`;

      // Also set the persistent bottom menu button for instant access
      try {
        await setChatMenuButton(chatId, {
          type: "web_app",
          text: "📞 Appeler Hnia",
          web_app: { url: callUrl },
        });
      } catch (menuErr) {
        console.warn("[Telegram Webhook] Failed to set menu button:", menuErr);
      }

      await sendTelegramMessage(
        chatId,
        `📞 **Appel Vocal en Direct avec Hnia**\n\nPrêt à échanger de vive voix avec votre assistante opérationnelle ?\n• Dialogue fluide en **Tunisien / Français**\n• Exécution de vos ordres en direct (présences, finances, notes)\n• Compte-rendu automatique envoyé à la fin de l'appel\n\nCliquez ci-dessous pour décrocher l'appel :`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "📞 Décrocher l'Appel avec Hnia",
                  web_app: { url: callUrl },
                },
              ],
            ],
          },
        }
      );
      return NextResponse.json({ ok: true });
    }

    // 9. Friendly Check: Did user send just a 6-digit code without /link?
    if (/^\d{6}$/.test(rawText)) {
      const linkResult = await verifyAndLinkAccount(telegramId, telegramUsername, rawText);
      if (linkResult.success) {
        await sendTelegramMessage(
          chatId,
          `🎉 **Compte relié avec succès !**\nBienvenue **${linkResult.adminName}** (${linkResult.schoolName}).\n\nVous pouvez désormais gérer votre école en me parlant directement par texte ou note vocale !`,
          { parse_mode: "Markdown" }
        );
        return NextResponse.json({ ok: true });
      }
    }

    // 10. Check if user is linked before proceeding to AI agent
    const tgAccount = await getLinkedAccount(telegramId);
    if (!tgAccount) {
      await sendTelegramMessage(
        chatId,
        `⚠️ Votre compte Telegram n'est pas encore associé à votre école SnapSchool.\n\nVeuillez vous connecter sur https://www.snapschool.academy, aller dans **Paramètres > Assistant Telegram**, et envoyer votre code à 6 chiffres ici.`,
        { parse_mode: "Markdown" }
      );
      return NextResponse.json({ ok: true });
    }

    // 11. Handle Voice Note
    let userPrompt = rawText;
    const voice = message.voice || message.audio;

    if (voice) {
      await sendTelegramChatAction(chatId, "record_voice");
      try {
        const transcription = await transcribeTelegramVoice(voice.file_id);
        if (!transcription || transcription.trim().length === 0) {
          await sendTelegramMessage(
            chatId,
            `Désolé, je n'ai pas pu entendre distinctement votre message vocal. Pouvez-vous répéter ou taper votre message ?`
          );
          return NextResponse.json({ ok: true });
        }

        // Echo transcription briefly so user sees what was understood
        await sendTelegramMessage(
          chatId,
          `🎙️ _"${transcription}"_`,
          { parse_mode: "Markdown" }
        );

        userPrompt = transcription;
      } catch (err: any) {
        console.error("[Voice Transcription Error]:", err);
        await sendTelegramMessage(
          chatId,
          `⚠️ Impossible de transcrire le message vocal (${err.message || "Erreur"}). Veuillez réessayer ou envoyer un message texte.`
        );
        return NextResponse.json({ ok: true });
      }
    }

    // 12. Handle Photo / Scanned Document Attachment
    const photos = message.photo;
    if (photos && photos.length > 0) {
      await sendTelegramChatAction(chatId, "typing");
      const bestPhoto = photos[photos.length - 1];
      let photoUrl: string | undefined;
      let photoBuffer: Buffer | undefined;

      try {
        const fileInfo = await getTelegramFile(bestPhoto.file_id);
        const botToken =
          process.env.TELEGRAM_BOT_TOKEN || "8740615331:AAEa9Xzx_WJnlw-XEgkhoO5Vcbb9KEWl7HU";
        photoUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.file_path}`;
        photoBuffer = await downloadTelegramFileBuffer(fileInfo.file_path);
      } catch (err) {
        console.warn("[Telegram Webhook] Failed to retrieve or download photo:", err);
      }

      if (photoBuffer) {
        // 1. Upload to Supabase Storage so the file URL never expires
        const permanentUrl = await uploadTelegramPhotoToStorage(
          photoBuffer,
          tgAccount.schoolId,
          "doc"
        );
        if (permanentUrl) {
          photoUrl = permanentUrl;
        }

        // 2. Perform intelligent multimodal document analysis with Gemini Vision
        const analysis = await analyzeTelegramImage(photoBuffer, userPrompt);
        console.log("[Telegram Webhook] Document analysis:", analysis);

        const docDescriptor = `[DOCUMENT NUMÉRISÉ REÇU PAR PHOTO]
- Type détecté : ${analysis.documentType}
- Titre / Enseigne : ${analysis.title || analysis.merchant || "Non spécifié"}
- Montant extrait : ${analysis.amount !== undefined ? `${analysis.amount} DT` : "Non spécifié"}
- Date du document : ${analysis.date || "Non spécifiée"}
- Catégorie : ${analysis.category || "Général"}
- Personne concernée : ${analysis.studentName || analysis.parentName || "Non spécifié"}
- Résumé visuel : ${analysis.summary}
- Justificatif (URL image) : ${photoUrl}`;

        if (!userPrompt || userPrompt.trim().length === 0) {
          if (analysis.documentType === "EXPENSE_RECEIPT") {
            userPrompt = `${docDescriptor}

L'administrateur a envoyé la photo de ce ticket de caisse / facture sans texte d'accompagnement.
Agis directement :
Appelle immédiatement l'outil 'add_expense' avec :
- title: "${analysis.merchant || analysis.title || "Dépense"}"
- amount: ${analysis.amount || 0}
- category: "${analysis.category || "Général"}"
- date: "${analysis.date || new Date().toISOString().split("T")[0]}"
- img: "${photoUrl}"
(Cela générera la carte de confirmation d'enregistrement de la dépense avec le justificatif rattaché).`;
          } else if (analysis.documentType === "PAYMENT_RECEIPT") {
            userPrompt = `${docDescriptor}

L'administrateur a envoyé un reçu de paiement / virement bancaire pour des frais scolaires.
${analysis.studentName ? `Élève identifié : ${analysis.studentName}.` : "Élève à identifier."}
${analysis.amount ? `Montant : ${analysis.amount} DT.` : ""}
Propose d'enregistrer le paiement de scolarité via 'record_payment' avec ce justificatif.`;
          } else if (analysis.documentType === "ABSENCE_CERTIFICATE") {
            userPrompt = `${docDescriptor}

L'administrateur a envoyé un certificat médical / mot d'absence.
${analysis.studentName ? `Élève concerné : ${analysis.studentName}.` : "Élève à identifier."}
Propose d'enregistrer et justifier l'absence de l'élève.`;
          } else if (analysis.documentType === "ANNOUNCEMENT_FLYER") {
            userPrompt = `${docDescriptor}

L'administrateur a envoyé une affiche / visuel pour une annonce scolaire.
Propose une annonce officielle attrayante reprenant le contenu de l'affiche et associe cette image (${photoUrl}).`;
          } else if (analysis.documentType === "COURSE_RESOURCE") {
            userPrompt = `${docDescriptor}

L'administrateur a envoyé un support de cours / résumé de leçon / document pédagogique.
- Titre suggéré : "${analysis.title || "Support de cours"}"
${analysis.className ? `- Classe identifiée : "${analysis.className}"` : "- Classe : à préciser si non spécifiée"}
${analysis.subjectName ? `- Matière identifiée : "${analysis.subjectName}"` : "- Matière : à préciser si non spécifiée"}
- Description : "${analysis.summary}"
- Fichier joint : ${photoUrl}

Instructions :
Propose de publier cette ressource pédagogique avec l'outil 'add_resource' en pré-remplissant title: "${analysis.title || "Support de cours"}", url: "${photoUrl}", description: "${analysis.summary}"${analysis.className ? `, className: "${analysis.className}"` : ""}${analysis.subjectName ? `, subjectName: "${analysis.subjectName}"` : ""}.
Rappelle que les élèves et parents recevront une notification push dès publication.`;
          } else if (analysis.documentType === "HOMEWORK_ASSIGNMENT") {
            userPrompt = `${docDescriptor}

L'administrateur a envoyé une fiche de devoir / exercices scolaires.
- Titre suggéré : "${analysis.title || "Devoir maison"}"
${analysis.className ? `- Classe identifiée : "${analysis.className}"` : "- Classe : à préciser si non spécifiée"}
${analysis.subjectName ? `- Matière identifiée : "${analysis.subjectName}"` : "- Matière : à préciser si non spécifiée"}
- Consignes : "${analysis.summary}"
- Document joint : ${photoUrl}

Instructions :
Propose de créer ce devoir scolaire avec l'outil 'create_assignment' en pré-remplissant title: "${analysis.title || "Devoir"}", img: "${photoUrl}", description: "${analysis.summary}"${analysis.className ? `, className: "${analysis.className}"` : ""}${analysis.subjectName ? `, subjectName: "${analysis.subjectName}"` : ""}.`;
          } else {
            userPrompt = `${docDescriptor}

L'administrateur a envoyé ce document / cette image : "${analysis.summary}".
Présente brièvement ce qui a été détecté et demande ce qu'il souhaite faire (ressource de cours, devoir, dépense, justificatif ou annonce).`;
          }
        } else {
          userPrompt = `${docDescriptor}

Message / Consigne de l'administrateur : "${userPrompt}"

Instructions :
- Applique directement la consigne de l'administrateur en utilisant les informations déjà extraites du document (montant: ${
            analysis.amount || 0
          } DT, date, enseigne: "${analysis.merchant || analysis.title || "Dépense"}", justificatif URL: ${photoUrl}).
- Si l'administrateur demande d'enregistrer cette dépense ou ce reçu ("ماركيها", "ajoute cette dépense", "garde le reçu"), appelle directement 'add_expense' avec le montant et l'intitulé extraits sans lui redemander les détails visibles sur la photo !`;
        }
      } else {
        const photoDescriptor = photoUrl
          ? `[Une photo/affiche a été jointe par l'administrateur : ${photoUrl}]`
          : `[Une photo/affiche a été jointe par l'administrateur]`;

        if (!userPrompt || userPrompt.trim().length === 0) {
          userPrompt = `${photoDescriptor}\nDocument ou photo reçu de l'administrateur. Que souhaitez-vous en faire ?`;
        } else {
          userPrompt = `${photoDescriptor}\n${userPrompt}`;
        }
      }
    }

    if (!userPrompt || userPrompt.trim().length === 0) {
      return NextResponse.json({ ok: true });
    }

    // 12. Extract quoted reply text if user replied to a previous message
    const replyToText = message.reply_to_message?.text;

    // 13. Run the Core Agent with tool-calling and full conversation context
    await runTelegramAgent({
      userMessage: userPrompt,
      chatId,
      telegramId,
      replyToText,
      tgAccount,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[Telegram Webhook Exception]:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
