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
  const CANDIDATE_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-flash-latest",
  ];

  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = `Transcribe this voice audio accurately word-for-word.
The speaker may speak in Tunisian Arabic (Derja / Tounsi), Modern Standard Arabic, French, English, or code-switch between them.
Return ONLY the raw transcribed text. Do NOT include any explanations, translations, intros, quotation marks, or meta-comments. Just the exact words spoken.`;

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
    }
  }

  throw lastError || new Error("Voice transcription failed across all candidate models");
}
