import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

export interface DocumentAnalysisResult {
  documentType:
    | "EXPENSE_RECEIPT"
    | "PAYMENT_RECEIPT"
    | "ABSENCE_CERTIFICATE"
    | "ANNOUNCEMENT_FLYER"
    | "COURSE_RESOURCE"
    | "HOMEWORK_ASSIGNMENT"
    | "OTHER";
  title: string;
  summary: string;
  amount?: number;
  date?: string;
  category?: string;
  studentName?: string;
  parentName?: string;
  className?: string;
  subjectName?: string;
  merchant?: string;
  suggestedAction?:
    | "add_expense"
    | "record_payment"
    | "excuse_absence"
    | "post_announcement"
    | "add_resource"
    | "create_assignment"
    | "none";
  publicUrl?: string;
}

const VISION_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
];

/**
 * Uploads an image buffer to Supabase Storage in the 'uploads' bucket.
 * Returns the permanent public URL.
 */
export async function uploadTelegramPhotoToStorage(
  buffer: Buffer,
  schoolId: string,
  filenamePrefix: string = "doc"
): Promise<string | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn("[Vision] Missing Supabase credentials for photo storage");
      return null;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const sanitizedSchool = schoolId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = `documents/telegram/${sanitizedSchool}/${Date.now()}_${filenamePrefix}.jpg`;

    const { error } = await supabase.storage.from("uploads").upload(filePath, buffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

    if (error) {
      console.warn("[Vision] Supabase upload failed:", error);
      return null;
    }

    const { data } = supabase.storage.from("uploads").getPublicUrl(filePath);
    return data?.publicUrl || null;
  } catch (err) {
    console.warn("[Vision] Storage upload error:", err);
    return null;
  }
}

/**
 * High-precision document & image analysis with Gemini Vision for school operations.
 * Recognizes receipts, invoices, payment slips, medical absence certificates, and flyers.
 */
export async function analyzeTelegramImage(
  photoBuffer: Buffer,
  userCaption?: string
): Promise<DocumentAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("Clé GEMINI_API_KEY manquante");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const base64Photo = photoBuffer.toString("base64");

  const prompt = `Tu es Hnia AI, assistante administrative experte pour les écoles et collèges en Tunisie.
Analyse attentivement cette image/photo envoyée par l'administrateur scolaire.

Contexte ou message éventuel de l'administrateur : "${userCaption || "Aucun message joint"}"

IDENTIFIE LA NATURE EXACTE DU DOCUMENT :
1. "EXPENSE_RECEIPT" : Un ticket de caisse, reçu d'achat, facture STEG/SONEDE, note de restaurant/bistro/café, fournitures scolaires, essence, maintenance, courses, etc.
   - merchant : Nom de l'enseigne / établissement (ex: "The Garden Bistro", "STEG", "Librairie Al-Najah").
   - amount : Montant TOTAL exact en Dinars Tunisiens (DT). Doit être un nombre POSITIF (ex: 33.5, 35, 120). Si le ticket affiche 33.500, c'est 33.5 DT.
   - date : Date lisible sur le ticket (format AAAA-MM-JJ) ou null.
   - category : Une catégorie parmi ['Restauration', 'Fournitures', 'Maintenance', 'Factures', 'Transport', 'Loyer', 'Général'].
   - summary : Brève description en français (ex: "Ticket The Garden Bistro (consommations) de 33.5 DT").
   - suggestedAction : "add_expense"

2. "PAYMENT_RECEIPT" : Un reçu de versement bancaire, virement, chèque ou reçu de paiement des frais de scolarité par un parent/élève.
   - studentName : Nom de l'élève si visible.
   - parentName : Nom du parent si visible.
   - amount : Montant versé en DT.
   - date : Date de versement.
   - summary : Description du paiement.
   - suggestedAction : "record_payment"

3. "ABSENCE_CERTIFICATE" : Un certificat médical, arrêt maladie, mot du médecin ou des parents pour justifier une absence d'élève.
   - studentName : Nom de l'élève concerné.
   - date : Date de début ou période.
   - summary : Brève description (ex: "Certificat médical pour 3 jours d'arrêt").
   - suggestedAction : "excuse_absence"

4. "ANNOUNCEMENT_FLYER" : Une affiche, visuel d'événement, invitation scolaire, poster de fête ou annonce destinée aux familles.
   - title : Titre de l'événement ou de l'affiche.
   - summary : Brève description du contenu de l'affiche.
   - suggestedAction : "post_announcement"

5. "COURSE_RESOURCE" : Un support de cours, résumé de leçon, fiche de révision, polycopié, document PDF ou support pédagogique pour une classe / matière.
   - title : Titre du cours ou de la ressource.
   - className : Classe ciblée si identifiable (ex: "1A", "3B").
   - subjectName : Matière concernée (ex: "Mathématiques", "Français", "Histoire").
   - summary : Résumé du contenu pédagogique.
   - suggestedAction : "add_resource"

6. "HOMEWORK_ASSIGNMENT" : Une fiche d'exercices, devoir maison, énoncé de travail scolaire ou consignes de devoir avec date limite.
   - title : Titre de la tâche ou des exercices.
   - className : Classe ciblée.
   - subjectName : Matière.
   - date : Date limite de rendu si mentionnée.
   - summary : Consignes ou description des exercices.
   - suggestedAction : "create_assignment"

7. "OTHER" : Autre type d'image ou document ne rentrant pas dans les catégories ci-dessus.
   - title : Titre descriptif.
   - summary : Ce que l'on voit dans l'image.
   - suggestedAction : "none"

RÉPONDS UNIQUEMENT AVEC UN OBJET JSON STRICT respectant cette structure (sans balises markdown extra, sans explications) :
{
  "documentType": "EXPENSE_RECEIPT" | "PAYMENT_RECEIPT" | "ABSENCE_CERTIFICATE" | "ANNOUNCEMENT_FLYER" | "COURSE_RESOURCE" | "HOMEWORK_ASSIGNMENT" | "OTHER",
  "title": "...",
  "summary": "...",
  "amount": 33.5,
  "date": "2026-09-09",
  "category": "Restauration",
  "merchant": "The Garden Bistro",
  "studentName": null,
  "parentName": null,
  "className": null,
  "subjectName": null,
  "suggestedAction": "add_expense"
}`;

  let lastError: any = null;

  for (const modelName of VISION_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" },
      });

      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Photo,
            mimeType: "image/jpeg",
          },
        },
        { text: prompt },
      ]);

      const rawText = result.response.text().trim();
      const cleanJson = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleanJson);

      return {
        documentType: parsed.documentType || "OTHER",
        title: parsed.title || parsed.merchant || "Document",
        summary: parsed.summary || "",
        amount: typeof parsed.amount === "number" ? Math.abs(parsed.amount) : undefined,
        date: parsed.date || undefined,
        category: parsed.category || "Général",
        merchant: parsed.merchant || undefined,
        studentName: parsed.studentName || undefined,
        parentName: parsed.parentName || undefined,
        className: parsed.className || undefined,
        subjectName: parsed.subjectName || undefined,
        suggestedAction: parsed.suggestedAction || "none",
      };
    } catch (err: any) {
      console.warn(`[Vision] Model ${modelName} failed:`, err.message || err);
      lastError = err;
      // Wait briefly before fallback model
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  console.error("[Vision] All vision models failed:", lastError);
  return {
    documentType: "OTHER",
    title: "Document numérisé",
    summary: "Photo reçue de l'administrateur.",
    suggestedAction: "none",
  };
}
