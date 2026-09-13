import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawPhone =
    searchParams.get("p") ||
    searchParams.get("phone") ||
    searchParams.get("tel") ||
    searchParams.get("num") ||
    "";

  const digits = rawPhone.replace(/\D/g, "");

  if (!digits) {
    return new NextResponse("Numéro manquant", { status: 400 });
  }

  let cleanNumber: string;
  let displayNumber: string;

  if (rawPhone.trim().startsWith("+")) {
    cleanNumber = `+${digits}`;
    displayNumber = cleanNumber;
  } else if (digits.startsWith("00216")) {
    cleanNumber = `+${digits.slice(2)}`;
    displayNumber = cleanNumber;
  } else if (digits.startsWith("216") && digits.length > 8) {
    cleanNumber = `+${digits}`;
    displayNumber = cleanNumber;
  } else if (digits.length === 8) {
    cleanNumber = `+216${digits}`;
    displayNumber = `+216 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  } else {
    cleanNumber = digits;
    displayNumber = digits;
  }

  const telUrl = `tel:${cleanNumber}`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Appel ${displayNumber} - SnapSchool</title>
  <meta http-equiv="refresh" content="0;url=${telUrl}">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      padding: 36px 28px;
      border-radius: 24px;
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.08);
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    .icon-box {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      background: #ecfdf5;
      color: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 38px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .number {
      font-size: 20px;
      font-weight: 600;
      color: #2563eb;
      margin-bottom: 12px;
      letter-spacing: 0.5px;
    }
    p {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 28px;
      line-height: 1.5;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      background: #10b981;
      color: #ffffff;
      font-size: 17px;
      font-weight: 600;
      padding: 16px 24px;
      border-radius: 16px;
      text-decoration: none;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
      transition: all 0.2s ease;
    }
    .btn:active {
      transform: scale(0.98);
      background: #059669;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-box">📞</div>
    <h1>Appel Téléphonique</h1>
    <div class="number">${displayNumber}</div>
    <p>Ouverture de votre application Téléphone...</p>
    <a href="${telUrl}" class="btn" id="callLink">
      <span>📞</span>
      <span>Appeler le parent</span>
    </a>
  </div>
  <script>
    window.location.href = "${telUrl}";
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 307,
    headers: {
      Location: telUrl,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
