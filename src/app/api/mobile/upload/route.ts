export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const type = (formData.get("type") as string) || "profile";
    const id = (formData.get("id") as string) || "unknown";

    // Support both multiple "files" and single "file"
    const files = formData.getAll("files") as File[];
    const singleFile = formData.get("file") as File | null;
    const allFiles: File[] = files.length > 0 ? files : (singleFile ? [singleFile] : []);

    if (allFiles.length === 0) {
      return new NextResponse(JSON.stringify({ error: "No file uploaded" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const uploadPromises = allFiles.map(async (file, index) => {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const fileName = `${type}-${id}-${Date.now()}-${randomSuffix}-${sanitizedName}`;
      const filePath = `notices/${type}s/${fileName}`;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const { data, error } = await supabase.storage.from("uploads").upload(filePath, buffer, {
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

      return publicUrl;
    });

    const urls = await Promise.all(uploadPromises);

    return NextResponse.json({
      url: urls.join(','),
      urls,
      success: true
    });
  } catch (error: any) {
    console.error("[Mobile Upload Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message || "Upload failed" }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
