import { callGeminiDirect } from "@/app/(dashboard)/admin/actions/aiActions";

export async function generateSmartInsights(aggregatedData: any) {
  try {
    const prompt = `
      You are an expert school administrator. Analyze the following daily aggregated data for the school and provide 2-3 short, actionable, and smart insights.
      Provide the output as a simple JSON array of strings. Do not include markdown formatting.
      
      Data:
      ${JSON.stringify(aggregatedData, null, 2)}
      
      Example output format:
      ["Insight 1", "Insight 2", "Insight 3"]
    `;

    const textResult = await callGeminiDirect(prompt);
    
    try {
      const parsed = JSON.parse(textResult.trim());
      if (Array.isArray(parsed)) return parsed;
      if (parsed.insights && Array.isArray(parsed.insights)) return parsed.insights;
      return ["Insights generated but in incorrect format."];
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", textResult);
      // Fallback regex attempt without /s flag
      const jsonMatch = textResult.match(/\[([\s\S]*)\]/);
      if (jsonMatch) {
         try {
           return JSON.parse("[" + jsonMatch[1] + "]");
         } catch(e) {
           return ["Unable to parse AI insights from text fallback."];
         }
      }
      return ["Unable to parse AI insights from text."];
    }
  } catch (err) {
    console.error("AI Insight Generation Error:", err);
    return [
      "Failed to generate smart insights due to an error. Check server console.",
    ];
  }
}
