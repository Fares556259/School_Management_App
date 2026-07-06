import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const userId = currentUser?.id;
    
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { schoolName, phoneNumber, city } = await req.json();
    if (!schoolName) {
      return new NextResponse("School Name is required", { status: 400 });
    }

    // Fetch user details
    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!user || error) {
      return new NextResponse("User not found", { status: 404 });
    }

    const email = user.email;

    // PROTECTION: Do not overwrite the role if they are already a superadmin
    const currentRole = user.user_metadata?.role as string;
    if (currentRole === "superadmin") {
      return NextResponse.json({ success: true, message: "Superadmin profile detected. Skipping sync to prevent downgrade." });
    }

    // INTEL: Check if they are already active
    const authStatus = user.user_metadata?.status as string;
    const dbAdminStatus = authStatus === "active" ? "active" : "pending";
    const dbLeadStatus = authStatus === "active" ? "ACTIVATED" : "PENDING";

    // AUTO-PROVISION if active
    if (authStatus === "active") {
      const { provisionSchool } = await import("@/app/(superadmin)/superadmin/actions");
      const schoolId = user.user_metadata?.schoolId as string || "default_school";
      await provisionSchool(userId, schoolId, schoolName);
    } else {
      // Create or Update the Admin record (Standard flow)
      await prisma.admin.upsert({
        where: { id: userId },
        update: {
          pendingSchoolName: schoolName,
          status: "pending",
          phone: phoneNumber || undefined,
        },
        create: {
          id: userId,
          username: user.user_metadata?.username || "user_" + userId.slice(-5),
          name: user.user_metadata?.firstName || user.user_metadata?.name || "New",
          surname: user.user_metadata?.lastName || "Admin",
          status: "pending",
          pendingSchoolName: schoolName,
          schoolId: "default_school",
          phone: phoneNumber || undefined,
        },
      });
    }

    // Update metadata to match (only lock to pending if not already active)
    if (authStatus !== "active") {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          status: "pending",
          role: "admin",
        },
      });
    }

    // Also forcefully generate a SetupRequest to populate the Leads tab
    await prisma.setupRequest.create({
      data: {
        schoolName: schoolName,
        ownerName: `${user.user_metadata?.firstName || user.user_metadata?.name || "New"} ${user.user_metadata?.lastName || "Admin"}`,
        phoneNumber: phoneNumber || "N/A",
        city: city || "Online / Sync",
        status: dbLeadStatus
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("User Sync Error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
