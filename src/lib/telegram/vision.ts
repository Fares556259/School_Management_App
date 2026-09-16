import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

export interface DocumentAnalysisResult {
  documentType:
    | "EXPENSE_RECEIPT"
    | "PAYMENT_RECEIPT"
    | "BANK_CHEQUE"
    | "ATTENDANCE_SHEET"
    | "ABSENCE_CERTIFICATE"
    | "ANNOUNCEMENT_FLYER"
    | "COURSE_RESOURCE"
    | "HOMEWORK_ASSIGNMENT"
    | "GRADES_SHEET"
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
  bankName?: string;
  chequeNumber?: string;
  absentStudents?: string[];
  lateStudents?: string[];
  sessionName?: string;
  term?: number;
  gradesList?: Array<{ studentName: string; score: number }>;
  suggestedAction?:
    | "add_expense"
    | "record_payment"
    | "mark_class_attendance"
    | "excuse_absence"
    | "post_announcement"
    | "add_resource"
    | "create_assignment"
    | "record_class_grades"
    | "none";
  publicUrl?: string;
}

const VISION_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
];

/**
 * Uploads an image buffer to Supabase Storage in the 'uploads' bucket.
 * Returns the permanent public URL.
 */
export async function uploadTelegramPhotoToStorage(
  buffer: Buffer,
  schoolId: string,
  filenamePrefix: string = "doc",
  contentType: string = "image/jpeg"
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
    let ext = "jpg";
    if (contentType.includes("pdf")) ext = "pdf";
    else if (contentType.includes("png")) ext = "png";
    else if (contentType.includes("word") || contentType.includes("officedocument") || contentType.includes("docx")) ext = "docx";
    else if (contentType.includes("excel") || contentType.includes("sheet")) ext = "xlsx";

    const filePath = `documents/telegram/${sanitizedSchool}/${Date.now()}_${filenamePrefix}.${ext}`;

    const { error } = await supabase.storage.from("uploads").upload(filePath, buffer, {
      contentType,
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
1. "EXPENSE_RECEIPT" : Un ticket de caisse, reçu d'achat, facture STEG (électricité/gaz), facture SONEDE (eau), télécom (Tunisie Telecom, Ooredoo, Orange), note de restaurant/café, fournitures scolaires, carburant/essence (Agil, Total, Shell), maintenance, courses, etc.
   - merchant : Nom de l'enseigne / établissement (ex: "STEG", "SONEDE", "The Garden Bistro", "Librairie Al-Najah", "Station Agil").
   - amount : Montant TOTAL exact en Dinars Tunisiens (DT). Doit être un nombre POSITIF (ex: 33.5, 35, 120, 184.5). Si le ticket affiche 184.500, c'est 184.5 DT.
   - date : Date lisible sur le ticket (format AAAA-MM-JJ) ou null.
   - category : Une catégorie parmi ['Factures', 'Fournitures', 'Transport', 'Maintenance', 'Restauration', 'Loyer', 'Général']. (Si STEG/SONEDE/Télécom, choisis 'Factures').
   - summary : Brève description en français (ex: "Facture STEG d'électricité de 184.5 DT").
   - suggestedAction : "add_expense"

2. "PAYMENT_RECEIPT" : Un reçu de versement bancaire, bordereau de versement espèces, reçu de scolarité ou virement bancaire pour les frais scolaires.
   - studentName : Nom de l'élève si visible.
   - parentName : Nom du parent si visible.
   - amount : Montant versé en DT.
   - date : Date de versement.
   - summary : Description du paiement.
   - suggestedAction : "record_payment"

3. "BANK_CHEQUE" : Un chèque bancaire tunisien (ex: BIAT, Attijari Bank, STB, BNA, Amen Bank, UIB, BH Bank, Banque Zitouna, BT, etc.).
   - bankName : Nom de la banque émettrice (ex: "BIAT", "Attijari Bank", "BNA").
   - chequeNumber : Numéro du chèque visible en haut ou sur la ligne magnétique CMC7 en bas.
   - amount : Montant en chiffres ou en toutes lettres converti en nombre DT.
   - date : Date portée sur le chèque.
   - studentName : Nom de l'élève si annoté au verso ou sur la ligne d'ordre.
   - parentName : Nom du titulaire du compte / tireur du chèque.
   - summary : Description (ex: "Chèque BIAT N°1234567 de 450 DT pour scolarité").
   - suggestedAction : "record_payment"

4. "ATTENDANCE_SHEET" : Une feuille d'appel papier ou registre de présence de classe rempli par un enseignant.
   - className : Nom de la classe identifiée en en-tête (ex: "1A", "3B", "8ème B").
   - sessionName : Matière ou créneau horaire de la séance (ex: "Mathématiques 08:00").
   - absentStudents : Tableau des noms complets d'élèves cochés "Absent" ou marqués d'un "A" / croix.
   - lateStudents : Tableau des noms complets d'élèves marqués "Retard" ou "R".
   - date : Date de la séance (AAAA-MM-JJ).
   - summary : Description (ex: "Feuille d'appel 1A : 2 absents (Youssef, Sarah) et 1 retard").
   - suggestedAction : "mark_class_attendance"

5. "ABSENCE_CERTIFICATE" : Un certificat médical, arrêt maladie, mot du médecin ou des parents pour justifier une absence d'élève.
   - studentName : Nom de l'élève concerné.
   - date : Date de début ou période.
   - summary : Brève description (ex: "Certificat médical du Dr. Ben Salah pour 3 jours d'arrêt").
   - suggestedAction : "excuse_absence"

6. "ANNOUNCEMENT_FLYER" : Une affiche, visuel d'événement, invitation scolaire, poster de fête ou annonce destinée aux familles.
   - title : Titre de l'événement ou de l'affiche.
   - summary : Brève description du contenu de l'affiche.
   - suggestedAction : "post_announcement"

7. "COURSE_RESOURCE" : Un support de cours, résumé de leçon, fiche de révision, polycopié, document PDF ou support pédagogique pour une classe / matière.
   - title : Titre du cours ou de la ressource.
   - className : Classe ciblée si identifiable (ex: "1A", "3B").
   - subjectName : Matière concernée (ex: "Mathématiques", "Français", "Histoire").
   - summary : Résumé du contenu pédagogique.
   - suggestedAction : "add_resource"

8. "HOMEWORK_ASSIGNMENT" : Une fiche d'exercices, devoir maison, énoncé de travail scolaire ou consignes de devoir avec date limite.
   - title : Titre de la tâche ou des exercices.
   - className : Classe ciblée.
   - subjectName : Matière.
    - date : Date limite de rendu si mentionnée.
    - summary : Consignes ou description des exercices.
    - suggestedAction : "create_assignment"

9. "GRADES_SHEET" : Une feuille de notes, relevé de notes manuscrit ou imprimé, liste de classe avec des notes d'examen/contrôle (sur 20) attribuées aux élèves.
    - className : Nom de la classe mentionnée (ex: "1A", "3B", "8ème B").
    - subjectName : Matière indiquée en en-tête (ex: "Mathématiques", "Français", "Anglais", "Physique", "Sciences").
    - term : Trimestre concerné (1, 2 ou 3). Par défaut 1 si non précisé.
    - gradesList : Tableau d'objets [{"studentName": "Nom complet de l'élève", "score": 15.5}, ...] avec pour chaque ligne de la feuille le nom complet et sa note sur 20 (nombre entre 0 et 20).
    - summary : Brève description (ex: "Feuille de notes de Mathématiques pour la classe 1A : 22 élèves notés").
    - suggestedAction : "record_class_grades"

10. "OTHER" : Autre type d'image ou document ne rentrant pas dans les catégories ci-dessus.
    - title : Titre descriptif.
    - summary : Ce que l'on voit dans l'image.
    - suggestedAction : "none"

RÉPONDS UNIQUEMENT AVEC UN OBJET JSON STRICT respectant cette structure (sans balises markdown extra, sans explications) :
{
  "documentType": "EXPENSE_RECEIPT" | "PAYMENT_RECEIPT" | "BANK_CHEQUE" | "ATTENDANCE_SHEET" | "ABSENCE_CERTIFICATE" | "ANNOUNCEMENT_FLYER" | "COURSE_RESOURCE" | "HOMEWORK_ASSIGNMENT" | "GRADES_SHEET" | "OTHER",
  "title": "...",
  "summary": "...",
  "amount": 33.5,
  "date": "2026-09-09",
  "category": "Factures",
  "merchant": "STEG",
  "bankName": null,
  "chequeNumber": null,
  "absentStudents": [],
  "lateStudents": [],
  "sessionName": null,
  "studentName": null,
  "parentName": null,
  "className": null,
  "subjectName": null,
  "term": 1,
  "gradesList": [{"studentName": "Prénom Nom", "score": 15}],
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
        bankName: parsed.bankName || undefined,
        chequeNumber: parsed.chequeNumber || undefined,
        absentStudents: Array.isArray(parsed.absentStudents) ? parsed.absentStudents : undefined,
        lateStudents: Array.isArray(parsed.lateStudents) ? parsed.lateStudents : undefined,
        sessionName: parsed.sessionName || undefined,
        studentName: parsed.studentName || undefined,
        parentName: parsed.parentName || undefined,
        className: parsed.className || undefined,
        subjectName: parsed.subjectName || undefined,
        term: typeof parsed.term === "number" ? parsed.term : undefined,
        gradesList: Array.isArray(parsed.gradesList)
          ? parsed.gradesList
              .map((g: any) => ({
                studentName: String(g.studentName || "").trim(),
                score: Number(g.score),
              }))
              .filter((g: any) => g.studentName && !isNaN(g.score))
          : undefined,
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
