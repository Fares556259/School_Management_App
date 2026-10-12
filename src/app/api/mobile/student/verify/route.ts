import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Public student claiming is intentionally disabled. Student relationships are
 * created by the school and additional children can only be linked from an
 * authenticated parent session through /api/mobile/students.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "L'inscription libre est désactivée. Connectez-vous avec le compte fourni par votre établissement.",
    },
    { status: 410 }
  );
}
