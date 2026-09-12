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

  // 2. Call Gemini with audio multimodal input
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash",
  });

  const prompt = `Transcribe this voice audio accurately word-for-word.
The speaker may speak in Tunisian Arabic (Derja / Tounsi), Modern Standard Arabic, French, English, or code-switch between them.
Return ONLY the raw transcribed text. Do NOT include any explanations, translations, intros, quotation marks, or meta-comments. Just the exact words spoken.`;

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
}
