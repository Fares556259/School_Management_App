import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string || "profile";
    const id = formData.get("id") as string;

    if (!file) {
      return new NextResponse("No file uploaded", { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const fileName = `${type}-${id || 'unknown'}-${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const filePath = `notices/${type}s/${fileName}`; 

    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(filePath, file);

    if (error) {
      console.error("Supabase Storage Error:", error);
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('uploads')
      .getPublicUrl(filePath);

    return NextResponse.json({ url: publicUrl });
  } catch (error: any) {
    console.error("[Mobile Upload Error]", error);
    return new NextResponse(error.message || "Upload failed", { status: 500 });
  }
}
