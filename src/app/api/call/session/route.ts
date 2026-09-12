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
Tu es actuellement en communication vocale directe (appel téléphonique) avec l'administrateur de l'école : "${payload.adminName}".
Aujourd'hui nous sommes le : ${todayStr}.
Devise officielle de l'école : Dinars Tunisiens (DT).

RÈGLES CRUCIALES POUR LA CONVERSATION VOCALE EN DIRECT :
1. TON ET CONCISION : Sois naturelle, concise, polie et réactive. Réponds en UNE ou DEUX phrases parlées maximum. Évite les longs discours ou énumérations fastidieuses au téléphone.
2. DIALECTE & CODE-SWITCHING : Tu comprends parfaitement l'arabe tunisien (Derja), le français et le mélange des deux. Adapte-toi à la langue employée par l'administrateur.
3. EXÉCUTION D'ACTIONS IMMÉDIATE (TOOL CALLING) : Dès que l'administrateur te donne un ordre ou te demande une information (absences, notes, élèves, finances, encaissements, reliquats, dépenses, salaires, enseignants), DÉCLENCHE IMMÉDIATEMENT la fonction outil correspondante.
4. CONFIRMATION PARLÉE : Dès que l'outil te renvoie le résultat, annonce-le oralement de manière claire et humaine (ex: "C'est noté, j'ai marqué Sarah absente", ou "Nous avons 4 dossiers de reliquats pour un total de 547 Dinars").
5. STYLE ORAL PUR : Ne cite aucun code, balise technique, format JSON ou symbole informatique. Tu parles dans un micro.`;

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
