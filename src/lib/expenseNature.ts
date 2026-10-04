export function getExpenseNature(item: { title?: string; category?: string }): "salary" | "advance" | "operation" {
  const cat = (item.category || "").toLowerCase().trim();
  const title = (item.title || "").toLowerCase().trim();

  if (cat === "advance" || cat === "avance" || title.startsWith("advance:") || title.startsWith("avance:") || title.includes("(avance") || title.includes("(advance")) {
    return "advance";
  }
  if (cat === "salary" || cat === "salaire" || title.startsWith("salary:") || title.startsWith("salaire:")) {
    return "salary";
  }
  return "operation";
}
