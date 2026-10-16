export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { checkPersistentRateLimit } from "@/lib/mobileRateLimit";
import { normalizeParentPhone, parentPhoneCandidates, submitAccessRequest } from "@/lib/parentAccess";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { 
  generateToken, 
  checkRateLimit, 
  generateAndStoreOTP, 
  verifyOTP,
  verifyStudentClaimToken,
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

    // === ADMIN AUTHENTICATION (via Supabase Auth) ===
    if (role === "admin") {
      if (!phone || !password) {
        return NextResponse.json({ success: false, error: "Email and password required" }, { status: 400 });
      }
      
      if (action && action !== "signin") {
        return NextResponse.json({ success: false, error: "Only signin action is supported for admin" }, { status: 400 });
      }
      
      // Authenticate via Supabase Auth (admins use email + password)
      const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email: phone, // 'phone' field is reused for email input from mobile
        password,
      });
      
      if (authError || !authData.user) {
        console.error("[Admin Auth] Supabase error:", authError?.message);
        return NextResponse.json({ success: false, error: "Identifiants invalides" }, { status: 401 });
      }
      
      // Fetch admin record from Prisma
      const admin = await prisma.admin.findUnique({
        where: { id: authData.user.id },
        include: { School: true },
      });
      
      if (!admin) {
        return NextResponse.json({ success: false, error: "Compte administrateur introuvable" }, { status: 404 });
      }
      
      if (admin.status !== "active") {
        return NextResponse.json({ success: false, error: "Compte non activé" }, { status: 403 });
      }
      
      // Generate mobile JWT token for admin
      const token = generateToken({
        userId: admin.id,
        userType: "admin" as const,
        schoolId: admin.schoolId,
      });
      
      const fullName = [admin.name, admin.surname].filter(Boolean).join(" ") || admin.username;
      
      return NextResponse.json({
        success: true,
        token,
        userId: admin.id,
        userType: "admin",
        schoolId: admin.schoolId,
        name: fullName,
        img: admin.img || null,
        schoolName: admin.School?.name || "SnapSchool",
      });
    }

    // === PARENT SIGNUP (Claim Student / Self-Registration) ===
    if (action === "signup") {
      const parentName = typeof body.parentName === "string" ? body.parentName.trim() : "";
      const parentSurname = typeof body.parentSurname === "string" ? body.parentSurname.trim() : "";
      const cleanPhone = typeof phone === "string" ? normalizeParentPhone(phone) : "";
      const claimTokens = Array.isArray(body.claimTokens) ? body.claimTokens.slice(0, 9) : [];
      const claims: Array<ReturnType<typeof verifyStudentClaimToken>> = claimTokens.map((value: unknown) =>
        typeof value === "string" ? verifyStudentClaimToken(value) : null
      );

      if (!parentName || !parentSurname || !cleanPhone || typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72 ||
          claims.length === 0 || claims.length > 8 || !/^[0-9]{8,15}$/.test(cleanPhone) || claims.some((claim: unknown) => !claim)) {
        return NextResponse.json({
          success: false,
          error: "Informations d'inscription invalides ou expirées. Recommencez la vérification.",
        }, { status: 400 });
      }

      const verifiedClaims = claims.filter((claim): claim is NonNullable<ReturnType<typeof verifyStudentClaimToken>> => Boolean(claim));
      const signupSchoolId = verifiedClaims[0].schoolId;
      if (verifiedClaims.some(claim => claim.schoolId !== signupSchoolId)) {
        return NextResponse.json({ success: false, error: "Tous les enfants doivent appartenir au même établissement." }, { status: 400 });
      }
      const studentIds = Array.from(new Set(verifiedClaims.map(claim => claim.studentId)));

      if (body.approvalFlowVersion !== 1) return NextResponse.json({ success: false, code: 'APP_UPDATE_REQUIRED', error: 'Mettez à jour l’application pour envoyer une demande à votre école.' }, { status: 426 });
      const rate = await checkPersistentRateLimit(ip, 'parent-signup', 5);
      if (!rate.success) return NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429 });
      const locale = ['fr', 'ar', 'en'].includes(body.locale) ? body.locale : 'fr';
      const relation = ['father', 'mother', 'guardian'].includes(body.relation) ? body.relation : 'guardian';
      const passwordHash = await bcrypt.hash(password, 12);
      try {
        const result = await prisma.$transaction(async tx => {
          const existingParent = await tx.parent.findFirst({
            where: { OR: parentPhoneCandidates(cleanPhone).flatMap(value => [{ phone: value }, { username: value }]) },
            select: { id: true },
          });
          if (existingParent) throw new Error("PARENT_EXISTS");

          const availableStudents = await tx.student.findMany({
            where: { id: { in: studentIds }, schoolId: signupSchoolId },
            select: { id: true },
          });
          if (availableStudents.length !== studentIds.length) throw new Error("STUDENT_UNAVAILABLE");

          const parent = await tx.parent.create({
            data: {
              id: randomUUID(),
              username: cleanPhone,
              name: parentName,
              surname: parentSurname,
              phone: cleanPhone,
              password: passwordHash,
              accessStatus: "PENDING",
              preferredLocale: locale,
              address: typeof body.address === "string" && body.address.trim() ? body.address.trim() : "Non renseignée",
              schoolId: signupSchoolId,
            },
          });
          for (const studentId of studentIds) {
            await submitAccessRequest(tx, parent.id, signupSchoolId, studentId, relation);
          }
          const students: never[] = [];
          return { parent, students };
        });

        return NextResponse.json({
          success: true,
          accessStatus: "PENDING",
          pendingApproval: true,
          token: generateToken({ userId: result.parent.id, userType: "parent", schoolId: signupSchoolId }),
          userId: result.parent.id,
          userType: "parent",
          schoolId: signupSchoolId,
          name: `${result.parent.name} ${result.parent.surname}`,
          img: result.parent.img || null,
          students: result.students,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "PARENT_EXISTS") {
          return NextResponse.json({ success: false, code: "PARENT_EXISTS", error: "Un compte existe déjà avec ce numéro. Connectez-vous ou contactez l'établissement." }, { status: 409 });
        }
        if (error instanceof Error && error.message === "STUDENT_UNAVAILABLE") {
          return NextResponse.json({ success: false, code: "STUDENT_ALREADY_LINKED", error: "Un élève est déjà rattaché à un compte parent. Contactez l'établissement." }, { status: 409 });
        }
        throw error;
      }
    }

    let user: any = null;
    let userType: "parent" | "teacher" | "admin" = role === "teacher" ? "teacher" : role === "admin" ? "admin" : "parent";

    if (action === 'signin') {
      const rate = await checkPersistentRateLimit(ip, 'parent-signin', 10);
      if (!rate.success) return NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429 });
    }
    const loginPhone = userType === 'parent' ? normalizeParentPhone(phone) : phone.trim();
    if (userType === "parent") {
      user = await prisma.parent.findFirst({
        where: {
          OR: parentPhoneCandidates(loginPhone).flatMap(value => [{ phone: value }, { username: value }]),
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
          OR: [{ phone: loginPhone }, { username: loginPhone }],
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
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ success: false, error: "SMS verification is not configured. Contact your school administrator." }, { status: 503 });
      }
      const code = generateAndStoreOTP(phone);
      return NextResponse.json({
        success: true,
        otpSent: true,
        message: `Verification code sent to ${phone.trim()}`,
        // Note: For demo/dev convenience, we return demoCode in response log
        demoCode: code,
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
      if (process.env.NODE_ENV === "production" || otpCode) {
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

    if (userType === 'parent' && user.accessStatus !== 'ACTIVE' && body.approvalFlowVersion !== 1) {
      return NextResponse.json({ success: false, code: 'APP_UPDATE_REQUIRED', error: 'Mettez à jour l’application pour suivre l’approbation de votre compte.' }, { status: 426 });
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
      accessStatus: userType === "parent" ? user.accessStatus : "ACTIVE",
      students: userType === "parent" && user.accessStatus === "ACTIVE" ? user.students : [],
    });
  } catch (error: any) {
    console.error("[Mobile Auth Error]", error);
    return new NextResponse(JSON.stringify({ success: false, error: "Impossible de traiter la demande. Réessayez dans quelques instants." }), {
      status: 500,
    });
  }
}
