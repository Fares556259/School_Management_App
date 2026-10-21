export function cleanTelegramFormattingForMobile(text: string): string {
  if (!text) return "";
  let clean = text;
  // Replace HTML entities
  clean = clean
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  // Strip separator bars
  clean = clean.replace(/[━─═-]{4,}/g, "");
  // Move colons outside bold tags so key-value splitting does not break formatting:
  // e.g. <b>Montant :</b> -> <b>Montant</b> :
  clean = clean.replace(/<b(?: [^>]*)?>([^<:]+)\s*:\s*<\/b>/gi, "<b>$1</b> :");
  // Convert HTML bold to markdown bold
  clean = clean.replace(/<\/?(?:b|strong)>/gi, "**");
  // Fix markdown bold containing colons: **Montant :** -> **Montant** :
  clean = clean.replace(/\*\*([^*\n:]+)\s*:\s*\*\*/g, "**$1** :");
  // Convert HTML italic to markdown italic
  clean = clean.replace(/<\/?(?:i|em)>/gi, "*");
  // Convert <code>...</code> to markdown backticks `...`
  clean = clean.replace(/<code>(.*?)<\/code>/gi, "`$1`");
  clean = clean.replace(/<\/?code>/gi, "");
  // Convert blockquote to markdown blockquote
  clean = clean.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, "> $1\n");
  // Strip remaining HTML tags
  clean = clean.replace(/<[^>]+>/g, "");
  // Fix mismatched asterisks like *Word** -> **Word** or **Word* -> **Word**
  clean = clean.replace(/(^|\s)\*([^*\s][^*]*?)\*\*(?=\s|$|[.,!?;:])/g, "$1**$2**");
  clean = clean.replace(/(^|\s)\*\*([^*\s][^*]*?)\*(?=\s|$|[.,!?;:])/g, "$1**$2**");
  // Clean redundant whitespace
  clean = clean.replace(/\n{3,}/g, "\n\n").trim();
  return clean;
}

