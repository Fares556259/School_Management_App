/**
 * Helper to build comprehensive multi-word name and phone search conditions
 * for Prisma queries across Student, Parent, Teacher, and Staff models.
 *
 * Handles:
 * - Single names ("Fares", "Selmi")
 * - Full names ("Fares Selmi", "fares test")
 * - Inverted names ("Selmi Fares")
 * - Multi-part names ("Mohamed Ali Ben Amor")
 * - Phone numbers with spaces or dashes ("12 345 678", "123456789")
 */
export function buildNameSearchConditions(query: string) {
  const q = query.trim();
  if (!q) return [];

  const cleanPhone = q.replace(/[\s\-\.]/g, "");
  const words = q.split(/\s+/).filter(Boolean);

  const orConditions: any[] = [
    { name: { contains: q, mode: "insensitive" } },
    { surname: { contains: q, mode: "insensitive" } },
  ];

  if (cleanPhone.length >= 3 && /^\+?\d+$/.test(cleanPhone)) {
    orConditions.push({ phone: { contains: cleanPhone } });
  }

  if (words.length >= 2) {
    // Matches if every single word is present in either name or surname
    orConditions.push({
      AND: words.map((w) => ({
        OR: [
          { name: { contains: w, mode: "insensitive" } },
          { surname: { contains: w, mode: "insensitive" } },
        ],
      })),
    });

    // Explicit first-word / rest-words split (e.g. name="fares", surname="selmi")
    const firstPart = words[0];
    const restPart = words.slice(1).join(" ");
    orConditions.push({
      AND: [
        { name: { contains: firstPart, mode: "insensitive" } },
        { surname: { contains: restPart, mode: "insensitive" } },
      ],
    });

    // Inverted split (e.g. surname first: name="selmi", surname="fares")
    orConditions.push({
      AND: [
        { name: { contains: restPart, mode: "insensitive" } },
        { surname: { contains: firstPart, mode: "insensitive" } },
      ],
    });
  }

  return orConditions;
}
