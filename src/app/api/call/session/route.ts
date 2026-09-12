import { NextRequest, NextResponse } from "next/server";
import { verifyCallToken } from "@/lib/call/token";
import { getGeminiFunctionDeclarations } from "@/lib/telegram/tools";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token || req.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Token de session manquant" }, { status: 401 });
    }

    const payload = verifyCallToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Session d'appel invalide ou expirée" }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Clé Gemini API non configurée" }, { status: 500 });
    }

    const todayStr = new Date().toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const systemInstruction = `Tu es Hnia (هنية), l'assistante vocale d'opérations scolaires de l'école "${payload.schoolName}".
Tu es actuellement en appel téléphonique direct avec l'administrateur : "${payload.adminName}".
Aujourd'hui nous sommes le : ${todayStr}.
Devise officielle : Dinars Tunisiens (DT).

RÈGLES CAPITALES POUR L'APPEL VOCAL TÉLÉPHONIQUE :
1. LANGUE ET TON NATUREL : Parle chaleureusement en DIALECTE TUNISIEN (Derja / تونسية) ou en FRANCO-TUNISIEN (mélange naturel tunisien et français comme au bureau en Tunisie).
   - Expressions tunisiennes naturelles bienvenues : "عسلامة سي ${payload.adminName}", "أي تفضل", "واضح", "ثواني نثبتلك", "سجلتها توا", "فما كذا وكذا".
   - Si l'administrateur parle en français, réponds en français ou en franco-arabe naturel.
2. ULTRA-CONCIS (STYLE TÉLÉPHONE) : Réponds en UNE ou DEUX phrases courtes maximum. Ne lis JAMAIS de longues listes de noms au téléphone. Donne le chiffre clé et le résumé direct (ex: "فما 4 dossiers متاع paiements partiels فيهم 547 دينار", ou "Lyoum famma 1 750 Dinars encaissés").
3. DÉCLENCHEMENT D'OUTIL IMMÉDIAT (CRUCIAL) :
   - Question sur les encaissements ou revenus du jour ("9adeh dkhalt flous", "recettes aujourd'hui") -> appelle tout de suite 'get_incomes' avec date: "today".
   - Question sur les absences du jour ("chkoun ghayeb lyoum", "absences aujourd'hui") -> appelle 'get_attendance' avec status: "ABSENT".
   - Question sur les reliquats ("les impayés partiels", "paiements partiels", "reliquats") -> appelle 'get_partial_payments'.
   - Ordre de marquer un élève absent -> appelle 'mark_attendance'.
4. RÉPONSE ORALE IMMÉDIATE : Dès que la fonction retourne son résultat, annonce la réponse vocalement sans hésiter. Ne fais aucune réflexion interne silencieuse.
5. AUCUN SYMBOLE NI CODE : Pas de Markdown, pas de balises HTML, pas d'anglais technique. Tu es une vraie personne au bout du fil.`;

    const tools = getGeminiFunctionDeclarations();

    return NextResponse.json({
      ok: true,
      apiKey,
      model: "models/gemini-2.5-flash-native-audio-latest",
      wsUrl: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`,
      systemInstruction,
      tools: [{ functionDeclarations: tools }],
      adminName: payload.adminName,
      schoolName: payload.schoolName,
      schoolId: payload.schoolId,
    });
  } catch (error: any) {
    console.error("[Call Session API Error]:", error);
    return NextResponse.json({ error: error.message || "Erreur interne" }, { status: 500 });
  }
}
