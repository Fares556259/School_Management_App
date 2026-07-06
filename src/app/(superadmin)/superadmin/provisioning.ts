"use server";

import prisma from "@/lib/prisma";
import { getRole } from "@/lib/role";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import slugify from "slugify";

export async function provisionSchool(setupRequestId: string) {
  try {
    // 1. Verify Superuser Role
    const role = await getRole();
    if (role !== "superuser") {
      return { success: false, error: "Unauthorized. Superuser access required." };
    }

    // 2. Fetch the Setup Request
    const request = await prisma.setupRequest.findUnique({
      where: { id: setupRequestId },
    });

    if (!request) {
      return { success: false, error: "Setup request not found." };
    }

    if (request.status === "PROVISIONED") {
      return { success: false, error: "This school has already been provisioned." };
    }

    // Generate a dummy email since email is not collected in the setup request
    const adminEmail = `admin_${setupRequestId}@snapschool.local`;

    // 3. Generate a Unique School ID (Slug)
    let baseSlug = slugify(request.schoolName, { lower: true, strict: true });
    let schoolId = baseSlug;
    let counter = 1;

    // Ensure uniqueness
    while (await prisma.institution.findFirst({ where: { schoolId } })) {
      schoolId = `${baseSlug}-${counter}`;
      counter++;
    }

    // 4. Create the Supabase User & Send Invitation
    let supabaseUserId;
    let tempPassword;
    try {
        tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + "9!aA";
        
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: adminEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
                firstName: request.ownerName.split(' ')[0] || "Director",
                lastName: request.ownerName.split(' ').slice(1).join(' ') || "",
                role: "admin",
                schoolId: schoolId
            }
        });

        if (error) {
            throw error;
        }
        
        supabaseUserId = data.user.id;

    } catch (authError: any) {
        console.error("Supabase User Creation Error:", authError);
        // If the user already exists, update their metadata
        if (authError.message?.includes('already exists')) {
            const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
            const existingUser = users.find(u => u.email === adminEmail);
            if (existingUser) {
               supabaseUserId = existingUser.id;
               await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, {
                   user_metadata: { ...existingUser.user_metadata, role: "admin", schoolId: schoolId }
               });
            } else {
                 return { success: false, error: "User exists but could not be retrieved from Supabase." };
            }
        } else {
           return { success: false, error: "Failed to create Supabase user: " + authError.message };
        }
    }


    // 5. Build the School Infrastructure in Database
    await prisma.$transaction(async (tx) => {
      // Create Institution Settings
      await tx.institution.create({
        data: {
          schoolId: schoolId,
          schoolName: request.schoolName,
          ministryName: "Local Ministry of Education", // Default
          academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
          currentSemester: 1,
          yearStart: new Date(`${new Date().getFullYear()}-09-01`),
          yearEnd: new Date(`${new Date().getFullYear() + 1}-06-30`),
          holidays: [],
          sessions: []
        },
      });

      // Create Admin Record (Optional, since Supabase holds primary source of truth, but good for DB referential integrity if needed elsewhere)
      await tx.admin.create({
          data: {
              id: supabaseUserId as string,
              username: adminEmail.split('@')[0], 
              schoolId: schoolId,
          }
      });

      // Create Default Levels (1 through 6)
      const defaultLevels = [1, 2, 3, 4, 5, 6];
      for (const level of defaultLevels) {
        await tx.level.create({
          data: {
            level: level,
            tuitionFee: 0, // Default fee
            schoolId: schoolId,
          },
        });
      }

      // 6. Update Setup Request Status
      await tx.setupRequest.update({
        where: { id: setupRequestId },
        data: { status: "PROVISIONED" },
      });
    });

    return { success: true, schoolId, tempPassword: typeof tempPassword !== 'undefined' ? tempPassword : "User Already Existed" };
  } catch (error: any) {
    console.error("Provisioning Error:", error);
    return { success: false, error: error.message || "An unexpected error occurred during provisioning." };
  }
}
