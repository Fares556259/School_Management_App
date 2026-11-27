// Normalize for search only. The roster keeps and displays the original names.
export function studentListSearchKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\p{M}\p{Bidi_Control}\u0640]/gu, "")
    .replace(/ٱ/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
