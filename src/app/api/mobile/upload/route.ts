export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf",
]);
const ALLOWED_TYPES: Record<string, Set<string>> = {
  parent: new Set(["profile", "student"]),
  teacher: new Set(["profile", "resource", "grade"]),
  admin: new Set(["profile", "caisse", "receipt", "expense"]),
};

export async function POST(request: NextRequest) {
  const auth = await authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Upload service unavailable" }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const type = (formData.get("type") as string) || "profile";
    const { userId, userType, schoolId } = auth.payload;
    if (!ALLOWED_TYPES[userType]?.has(type)) {
      return NextResponse.json({ error: "Upload type not allowed" }, { status: 403 });
    }

    // Support both multiple "files" and single "file"
    const files = formData.getAll("files") as File[];
    const singleFile = formData.get("file") as File | null;
    const allFiles: File[] = files.length > 0 ? files : (singleFile ? [singleFile] : []);

    if (allFiles.length === 0) {
      return new NextResponse(JSON.stringify({ error: "No file uploaded" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (allFiles.length > MAX_FILES) {
      return NextResponse.json({ error: `A maximum of ${MAX_FILES} files is allowed` }, { status: 413 });
    }
    for (const file of allFiles) {
      if (!ALLOWED_MIME_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "Only PDF, JPEG, PNG, WEBP, HEIC or HEIF files up to 15 MB are allowed" }, { status: 415 });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const uploadPromises = allFiles.map(async (file, index) => {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const fileName = `${type}-${Date.now()}-${index}-${randomSuffix}-${sanitizedName}`;
      const filePath = `mobile/${schoolId}/${userType}/${userId}/${type}/${fileName}`;

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
