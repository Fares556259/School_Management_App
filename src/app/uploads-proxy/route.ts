import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * Public file proxy for mobile app.
 * Allows downloading files from the public/uploads directory without Clerk authentication.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");

    if (!filename) {
      return new NextResponse("Missing filename", { status: 400 });
    }

    // Security: Prevent path traversal
    const safeFilename = path.basename(filename);
    
    // Check locally in public/uploads first
    const filePath = path.join(process.cwd(), "public", "uploads", safeFilename);
    const dummyPath = path.join(process.cwd(), "public", "dummy.pdf");

    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeFilename}"`,
        },
      });
    }

    // Fallback: If it's a specific dummy request or file not found, return a dummy if it exists
    // or proxy to a well-known public PDF
    const fallbackUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
    console.log(`[FILE-PROXY] File not found local: ${safeFilename}. Proxying to fallback.`);
    
    const response = await fetch(fallbackUrl);
    const blob = await response.blob();
    
    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
      },
    });

  } catch (error: any) {
    console.error("[FILE-PROXY-ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
