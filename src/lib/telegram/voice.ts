import { GoogleGenerativeAI } from "@google/generative-ai";
import { getTelegramFile, downloadTelegramFileBuffer } from "./telegram";

/**
 * Transcribe a voice note received from Telegram using Gemini 2.5 Flash.
 * Supports Tunisian Arabic (Darija), Modern Standard Arabic, French, and English.
 */
export async function transcribeTelegramVoice(fileId: string): Promise<string> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("Clé GEMINI_API_KEY manquante dans l'environnement Vercel");
  }

  // 1. Download audio file from Telegram
  const fileInfo = await getTelegramFile(fileId);
  const audioBuffer = await downloadTelegramFileBuffer(fileInfo.file_path);
  const base64Audio = audioBuffer.toString("base64");

  // 2. Call Gemini with audio multimodal input (with multi-model fallback)
  // Use gemini-3.5-flash and gemini-3.6-flash for high acoustic fidelity on North African dialects
  const CANDIDATE_MODELS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
  ];

  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = `You are an expert, high-fidelity audio transcriber specialized in Tunisian school operations and North African multilingual speech.
Transcribe the speaker's exact spoken words word-for-word.

CRITICAL TRANSCRIBING RULES:
1. DIALECT RECOGNITION: The speaker is speaking in Tunisian Arabic (Derja / Tounsi), French, English, or a natural mix of Tunisian Arabic and French (code-switching).
2. DO NOT TRANSLATE: Never translate Tunisian words into French or English. Transcribe in the exact language spoken:
   - If the speaker speaks Tunisian Arabic, transcribe it in authentic Arabic script (e.g. شكون غايب, أعطيني الخلاصات, مريم ما نعرفهاش, قداش فما فلوس...) or accurate phonetic text.
   - If the speaker speaks French, transcribe in French.
   - If mixed (e.g. "les reliquats mta3 el khlassat", "chouf-li l'appel mta3 8ème B"), transcribe both languages faithfully.
3. ZERO HALLUCINATIONS: Do NOT guess, imagine, or invent words that were not said.
4. SCHOOL VOCABULARY: Common terms include: élèves, profs, classes (1A, 2B, 7ème, 8ème, 9ème...), matières, notes, absences, retards, paiements, reliquats, impayés, factures, STEG, SONEDE, Dinars / DT, cantine.
5. OUTPUT: Output ONLY the exact transcribed text. No quotes, no markdown explanations, no introductions.`;

  let lastError: any = null;
  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Audio,
            mimeType: "audio/ogg",
          },
        },
        { text: prompt },
      ]);
      const transcription = result.response.text().trim();
      return transcription;
    } catch (err: any) {
      console.warn(`[Voice] Transcription failed with model ${modelName}:`, err.message || err);
      lastError = err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  throw lastError || new Error("Voice transcription failed across all candidate models");
}
