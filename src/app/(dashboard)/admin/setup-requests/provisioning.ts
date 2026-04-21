"use server";

import prisma from "@/lib/prisma";
import { getRole } from "@/lib/role";
import { clerkClient } from "@clerk/nextjs/server";
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

    if (!request.email) {
      return { success: false, error: "Cannot provision school without an email address." };
    }

    // 3. Generate a Unique School ID (Slug)
    let baseSlug = slugify(request.schoolName, { lower: true, strict: true });
    let schoolId = baseSlug;
    let counter = 1;

    // Ensure uniqueness
    while (await prisma.institution.findFirst({ where: { schoolId } })) {
      schoolId = `${baseSlug}-${counter}`;
      counter++;
    }

    // 4. Create the Clerk User & Send Invitation
    // Use the Clerk API to create the user and send an invitation
    const client = await clerkClient();
    
    // We try to create the user first. If they already exist, we'll update their metadata.
    let clerkUserId;
    try {
        const newUser = await client.users.createUser({
            emailAddress: [request.email],
            firstName: request.ownerName.split(' ')[0] || "Director",
            lastName: request.ownerName.split(' ').slice(1).join(' ') || "",
            publicMetadata: {
                role: "admin",
                schoolId: schoolId
            },
            skipPasswordRequirement: true // Essential for invitations
        });
        clerkUserId = newUser.id;
        
        // Wait briefly to ensure user is created before creating ticket
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Create an invitation ticket
        await client.signInTokens.createSignInToken({
            userId: clerkUserId,
            expiresInSeconds: 60 * 60 * 24 * 30 // 30 days
        });

    } catch (clerkError: any) {
        console.error("Clerk User Creation Error:", clerkError);
        // If the user already exists, update their metadata
        if (clerkError.errors && clerkError.errors.some((e: any) => e.code === 'form_identifier_exists')) {
            const users = await client.users.getUserList({ emailAddress: [request.email] });
            if (users.data.length > 0) {
               clerkUserId = users.data[0].id;
               await client.users.updateUserMetadata(clerkUserId, {
                   publicMetadata: { role: "admin", schoolId: schoolId }
               });
            } else {
                 return { success: false, error: "User exists but could not be retrieved from Clerk." };
            }
        } else {
           return { success: false, error: "Failed to create Clerk user: " + clerkError.message };
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

      // Create Admin Record (Optional, since Clerk holds primary source of truth, but good for DB referential integrity if needed elsewhere)
      await tx.admin.create({
          data: {
              id: clerkUserId,
              username: request.email.split('@')[0], 
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

    return { success: true, schoolId };
  } catch (error: any) {
    console.error("Provisioning Error:", error);
    return { success: false, error: error.message || "An unexpected error occurred during provisioning." };
  }
}
