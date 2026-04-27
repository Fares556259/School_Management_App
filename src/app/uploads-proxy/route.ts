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
    const filename = searchParams.get("filename") || "document.pdf";
    const remoteUrl = searchParams.get("url");

    // ── CASE 1: PROXY REMOTE URL ─────────────────────────────────────────────
    if (remoteUrl) {
      console.log(`[FILE-PROXY] Proxying remote URL: ${remoteUrl}`);
      
      try {
        // Simple security check: Ensure it's the known Supabase storage provider
        const isAllowedHost = remoteUrl.includes("supabase.co") || remoteUrl.includes("localhost") || remoteUrl.includes("127.0.0.1");

        if (!isAllowedHost) {
          console.warn(`[FILE-PROXY-SECURITY] Blocked request to untrusted host: ${remoteUrl}`);
          // We return a 403 for untrusted hosts to protect the server
          return new NextResponse(`Access to this host is not allowed via proxy: ${new URL(remoteUrl).hostname}`, { status: 403 });
        }

        let response;
        let lastError;
        const MAX_RETRIES = 3;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            console.log(`[FILE-PROXY] Attempt ${attempt} to fetch: ${remoteUrl}`);
            response = await fetch(remoteUrl);
            if (response.ok) break;
            lastError = new Error(`Remote server responded with ${response.status}`);
          } catch (err: any) {
            lastError = err;
          }
          
          if (attempt < MAX_RETRIES) {
             console.log(`[FILE-PROXY] Attempt ${attempt} failed. Retrying in 500ms...`);
             await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        if (!response || !response.ok) {
          throw lastError || new Error("Failed after multiple attempts");
        }

        const blob = await response.blob();
        const contentType = response.headers.get("Content-Type") || "application/pdf";
        const contentDisposition = response.headers.get("Content-Disposition") || `attachment; filename="${filename}"`;

        return new NextResponse(blob, {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": contentDisposition,
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch (fetchErr: any) {
        const urlObj = new URL(remoteUrl);
        console.error(`[FILE-PROXY-FETCH-ERROR] ${fetchErr.message} for URL: ${remoteUrl}`);
        return new NextResponse(`Failed to fetch remote file (${urlObj.hostname}): ${fetchErr.message}. URL was: ${remoteUrl}`, { status: 502 });
      }
    }

    // ── CASE 2: LOCAL FILE LOOKUP ────────────────────────────────────────────
    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), "public", "uploads", safeFilename);

    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeFilename}"`,
        },
      });
    }

    // ── CASE 3: FALLBACK DUMMY ───────────────────────────────────────────────
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
