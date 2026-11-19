import { z } from "zod";
import { commitPdfImport } from "@/lib/studentPdfImport/commit";
import { NextRequest, NextResponse } from "next/server";
import { getStudentAdminSchool } from "@/lib/studentProfile";
import { extractStudentPdf } from "@/lib/studentPdfImport/extract";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    const schoolId = await getStudentAdminSchool();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 4_000_000 || file.size === 0) throw new Error("PDF required, maximum 4 MB.");
    const pdf = Buffer.from(await file.arrayBuffer());
    if (pdf.subarray(0, 5).toString() !== "%PDF-") throw new Error("Invalid PDF.");
    const extraction = await extractStudentPdf(pdf);
    if (form.get("action") === "commit") {
      if (form.get("confirmed") !== "true" || Number(form.get("expectedCount")) !== extraction.rows.length) throw new Error("Confirmez la revue et le nombre exact d’élèves.");
      const birthdays = z.record(z.string(), z.string()).parse(JSON.parse(String(form.get("birthdays") || "{}")));
      const result = await commitPdfImport(schoolId, extraction, birthdays);
      return NextResponse.json({ result }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ extraction }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
