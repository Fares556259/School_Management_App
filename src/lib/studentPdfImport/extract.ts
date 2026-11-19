import { createHash, createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { extractionSchema } from "./schema";

export async function extractStudentPdf(pdf: Buffer) {
  return extractionSchema.parse(JSON.parse(await runPdf(pdf)));
}
export async function renderStudentPdfPage(pdf: Buffer, page: number) { return (await runPdf(pdf, page)).trim(); }
async function runPdf(pdf: Buffer, page?: number) {
  if (process.env.VERCEL) {
    const host = process.env.VERCEL_ENV === "production" ? "www.snapschool.academy" : process.env.VERCEL_URL;
    const secret = process.env.JWT_SECRET;
    if (!host || !secret) throw new Error("Le service PDF est temporairement indisponible.");
    const stamp = String(Math.floor(Date.now() / 1000));
    const pageValue = page ? String(page) : "";
    const digest = createHash("sha256").update(pdf).digest("hex");
    const signature = createHmac("sha256", secret).update(`pdf-worker-v1:${stamp}:${pageValue}:${digest}`).digest("hex");
    const headers: Record<string, string> = { "Content-Type": "application/pdf", "X-Pdf-Time": stamp, "X-Pdf-Page": pageValue, "X-Pdf-Signature": signature };
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers["x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const response = await fetch(`https://${host}/api/student_pdf`, { method: "POST", headers, body: new Uint8Array(pdf), signal: AbortSignal.timeout(55000), cache: "no-store" });
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Le service PDF est temporairement indisponible. Aucun élève enregistré.");
    const result = await response.json();
    return page ? result.image : JSON.stringify(result.extraction);
  }
  const python = process.env.STUDENT_PDF_PYTHON || path.join(process.cwd(), "tmp/pdf-import-venv/bin/python3");
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(python, [path.join(process.cwd(), "services/student-pdf-import/extract.py"), ...(page ? [String(page)] : [])], { stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = []; let size = 0;
    const timer = setTimeout(() => { child.kill(); reject(new Error("PDF extraction timed out")); }, 45000);
    child.stdout.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 8_000_000) { child.kill(); reject(new Error("PDF output too large")); } else chunks.push(chunk); });
    child.stderr.resume();
    child.on("error", () => { clearTimeout(timer); reject(new Error("Configure STUDENT_PDF_PYTHON with a Python environment containing PyMuPDF 1.26.7.")); });
    child.on("close", code => { clearTimeout(timer); code === 0 ? resolve(Buffer.concat(chunks).toString("utf8")) : reject(new Error("PDF layout unsupported or extraction failed. No records saved.")); });
    child.stdin.on("error", () => {});
    child.stdin.end(pdf);
  });
  return output;
}
