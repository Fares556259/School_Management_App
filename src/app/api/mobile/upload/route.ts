export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export async function POST(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = (formData.get("type") as string) || "profile";
    const id = formData.get("id") as string;

    if (!file) {
      return new NextResponse(JSON.stringify({ error: "No file uploaded" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `${type}-${id || "unknown"}-${Date.now()}-${sanitizedName}`;
    const filePath = `notices/${type}s/${fileName}`;

    const { data, error } = await supabase.storage.from("uploads").upload(filePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: true
    });

    if (error) {
      console.error("Supabase Storage Error:", error);
      throw error;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("uploads").getPublicUrl(filePath);

    return NextResponse.json({ url: publicUrl });
  } catch (error: any) {
    console.error("[Mobile Upload Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message || "Upload failed" }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
