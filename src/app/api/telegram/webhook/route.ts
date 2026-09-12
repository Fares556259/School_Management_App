import { NextRequest, NextResponse } from "next/server";
import {
  sendTelegramMessage,
  sendTelegramChatAction,
  answerTelegramCallbackQuery,
  getTelegramFile,
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

    // 12. Handle Photo / Flyer Attachment
    const photos = message.photo;
    if (photos && photos.length > 0) {
      await sendTelegramChatAction(chatId, "typing");
      const bestPhoto = photos[photos.length - 1];
      let photoUrl: string | undefined;
      try {
        const fileInfo = await getTelegramFile(bestPhoto.file_id);
        const botToken = process.env.TELEGRAM_BOT_TOKEN || "8740615331:AAEa9Xzx_WJnlw-XEgkhoO5Vcbb9KEWl7HU";
        photoUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.file_path}`;
      } catch (err) {
        console.warn("[Telegram Webhook] Failed to retrieve photo URL:", err);
      }

      const photoDescriptor = photoUrl
        ? `[Une photo/affiche a été jointe par l'administrateur : ${photoUrl}]`
        : `[Une photo/affiche a été jointe par l'administrateur]`;

      if (!userPrompt || userPrompt.trim().length === 0) {
        userPrompt = `${photoDescriptor}\nVoici l'affiche ou image pour l'annonce.`;
      } else {
        userPrompt = `${photoDescriptor}\n${userPrompt}`;
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
