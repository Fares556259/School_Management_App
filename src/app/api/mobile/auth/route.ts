export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { 
  generateToken, 
  checkRateLimit, 
  generateAndStoreOTP, 
  verifyOTP 
} from "@/lib/mobileAuth";

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting check (5 attempts per minute per IP)
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const rateCheck = checkRateLimit(ip, "auth");
    if (!rateCheck.success) {
      return NextResponse.json(
        { success: false, error: `Too many authentication attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { phone, password, otpCode, action, schoolId, role } = body;

    if (!phone || !action) {
      return NextResponse.json(
        { success: false, error: "Phone and action are required" },
        { status: 400 }
      );
    }

    let user: any = null;
    let userType: "parent" | "teacher" = role === "teacher" ? "teacher" : "parent";

    if (userType === "parent") {
      user = await prisma.parent.findFirst({
        where: {
          OR: [{ phone: phone.trim() }, { username: phone.trim() }],
        },
        orderBy: { id: "asc" },
        include: {
          students: {
            include: { 
              class: {
                include: {
                  level: true,
                },
              },
              payments: true,
            },
          },
        },
      });
    } else if (userType === "teacher") {
      user = await prisma.teacher.findFirst({
        where: {
          OR: [{ phone: phone.trim() }, { username: phone.trim() }],
        },
        orderBy: { id: "asc" },
      });
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "No account found with this phone number." },
        { status: 404 }
      );
    }

    // ─── ACTION: SEND OTP ──────────────────────────────────────────────────
    if (action === "send_otp" || action === "forgot_password") {
      const code = generateAndStoreOTP(phone);
      return NextResponse.json({
        success: true,
        otpSent: true,
        message: `Verification code sent to ${phone.trim()}`,
        // Note: For demo/dev convenience, we return demoCode in response log
        demoCode: process.env.NODE_ENV !== "production" ? code : undefined,
      });
    }

    // ─── ACTION: VERIFY OTP ────────────────────────────────────────────────
    if (action === "verify_otp") {
      if (!otpCode) {
        return NextResponse.json({ success: false, error: "Verification code is required" }, { status: 400 });
      }
      const isValid = verifyOTP(phone, otpCode);
      if (!isValid) {
        return NextResponse.json({ success: false, error: "Invalid or expired verification code." }, { status: 400 });
      }
      return NextResponse.json({ success: true, verified: true });
    }

    // ─── ACTION: ACCOUNT SETUP ──────────────────────────────────────────────
    if (action === "setup") {
      if (user.password) {
        return NextResponse.json(
          { success: false, error: "This account already has a password set. Please log in." },
          { status: 400 }
        );
      }
      if (!password || password.length < 6) {
        return NextResponse.json(
          { success: false, error: "Password must be at least 6 characters long." },
          { status: 400 }
        );
      }
      // Require OTP verification if otpCode is provided
      if (otpCode) {
        const isValid = verifyOTP(phone, otpCode);
        if (!isValid) {
          return NextResponse.json({ success: false, error: "Invalid or expired OTP code." }, { status: 400 });
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      if (userType === "parent") {
        await prisma.parent.update({
          where: { id: user.id },
          data: { password: hashedPassword },
        });
      } else {
        await prisma.teacher.update({
          where: { id: user.id },
          data: { password: hashedPassword, activated: true },
        });
      }
    } 

    // ─── ACTION: RESET PASSWORD ─────────────────────────────────────────────
    else if (action === "reset_password") {
      if (!password || password.length < 6) {
        return NextResponse.json(
          { success: false, error: "New password must be at least 6 characters long." },
          { status: 400 }
        );
      }
      if (!otpCode || !verifyOTP(phone, otpCode)) {
        return NextResponse.json(
          { success: false, error: "Invalid or expired verification code." },
          { status: 400 }
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      if (userType === "parent") {
        await prisma.parent.update({
          where: { id: user.id },
          data: { password: hashedPassword },
        });
      } else {
        await prisma.teacher.update({
          where: { id: user.id },
          data: { password: hashedPassword },
        });
      }
    }

    // ─── ACTION: SIGN IN ───────────────────────────────────────────────────
    else if (action === "signin") {
      if (!user.password) {
        return NextResponse.json(
          {
            success: false,
            error: "Password not set. Please set up your account first.",
          },
          { status: 400 }
        );
      }
      if (!password) {
        return NextResponse.json(
          { success: false, error: "Password is required" },
          { status: 400 }
        );
      }
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: "Incorrect password. Please try again." },
          { status: 401 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid action request." },
        { status: 400 }
      );
    }

    // ─── SUCCESS: ISSUE SIGNED JWT TOKEN & RETURN SESSION ──────────────────
    const token = generateToken({
      userId: user.id,
      userType,
      schoolId: user.schoolId || "default_school",
    });

    console.log(`[JWT ISSUED] User: ${user.name} ${user.surname} (${userType}:${user.id})`);

    return NextResponse.json({
      success: true,
      token, // Signed JWT Token (valid 30 days)
      userId: user.id,
      userType,
      schoolId: user.schoolId || "default_school",
      name: `${user.name} ${user.surname}`,
      img: user.img,
      students: userType === "parent" ? user.students : [],
    });
  } catch (error: any) {
    console.error("[Mobile Auth Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
